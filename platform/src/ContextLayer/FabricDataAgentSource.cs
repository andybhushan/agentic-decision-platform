using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;

namespace Adp.ContextLayer;

// Fabric IQ Data Agent as a live context source (Wave 3 of the world-class plan).
// Asks the workspace's published Data Agent a natural-language question about the subject
// (via its OpenAI-assistants-compatible endpoint) and returns the answer as a GROUNDED
// fragment. This puts the REAL Fabric IQ item (ontology + semantic model + lakehouse behind
// the agent) into the decision loop, cited as first-class evidence.
//
// Design constraints honored:
//   - Platform-generic: the question is built from the package's SchemaContext + subject id;
//     no domain vocabulary lives here.
//   - Declared, not assumed: only fires when the package binds FabricIQ primitives for the
//     step (request.SourceBindings["FabricIQ"] non-empty), same rule as the SQL primitives.
//   - One consultation per subject per instance (in-process cache): the agent answer is
//     reused across the run's steps instead of paying 10-30s per step.
//   - Graceful degradation: any error (including "assistant does not exist" while the Data
//     Agent is not yet published in Fabric) returns empty fragments and the run proceeds.
//
// Config: FABRIC_DATA_AGENT_URL = the agent's assistants base, e.g.
//   https://api.fabric.microsoft.com/v1/workspaces/{ws}/aiskills/{id}/aiassistant/openai
// Auth: DefaultAzureCredential for https://api.fabric.microsoft.com/.default (the container
// app's managed identity is a member of the Fabric workspace; no ARM RBAC involved).
public sealed class FabricDataAgentSource(string agentUrl, TokenCredential? credential = null) : IContextSource, IDisposable
{
    public string SourceId => "FabricIQ";

    public IReadOnlyList<ContextDimension> SupportedDimensions { get; } =
        [ContextDimension.Historical, ContextDimension.Entity];

    private const string ApiVersion = "2024-05-01-preview";
    private static readonly TimeSpan AnswerTimeout = TimeSpan.FromSeconds(75);

    private readonly string _base = agentUrl.TrimEnd('/');
    private readonly TokenCredential _credential = credential ?? new DefaultAzureCredential();
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(90) };
    private readonly ConcurrentDictionary<string, Task<ContextFragment?>> _bySubject = new(StringComparer.Ordinal);
    // The serving assistant is minted per client via POST /assistants (verified live: the
    // artifact id itself is NOT an assistant id). Created lazily, cached for the process.
    private string? _assistantId;

    public static FabricDataAgentSource? FromEnvironment()
    {
        var url = Environment.GetEnvironmentVariable("FABRIC_DATA_AGENT_URL");
        return string.IsNullOrWhiteSpace(url) ? null : new FabricDataAgentSource(url);
    }

    public async Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        // Same declaration rule as the other FabricIQ sources: the package must bind primitives.
        if (request.SourceBindings is null
            || !request.SourceBindings.TryGetValue(SourceId, out var primitives)
            || primitives is null or { Count: 0 })
        {
            return [];
        }

        try
        {
            var fragment = await _bySubject.GetOrAdd(
                request.SubjectId,
                subjectId => AskAsync(subjectId, request, CancellationToken.None));
            return fragment is null ? [] : [fragment];
        }
        catch
        {
            _bySubject.TryRemove(request.SubjectId, out _);
            return [];
        }
    }

    private async Task<ContextFragment?> AskAsync(string subjectId, ContextRequest request, CancellationToken ct)
    {
        var answer = await AskQuestionAsync(BuildQuestion(subjectId, request), ct);
        if (string.IsNullOrWhiteSpace(answer)) return null;

        // Quality gate: a short answer that is only an inability apology grounds nothing.
        // (Mixed answers that hedge then deliver ontology content are long and pass.)
        var lowered = answer.ToLowerInvariant();
        if (answer.Length < 350 && (lowered.Contains("unable to") || lowered.Contains("technical issue")))
            return null;

        return new ContextFragment(
            SourceId: SourceId,
            DocId: $"DATA_AGENT/{subjectId}",
            Title: "Fabric IQ Data Agent: semantic-layer answer",
            Content: answer.Length > 1500 ? answer[..1500] : answer,
            RelevanceScore: 0.9,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Historical, ContextDimension.Entity]);
    }

    // Raw ask: one natural-language question to the published Data Agent, the full answer back.
    // Used by the per-subject grounding above AND by the operator copilot's portfolio tool.
    public async Task<string?> AskQuestionAsync(string question, CancellationToken ct = default)
    {
        using var timeout = new CancellationTokenSource(AnswerTimeout);
        var token = (await _credential.GetTokenAsync(
            new TokenRequestContext(["https://api.fabric.microsoft.com/.default"]), timeout.Token)).Token;

        _assistantId ??= await PostAsync<string>(token, "/assistants",
            JsonSerializer.Serialize(new { model = "gpt-4o" }), doc => doc.GetProperty("id").GetString()!, timeout.Token);

        var threadId = await PostAsync<string>(token, "/threads", "{}", doc => doc.GetProperty("id").GetString()!, timeout.Token);
        await PostAsync<object?>(token, $"/threads/{threadId}/messages",
            JsonSerializer.Serialize(new { role = "user", content = question }), _ => null, timeout.Token);
        var runId = await PostAsync<string>(token, $"/threads/{threadId}/runs",
            JsonSerializer.Serialize(new { assistant_id = _assistantId }), doc => doc.GetProperty("id").GetString()!, timeout.Token);

        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            await Task.Delay(2500, timeout.Token);
            var status = await GetAsync(token, $"/threads/{threadId}/runs/{runId}",
                doc => doc.GetProperty("status").GetString(), timeout.Token);
            if (status == "completed") break;
            if (status is "failed" or "cancelled" or "expired") return null;
        }

        var answer = await GetAsync(token, $"/threads/{threadId}/messages", doc =>
        {
            foreach (var m in doc.GetProperty("data").EnumerateArray())
            {
                if (m.GetProperty("role").GetString() != "assistant") continue;
                var sb = new StringBuilder();
                foreach (var c in m.GetProperty("content").EnumerateArray())
                {
                    if (c.TryGetProperty("text", out var t) && t.TryGetProperty("value", out var v))
                        sb.Append(v.GetString());
                }
                return sb.ToString();
            }
            return null;
        }, timeout.Token);

        return answer;
    }

    private static string BuildQuestion(string subjectId, ContextRequest request)
    {
        // Two-part ask: the ontology-graph part answers even when row-level SQL is not
        // queryable; the record part enriches when it is. Verified against the live agent.
        var primary = request.SchemaContext?.PrimaryEntity;
        var recordAsk = primary is null
            ? $"if the data source is queryable, also summarize what is recorded for subject '{subjectId}'"
            : $"if the data source is queryable, also summarize the {primary.FactTable} record whose {primary.FactSubjectKey} is '{subjectId}' and the history of records sharing its {primary.FactForeignKey}";
        return
            $"For a decision of type '{request.Intent}': using the ontology graph, state concisely which connected " +
            $"entity types and governed relationships matter for this decision and why; {recordAsk}. Be concise.";
    }

    private async Task<T> PostAsync<T>(string token, string path, string body, Func<JsonElement, T> project, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_base}{path}?api-version={ApiVersion}")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        return project(doc.RootElement);
    }

    private async Task<T> GetAsync<T>(string token, string path, Func<JsonElement, T> project, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{_base}{path}?api-version={ApiVersion}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        return project(doc.RootElement);
    }

    public void Dispose() => _http.Dispose();
}
