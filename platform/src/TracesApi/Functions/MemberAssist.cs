using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// POST /api/assist
// Body: { industry, memberId, messages: [{role:"user"|"assistant", content}] }
// The member-facing assistant for the branded portals: answers ONLY from this member's own
// records and journey status, assembled server-side so the browser never holds anyone
// else's data. Calls the Azure OpenAI REST API directly (the Azure.AI.OpenAI 2.1 chat path
// is binary-incompatible with the OpenAI 2.10 assembly Agent Framework resolves).
public sealed class MemberAssist(IntakeStore intake, DwStateReader reader, ILogger<MemberAssist> logger)
{
    private const int MaxHistory = 10;
    private const int MaxSubjects = 6;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    [Function("MemberAssist")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "assist")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        AssistRequest? body;
        try
        {
            using var sr = new StreamReader(req.Body);
            body = JsonSerializer.Deserialize<AssistRequest>(await sr.ReadToEndAsync(cancellationToken), JsonOpts);
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }

        if (body is null || string.IsNullOrWhiteSpace(body.Industry) || string.IsNullOrWhiteSpace(body.MemberId))
            return new BadRequestObjectResult(new { error = "body must contain industry and memberId" });
        if (body.Messages is not { Count: > 0 } || body.Messages[^1].Role != "user")
            return new BadRequestObjectResult(new { error = "messages must end with a user message" });

        var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            return new ObjectResult(new { error = "assistant unavailable" }) { StatusCode = 503 };

        // 1. This member's records (corpus + runtime intake), scoped server-side.
        var (records, idField) = await LoadMemberRecordsAsync(body.Industry, body.MemberId, cancellationToken);
        if (records.Count == 0)
            return new NotFoundObjectResult(new { error = "no records for member" });

        // 2. Per-subject journey summaries from the journal.
        var context = new StringBuilder();
        var isBanking = string.Equals(body.Industry, "banking", StringComparison.OrdinalIgnoreCase);
        context.AppendLine(isBanking ? "THE MEMBER'S LOAN APPLICATIONS:" : "THE MEMBER'S CLAIMS:");
        foreach (var rec in records.Take(MaxSubjects))
        {
            var subjectId = rec.TryGetProperty(idField, out var idEl) ? idEl.GetString() ?? "" : "";
            if (subjectId.Length == 0) continue;
            context.AppendLine();
            context.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"--- {subjectId} ---");
            context.AppendLine(CompactRecord(rec));
            context.AppendLine(await JourneySummaryAsync(subjectId, isBanking, cancellationToken));
        }

        var brand = isBanking ? "Northwind Bank" : "Meridian Mutual";
        var systemPrompt =
            $"You are the {brand} member assistant inside the member's own account portal. " +
            "Answer ONLY from the member data provided below; it is this signed-in member's own information. " +
            "Speak in warm, plain member language, 2 to 5 sentences, no internal jargon. " +
            "Be precise about status: if a stage has not run yet, say it is queued and that they will see it on the tracker. " +
            "You may share repair estimates, decisions, what our AI saw in their photos or documents, and stage progress. " +
            "NEVER discuss fraud screening, integrity checks, internal scores, other members, or anything not in the data. " +
            "If asked something outside this member's account (general advice, other people, pricing), politely say you can only help with their own account and suggest calling the care line. " +
            "Never invent facts, amounts, or dates.\n\n" + context;

        // 3. Conversation: last N turns on top of the grounded system prompt.
        var messages = new List<object> { new { role = "system", content = systemPrompt } };
        foreach (var m in body.Messages.TakeLast(MaxHistory))
        {
            var role = m.Role == "assistant" ? "assistant" : "user";
            messages.Add(new { role, content = m.Content ?? "" });
        }

        var url = $"{endpoint.TrimEnd('/')}/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21";
        using var chatReq = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new { messages, temperature = 0.3, max_tokens = 350 }),
        };
        chatReq.Headers.Add("api-key", apiKey);

        using var res = await Http.SendAsync(chatReq, cancellationToken);
        var raw = await res.Content.ReadAsStringAsync(cancellationToken);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogWarning("MemberAssist chat HTTP {Status}: {Body}", (int)res.StatusCode, raw[..Math.Min(raw.Length, 200)]);
            return new ObjectResult(new { error = "assistant unavailable" }) { StatusCode = 502 };
        }

        using var doc = JsonDocument.Parse(raw);
        var reply = doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0
            ? choices[0].GetProperty("message").GetProperty("content").GetString() ?? ""
            : "";

        logger.LogInformation("MemberAssist answered for {MemberId} ({Industry}), {Chars} chars", body.MemberId, body.Industry, reply.Length);
        return new OkObjectResult(new { reply });
    }

    private async Task<(List<JsonElement> Records, string IdField)> LoadMemberRecordsAsync(
        string industry, string memberId, CancellationToken ct)
    {
        var baseDir = AppContext.BaseDirectory;
        string arrayKey = "claims", idField = "claimNumber";
        foreach (var zipPath in Directory.EnumerateFiles(Path.Combine(baseDir, "Resources"), "*.zip").OrderBy(p => p, StringComparer.Ordinal))
        {
            Adp.PackageModel.AgentPackage pkg;
            try { pkg = PlanExecutor.LoadPackage(zipPath); }
            catch { continue; }
            if (!string.Equals(pkg.Package.Industry, industry, StringComparison.OrdinalIgnoreCase)) continue;
            arrayKey = pkg.DigitalWorker.CorpusBinding?.ArrayKey ?? arrayKey;
            idField = pkg.DigitalWorker.CorpusBinding?.SubjectIdField ?? idField;
            break;
        }

        var all = new List<JsonElement>();
        if (PrepareRunActivity.CorpusByIndustry.TryGetValue(industry, out var corpusRel))
        {
            var corpusPath = Path.Combine(baseDir, "Resources", corpusRel);
            if (File.Exists(corpusPath))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(corpusPath));
                if (doc.RootElement.TryGetProperty(arrayKey, out var arr) && arr.ValueKind == JsonValueKind.Array)
                    foreach (var e in arr.EnumerateArray()) all.Add(e.Clone());
            }
        }
        foreach (var d in (await intake.ListAsync(industry, ct)).OrderBy(d => d.ReceivedAt))
        {
            using var parsed = JsonDocument.Parse(d.RecordJson);
            all.Add(parsed.RootElement.Clone());
        }

        // Member scoping: a record belongs to the member when its policyholder id or borrower
        // id matches. Newest first so recent submissions lead the context.
        var mine = all.Where(r => OwnedBy(r, memberId)).ToList();
        mine.Reverse();
        return (mine, idField);
    }

    private static bool OwnedBy(JsonElement rec, string memberId)
    {
        if (rec.TryGetProperty("policyholder", out var ph) &&
            ph.ValueKind == JsonValueKind.Object &&
            ph.TryGetProperty("policyholderId", out var phId) &&
            string.Equals(phId.GetString(), memberId, StringComparison.OrdinalIgnoreCase)) return true;
        if (rec.TryGetProperty("borrowerId", out var bId) &&
            string.Equals(bId.GetString(), memberId, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    // A compact, prompt-friendly digest: identity, the ask, and the evidence fields.
    private static string CompactRecord(JsonElement rec)
    {
        var sb = new StringBuilder();
        void Add(string label, string? v) { if (!string.IsNullOrWhiteSpace(v)) sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"{label}: {v}"); }
        string? Str(string prop) => rec.TryGetProperty(prop, out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null;
        string? Num(string prop) => rec.TryGetProperty(prop, out var e) && e.ValueKind == JsonValueKind.Number ? e.GetRawText() : null;

        if (rec.TryGetProperty("incident", out var inc) && inc.ValueKind == JsonValueKind.Object)
        {
            Add("incident type", inc.TryGetProperty("incidentType", out var it) ? it.GetString() : null);
            Add("what the member reported", inc.TryGetProperty("narrative", out var n) ? Trim(n.GetString(), 240) : null);
        }
        if (rec.TryGetProperty("vehicle", out var veh) && veh.ValueKind == JsonValueKind.Object)
        {
            var y = veh.TryGetProperty("year", out var yy) ? yy.GetRawText() : "";
            var mk = veh.TryGetProperty("make", out var mm) ? mm.GetString() : "";
            var md = veh.TryGetProperty("model", out var mo) ? mo.GetString() : "";
            Add("vehicle", $"{y} {mk} {md}".Trim());
        }
        Add("incident date", Str("incidentDate"));
        Add("loan", Num("loanAmount") is { } la ? $"${la} {Str("loanPurpose")} over {Num("termMonths")} months" : null);
        Add("application date", Str("applicationDate"));
        Add("what our AI saw in the uploaded photos/documents", Trim(Str("evidenceAssessment"), 500));
        if (rec.TryGetProperty("documentEvidence", out var docs) && docs.ValueKind == JsonValueKind.Array && docs.GetArrayLength() > 0)
            Add("documents attached", string.Join(", ", docs.EnumerateArray().Select(d => d.GetString())));
        return sb.ToString().TrimEnd();
    }

    // Stage-by-stage status from the journal, in member-safe language. Fraud-related stages
    // are summarized as a routine review and their outputs are NEVER included.
    private async Task<string> JourneySummaryAsync(string subjectId, bool isBanking, CancellationToken ct)
    {
        IReadOnlyList<DwStateRow> rows;
        try { rows = await reader.ListBySubjectAsync(subjectId, ct); }
        catch { return "status: received; processing has not started yet."; }
        if (rows.Count == 0) return "status: received and queued; no stage has run yet.";

        var sb = new StringBuilder("status by stage:");
        sb.AppendLine();
        foreach (var pkg in rows.Where(r => r.PackageId is not null).GroupBy(r => r.PackageId!))
        {
            var latestTrace = pkg.GroupBy(r => r.TraceId).OrderBy(g => g.Max(r => r.EmittedAt)).Last().ToList();
            var isFraud = pkg.Key.Contains("fraud", StringComparison.OrdinalIgnoreCase);
            var anyGate = latestTrace.Any(r => r.Status == "needs-human-review");
            var stageState = anyGate ? "a specialist is personally reviewing this step" : "completed";
            if (isFraud)
            {
                sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"- routine review: {stageState}");
                continue;
            }
            sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"- {pkg.Key}: {stageState}");
            // Surface the member-relevant outputs: the estimate and, for banking, the decision letter.
            foreach (var r in latestTrace.Where(r => r.Status == "completed" && r.OutputSummary is not null))
            {
                var label = r.StepLabel ?? "";
                var isEstimate = label.Contains("estimat", StringComparison.OrdinalIgnoreCase);
                var isDecision = isBanking && (label.Contains("decision", StringComparison.OrdinalIgnoreCase) || label.Contains("letter", StringComparison.OrdinalIgnoreCase) || label.Contains("eligib", StringComparison.OrdinalIgnoreCase));
                if (isEstimate || isDecision)
                    sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"  {label}: {Trim(r.OutputSummary, 320)}");
            }
        }
        return sb.ToString().TrimEnd();
    }

    private static string? Trim(string? s, int max) =>
        s is null ? null : s.Length <= max ? s : s[..max] + "...";

    private sealed record AssistRequest(string? Industry, string? MemberId, List<AssistMessage>? Messages);
    private sealed record AssistMessage(string? Role, string? Content);
}
