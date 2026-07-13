using System.ClientModel;
using System.Globalization;
using System.Text.Json;
using Azure.AI.OpenAI;
using Microsoft.Agents.AI;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Adp.ContextLayer;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// POST /api/copilot
// Body: { messages: [{role:"user"|"assistant", content}] }
// The operator copilot for the platform console: a REAL Microsoft Agent Framework agent
// (the same runtime that powers the digital workers) with three governed tools:
//   query_journal          - operational state from the immutable decision journal
//   query_records          - subject records across both use cases (corpus + intake)
//   ask_fabric_data_agent  - portfolio analytics delegated to the published Fabric IQ Data Agent
// The company/operator audience is entitled to fraud detail; member portals are not.
// Response: { reply, toolsUsed } so the console can show source chips.
public sealed class OperatorCopilot(IntakeStore intake, DwStateReader reader, ILogger<OperatorCopilot> logger)
{
    private const int MaxHistory = 10;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private static readonly Lazy<FabricDataAgentSource?> DataAgent = new(FabricDataAgentSource.FromEnvironment);

    [Function("OperatorCopilot")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "copilot")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        CopilotRequest? body;
        try
        {
            using var sr = new StreamReader(req.Body);
            body = JsonSerializer.Deserialize<CopilotRequest>(await sr.ReadToEndAsync(cancellationToken), JsonOpts);
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }
        if (body?.Messages is not { Count: > 0 } || body.Messages[^1].Role != "user")
            return new BadRequestObjectResult(new { error = "messages must end with a user message" });

        var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            return new ObjectResult(new { error = "copilot unavailable" }) { StatusCode = 503 };

        var toolsUsed = new List<string>();
        var tools = new List<AITool>
        {
            new JournalTool(reader, toolsUsed),
            new RecordsTool(intake, toolsUsed),
        };
        if (DataAgent.Value is not null) tools.Add(new DataAgentTool(DataAgent.Value, toolsUsed));

        const string instructions =
            "You are the ADP platform copilot for the operations team of the company running this instance. " +
            "You answer portfolio-level questions across all subjects (claims, loan applications): operational state, " +
            "gates awaiting judgment, evidence, estimates, and analytics. This audience is entitled to fraud-screen detail. " +
            "ALWAYS ground answers in your tools; never answer portfolio questions from memory. Choose the right tool: " +
            "query_journal for what is happening on the platform (runs, gates, stages, confidence); " +
            "query_records for subject details and filtering (state, incident type, evidence, amounts); " +
            "ask_fabric_data_agent for portfolio analytics over the governed semantic layer (counts, distributions, history). " +
            "Answer concisely in plain prose, cite subject ids exactly as given (e.g. CLM-2026-10028), and when a tool " +
            "returned nothing say so honestly. Do not invent subjects, figures, or dates. " +
            "Respond as a JSON object: {\"reply\": \"your answer\", \"followUps\": [\"...\", \"...\", \"...\"]} where followUps are up to 3 short " +
            "operator questions (under 70 characters each) that naturally follow from your answer and that your tools could answer, " +
            "e.g. drilling into a subject you mentioned, a related aggregate, or the other use case.";

        try
        {
            var client = new AzureOpenAIClient(new Uri(endpoint), new ApiKeyCredential(apiKey));
            var agent = new ChatClientAgent(
                client.GetChatClient("gpt-4o").AsIChatClient(),
                instructions: instructions,
                name: "adp_operator_copilot",
                description: "ADP operator copilot",
                tools: tools);

            var session = await agent.CreateSessionAsync(cancellationToken);
            var runOptions = new ChatClientAgentRunOptions
            {
                ChatOptions = new ChatOptions
                {
                    ResponseFormat = ChatResponseFormat.Json,
                    Temperature = 0.2f,
                    MaxOutputTokens = 700,
                },
            };

            var history = body.Messages.TakeLast(MaxHistory)
                .Select(m => new ChatMessage(m.Role == "assistant" ? ChatRole.Assistant : ChatRole.User, m.Content ?? ""))
                .ToList();

            var response = await agent.RunAsync(history, session, runOptions, cancellationToken);
            var (reply, followUps) = AssistantReply.Parse(response.Text ?? "");

            logger.LogInformation("OperatorCopilot answered, tools=[{Tools}], {Chars} chars, {Fu} follow-ups",
                string.Join(",", toolsUsed.Distinct()), reply.Length, followUps.Count);
            return new OkObjectResult(new { reply, toolsUsed = toolsUsed.Distinct().ToArray(), followUps });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OperatorCopilot failed");
            return new ObjectResult(new { error = "copilot unavailable" }) { StatusCode = 502 };
        }
    }

    // --- Tool 1: the decision journal (operational state) ---------------------------------
    private sealed class JournalTool(DwStateReader reader, List<string> used) : AIFunction
    {
        public override string Name => "query_journal";
        public override string Description =>
            "Operational state from the immutable decision journal: per-subject latest stage statuses, open HITL gates, " +
            "run counts per digital worker, and average confidence, within a recent window.";
        public override JsonElement JsonSchema { get; } = JsonDocument.Parse(
            """{"type":"object","properties":{"hours":{"type":"number","description":"look-back window in hours, default 168"}}}""").RootElement.Clone();

        protected override async ValueTask<object?> InvokeCoreAsync(AIFunctionArguments arguments, CancellationToken ct)
        {
            lock (used) used.Add("journal");
            var hours = 168.0;
            if (arguments.TryGetValue("hours", out var h) && h is JsonElement { ValueKind: JsonValueKind.Number } je)
                hours = je.GetDouble();

            var rows = await reader.ListRecentAsync(TimeSpan.FromHours(hours), ct);
            var agentRows = rows.Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false)).ToList();

            var subjects = agentRows
                .Where(r => r.SubjectId is not null && r.PackageId is not null)
                .GroupBy(r => r.SubjectId!)
                .Select(g =>
                {
                    var stages = g.GroupBy(r => r.PackageId!).Select(pg =>
                    {
                        var latest = pg.GroupBy(r => r.TraceId).OrderBy(t => t.Max(r => r.EmittedAt)).Last().ToList();
                        var gated = latest.Any(r => r.Status == "needs-human-review");
                        return new { stage = pg.Key, status = gated ? "needs-review" : "completed" };
                    }).ToArray();
                    return new { subjectId = g.Key, stages, lastActivity = g.Max(r => r.EmittedAt) };
                })
                .OrderByDescending(s => s.lastActivity)
                .Take(40)
                .ToArray();

            var summary = new
            {
                windowHours = hours,
                subjectsActive = subjects.Length,
                gatedNow = subjects.Where(s => s.stages.Any(st => st.status == "needs-review")).Select(s => s.subjectId).ToArray(),
                runsPerWorker = agentRows.Where(r => r.PackageId is not null)
                    .GroupBy(r => r.PackageId!)
                    .ToDictionary(g => g.Key, g => g.Select(r => r.TraceId).Distinct().Count()),
                avgConfidence = Math.Round(agentRows.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).DefaultIfEmpty(0).Average(), 3),
                subjects,
            };
            return JsonSerializer.SerializeToElement(summary, JsonOpts);
        }
    }

    // --- Tool 2: subject records across both use cases -------------------------------------
    private sealed class RecordsTool(IntakeStore intake, List<string> used) : AIFunction
    {
        public override string Name => "query_records";
        public override string Description =>
            "Subject records (bundled corpus + runtime intake) for an industry. Optional case-insensitive text filter " +
            "matched against the whole record (e.g. a state, incident type, subject id, or name). Returns compact digests " +
            "including photo/document evidence fields.";
        public override JsonElement JsonSchema { get; } = JsonDocument.Parse(
            """{"type":"object","properties":{"industry":{"type":"string","enum":["insurance","banking"]},"filter":{"type":"string","description":"optional text filter"},"limit":{"type":"number","description":"max results, default 15"}},"required":["industry"]}""").RootElement.Clone();

        protected override async ValueTask<object?> InvokeCoreAsync(AIFunctionArguments arguments, CancellationToken ct)
        {
            lock (used) used.Add("records");
            var industry = arguments.TryGetValue("industry", out var iv) && iv is JsonElement { ValueKind: JsonValueKind.String } ie ? ie.GetString()! : "insurance";
            var filter = arguments.TryGetValue("filter", out var fv) && fv is JsonElement { ValueKind: JsonValueKind.String } fe ? fe.GetString() : null;
            var limit = 15;
            if (arguments.TryGetValue("limit", out var lv) && lv is JsonElement { ValueKind: JsonValueKind.Number } le) limit = (int)le.GetDouble();

            var baseDir = AppContext.BaseDirectory;
            var idField = string.Equals(industry, "banking", StringComparison.OrdinalIgnoreCase) ? "applicationId" : "claimNumber";
            var arrayKey = string.Equals(industry, "banking", StringComparison.OrdinalIgnoreCase) ? "applications" : "claims";

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

            var matches = all.Where(r => filter is null || r.GetRawText().Contains(filter, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var items = matches.TakeLast(limit).Select(r =>
            {
                string? S(string p) => r.TryGetProperty(p, out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null;
                var id = S(idField);
                var digest = new Dictionary<string, object?> { ["subjectId"] = id };
                if (r.TryGetProperty("incident", out var inc) && inc.ValueKind == JsonValueKind.Object)
                {
                    digest["incidentType"] = inc.TryGetProperty("incidentType", out var it) ? it.GetString() : null;
                    digest["state"] = r.TryGetProperty("policyholder", out var ph) && ph.TryGetProperty("address", out var ad) && ad.TryGetProperty("state", out var st) ? st.GetString() : null;
                }
                if (r.TryGetProperty("loanAmount", out var la)) digest["loanAmount"] = la.GetRawText();
                digest["loanPurpose"] = S("loanPurpose");
                digest["evidencePhotos"] = r.TryGetProperty("evidencePhotoCount", out var pc) ? pc.GetRawText() : null;
                digest["evidenceAssessment"] = S("evidenceAssessment") is { } ea ? (ea.Length > 220 ? ea[..220] + "..." : ea) : null;
                if (r.TryGetProperty("documentEvidence", out var de) && de.ValueKind == JsonValueKind.Array)
                    digest["documents"] = string.Join(", ", de.EnumerateArray().Select(x => x.GetString()));
                return digest;
            }).ToArray();

            return JsonSerializer.SerializeToElement(new { industry, totalMatches = matches.Count, returned = items.Length, items }, JsonOpts);
        }
    }

    // --- Tool 3: the published Fabric IQ Data Agent -----------------------------------------
    private sealed class DataAgentTool(FabricDataAgentSource source, List<string> used) : AIFunction
    {
        public override string Name => "ask_fabric_data_agent";
        public override string Description =>
            "Portfolio analytics over the governed Microsoft Fabric semantic layer (fact_claims, dim_policyholder, " +
            "dim_vehicle and related tables): counts, distributions, per-state or per-incident-type breakdowns, and " +
            "history questions. Slower (10-30s); use for analytical questions, not operational state.";
        public override JsonElement JsonSchema { get; } = JsonDocument.Parse(
            """{"type":"object","properties":{"question":{"type":"string","description":"a natural-language analytics question"}},"required":["question"]}""").RootElement.Clone();

        protected override async ValueTask<object?> InvokeCoreAsync(AIFunctionArguments arguments, CancellationToken ct)
        {
            lock (used) used.Add("fabric-data-agent");
            var question = arguments.TryGetValue("question", out var qv) && qv is JsonElement { ValueKind: JsonValueKind.String } qe ? qe.GetString()! : "";
            // The Data Agent sometimes hands back a report-file reference; force inline answers.
            var answer = await source.AskQuestionAsync(
                question + " Answer inline in plain text with the actual numbers; do not generate or reference report files.", ct);
            return JsonSerializer.SerializeToElement(new { answer = answer ?? "The Data Agent could not answer this question." }, JsonOpts);
        }
    }

    private sealed record CopilotRequest(List<CopilotMessage>? Messages);
    private sealed record CopilotMessage(string? Role, string? Content);
}
