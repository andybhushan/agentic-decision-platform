using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using Azure;
using Azure.AI.Agents.Persistent;
using Azure.Core;
using Azure.Identity;
using Adp.ToolRuntime;

namespace Adp.Agents;

// v1 Real-Foundry adapter. Calls Azure AI Foundry Agent Service (Azure.AI.Agents.Persistent SDK)
// against a Foundry project endpoint. Each AgentSpec → a Foundry persistent agent (Entra Agent ID).
// Each InvokeAsync call → one Foundry thread + run, polled to completion. Tools registered at
// agent-creation time; RequiresAction state during run is dispatched back through IToolRegistry.
//
// Auth: DefaultAzureCredential (az CLI locally, Managed Identity in cloud). No API keys.
//
// Idempotency: agents are upserted by deterministic name `adp-v1-{agentSpec.Id}`. First InvokeAsync
// for a given agent on a cold instance creates the Foundry agent; subsequent invocations cache the
// agent ID in-process. After warm-up, the adapter just resolves by name.
//
// Activation: set AGENT_BACKEND=foundry + FOUNDRY_PROJECT_ENDPOINT. Fallback (set AGENT_BACKEND=legacy
// or omit FOUNDRY_PROJECT_ENDPOINT) routes through LegacyOpenAIAdapter for chat-completions-direct.
public sealed class FoundryAdapter(FoundryAdapterOptions options) : IAgentAdapter, IDisposable
{
    public void Dispose() => _agentCreateGate.Dispose();

    private const int MaxToolRoundtrips = 6;
    private const int PollIntervalMs = 500;
    private const int PollTimeoutMs = 120_000;

    private readonly PersistentAgentsClient _client = new(
        endpoint: options.ProjectEndpoint ?? throw new ArgumentException("FoundryAdapterOptions.ProjectEndpoint is required"),
        credential: options.Credential ?? new DefaultAzureCredential());

    private readonly ConcurrentDictionary<string, string> _agentIdByLogicalId = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _agentCreateGate = new(1, 1);

    public static FoundryAdapter FromEnvironment()
    {
        var endpoint = Environment.GetEnvironmentVariable("FOUNDRY_PROJECT_ENDPOINT");
        if (string.IsNullOrEmpty(endpoint))
            throw new InvalidOperationException(
                "FoundryAdapter requires FOUNDRY_PROJECT_ENDPOINT (e.g. https://ai-adp-v1.services.ai.azure.com/api/projects/adp-v1).");
        return new FoundryAdapter(new FoundryAdapterOptions { ProjectEndpoint = endpoint });
    }

    public async Task<AgentInvocationResult> InvokeAsync(
        AgentInvocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();
        var executed = new List<ToolCallExecuted>();

        try
        {
            // 1. Resolve or create the Foundry agent for this AgentSpec
            var foundryAgentId = await EnsureAgentAsync(request, cancellationToken);

            // 2. Create a fresh thread + post the user message
            var thread = await _client.Threads.CreateThreadAsync(cancellationToken: cancellationToken);
            await _client.Messages.CreateMessageAsync(
                thread.Value.Id,
                MessageRole.User,
                BuildUserMessage(request),
                cancellationToken: cancellationToken);

            // 3. Run, polling until terminal status (handling tool calls via RequiresAction)
            var run = await _client.Runs.CreateRunAsync(thread.Value.Id, foundryAgentId, cancellationToken: cancellationToken);
            var startedAt = sw.ElapsedMilliseconds;
            int roundtrips = 0;

            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (sw.ElapsedMilliseconds - startedAt > PollTimeoutMs)
                    throw new TimeoutException($"Foundry run {run.Value.Id} timed out after {PollTimeoutMs}ms");

                if (run.Value.Status == RunStatus.Completed) break;
                if (run.Value.Status == RunStatus.Failed || run.Value.Status == RunStatus.Cancelled || run.Value.Status == RunStatus.Expired)
                {
                    var errMsg = run.Value.LastError?.Message ?? run.Value.Status.ToString();
                    sw.Stop();
                    return new AgentInvocationResult(
                        AgentId: request.Agent.Id,
                        Output: $"Foundry run {run.Value.Status}: {errMsg}",
                        Confidence: 0.0,
                        Origin: "DERIVED",
                        ElapsedMilliseconds: sw.ElapsedMilliseconds,
                        ToolCallsExecuted: executed.Count > 0 ? executed : null);
                }

                if (run.Value.Status == RunStatus.RequiresAction)
                {
                    if (++roundtrips > MaxToolRoundtrips)
                        throw new InvalidOperationException($"Foundry run {run.Value.Id} exceeded {MaxToolRoundtrips} tool-call roundtrips");

                    var action = run.Value.RequiredAction as SubmitToolOutputsAction
                                 ?? throw new InvalidOperationException($"Unexpected required-action type: {run.Value.RequiredAction?.GetType().Name}");

                    var outputs = await DispatchToolCallsAsync(action.ToolCalls, request, executed, cancellationToken);
                    // Overload (ThreadRun, IEnumerable<ToolOutput>, CancellationToken) — passes the run object so the SDK
                    // can derive both threadId + runId without forcing us to disambiguate against the protocol overload.
                    run = await _client.Runs.SubmitToolOutputsToRunAsync(run.Value, outputs, cancellationToken);
                    continue;
                }

                await Task.Delay(PollIntervalMs, cancellationToken);
                run = await _client.Runs.GetRunAsync(thread.Value.Id, run.Value.Id, cancellationToken: cancellationToken);
            }

            // 4. Read the latest assistant message from the thread
            var rawText = await ReadAssistantReplyAsync(thread.Value.Id, cancellationToken);
            sw.Stop();

            var parsed = TryParse(rawText);
            var origin = (parsed.CitedSources.Count > 0 || executed.Any(e => e.Success)) ? "GROUNDED" : "DERIVED";

            var structured = new Dictionary<string, string>();
            if (parsed.CitedSources.Count > 0) structured["citedSources"] = string.Join(", ", parsed.CitedSources);
            if (executed.Count > 0) structured["toolsCalled"] = string.Join(", ", executed.Select(e => e.ToolId).Distinct());
            structured["foundryAgentId"] = foundryAgentId;

            return new AgentInvocationResult(
                AgentId: request.Agent.Id,
                Output: parsed.Output,
                Confidence: Math.Clamp(parsed.Confidence, 0.0, 1.0),
                Origin: origin,
                ElapsedMilliseconds: sw.ElapsedMilliseconds,
                StructuredFields: structured,
                ToolCallsExecuted: executed.Count > 0 ? executed : null);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new AgentInvocationResult(
                AgentId: request.Agent.Id,
                Output: $"Foundry adapter failed: {ex.GetType().Name}: {ex.Message}",
                Confidence: 0.0,
                Origin: "DERIVED",
                ElapsedMilliseconds: sw.ElapsedMilliseconds,
                ToolCallsExecuted: executed.Count > 0 ? executed : null);
        }
    }

    // Ensure the Foundry persistent agent for this AgentSpec exists; cache its Id.
    // Deterministic name: adp-v1-{agentSpec.Id} (e.g., adp-v1-agent.claim-intake)
    private async Task<string> EnsureAgentAsync(AgentInvocationRequest request, CancellationToken ct)
    {
        var logicalId = request.Agent.Id;
        if (_agentIdByLogicalId.TryGetValue(logicalId, out var cached))
            return cached;

        await _agentCreateGate.WaitAsync(ct);
        try
        {
            if (_agentIdByLogicalId.TryGetValue(logicalId, out cached)) return cached;

            var foundryName = NormalizeAgentName($"adp-v1-{logicalId}");

            // Search for an existing agent with this name (idempotent upsert).
            await foreach (var existing in _client.Administration.GetAgentsAsync(cancellationToken: ct))
            {
                if (string.Equals(existing.Name, foundryName, StringComparison.Ordinal))
                {
                    _agentIdByLogicalId[logicalId] = existing.Id;
                    return existing.Id;
                }
            }

            // Create new
            var model = request.Agent.FoundryModel ?? "gpt-4o";
            var instructions = BuildSystemInstructions(request);
            var tools = BuildToolDefinitions(request.Tools);

            var created = await _client.Administration.CreateAgentAsync(
                model: model,
                name: foundryName,
                description: $"ADP v1 agent: {request.Agent.Capability}",
                instructions: instructions,
                tools: tools,
                cancellationToken: ct);

            _agentIdByLogicalId[logicalId] = created.Value.Id;
            return created.Value.Id;
        }
        finally { _agentCreateGate.Release(); }
    }

    private static List<ToolDefinition> BuildToolDefinitions(IToolRegistry? registry)
    {
        var list = new List<ToolDefinition>();
        if (registry is null) return list;
        foreach (var tool in registry.All)
        {
            list.Add(new FunctionToolDefinition(
                name: ToFunctionName(tool.Id),
                description: tool.Description,
                parameters: BinaryData.FromString(tool.ParametersJsonSchema)));
        }
        return list;
    }

    private static async Task<List<ToolOutput>> DispatchToolCallsAsync(
        IReadOnlyList<RequiredToolCall> toolCalls,
        AgentInvocationRequest request,
        List<ToolCallExecuted> executed,
        CancellationToken ct)
    {
        var outputs = new List<ToolOutput>(toolCalls.Count);
        var registry = request.Tools;

        foreach (var call in toolCalls)
        {
            var sw = Stopwatch.StartNew();
            if (call is not RequiredFunctionToolCall fn)
            {
                outputs.Add(new ToolOutput(call.Id, "{\"error\":\"unsupported tool-call type\"}"));
                continue;
            }

            var fnName = fn.Name;
            var tool = registry?.All.FirstOrDefault(t => ToFunctionName(t.Id) == fnName);
            if (tool is null)
            {
                outputs.Add(new ToolOutput(fn.Id, "{\"error\":\"unknown tool\"}"));
                executed.Add(new ToolCallExecuted(fnName, fn.Arguments, "unknown tool", sw.ElapsedMilliseconds, false));
                continue;
            }

            var argsJson = fn.Arguments;
            var ctx = new ToolInvocationContext(request.SubjectId, request.Agent.Id, request.ContextSnippets);
            ToolResult tr;
            try { tr = await tool.InvokeAsync(argsJson, ctx, ct); }
            catch (Exception ex) { tr = new ToolResult("{}", false, ex.Message); }
            sw.Stop();

            outputs.Add(new ToolOutput(fn.Id, tr.ResultJson));
            executed.Add(new ToolCallExecuted(tool.Id, argsJson, tr.ResultJson, sw.ElapsedMilliseconds, tr.Success));
        }
        return outputs;
    }

    private async Task<string> ReadAssistantReplyAsync(string threadId, CancellationToken ct)
    {
        // Latest assistant message wins. SDK returns in descending order by default.
        await foreach (var msg in _client.Messages.GetMessagesAsync(threadId, order: ListSortOrder.Descending, cancellationToken: ct))
        {
            if (msg.Role != MessageRole.Agent) continue;
            foreach (var content in msg.ContentItems)
            {
                if (content is MessageTextContent text)
                    return text.Text;
            }
        }
        return "{}";
    }

    private static string BuildSystemInstructions(AgentInvocationRequest req)
    {
        var ontology = req.Agent.OntologyBinding is { Count: > 0 } b
            ? "\n\nOntology entities you may reason over: " + string.Join(", ", b) + "."
            : "";

        var calibration = req.Agent.ConfidenceCalibration is { } c
            ? $"\n\nConfidence guidance: report < {c.LowThreshold:F2} if the evidence is materially ambiguous; "
              + $">= {c.HighThreshold:F2} only when the answer is clear and supported by cited fields."
            : "";

        var toolNote = req.Tools is not null && req.Tools.All.Count > 0
            ? "\n\nYou have access to function-call tools. Use them to fetch data you need before answering. "
              + "Do not invent data when a tool can provide it."
            : "";

        return $$"""
            {{req.Agent.SystemPrompt}}{{ontology}}{{calibration}}{{toolNote}}

            When you have enough information to answer, respond with a single JSON object in this exact shape:
            {
              "output": "<1-3 sentence summary of your decision or extracted result>",
              "confidence": <number between 0 and 1>,
              "citedSources": ["<source identifier 1>", "<source identifier 2>", ...]
            }

            "citedSources" identifies what you actually used to reach your decision. Use:
              - Knowledge document IDs (e.g. PAC-COV-001) when you relied on the knowledge section.
              - Specific input field names (e.g. claim.policy.coverages) when you relied on the claim data.
              - Tool names (e.g. tool.adjuster-roster) when you relied on a tool result.
              - Previous step labels (e.g. coverage-verification) when you relied on a prior agent's conclusion.
            If you reasoned without grounding in any provided source, return an empty array. Do not invent citations.
            Do not include any text outside the JSON object.
            """;
    }

    private static string BuildUserMessage(AgentInvocationRequest req)
    {
        var contextBlock = req.ContextSnippets.Count == 0
            ? "(no additional context provided)"
            : string.Join("\n", req.ContextSnippets.Select(kv => $"### {kv.Key}\n{kv.Value}"));

        return $"""
            Intent: {req.Intent}
            Subject: {req.SubjectId}

            Input:
            {contextBlock}
            """;
    }

    private static string ToFunctionName(string toolId) => toolId.Replace('.', '_').Replace('-', '_');

    // Foundry agent names: 1-256 chars, letters/digits/_/-/. only.
    private static string NormalizeAgentName(string name)
    {
        var sb = new System.Text.StringBuilder(name.Length);
        foreach (var c in name)
        {
            sb.Append(char.IsLetterOrDigit(c) || c == '_' || c == '-' || c == '.' ? c : '_');
        }
        var result = sb.ToString();
        return result.Length > 256 ? result[..256] : result;
    }

    private sealed record ParsedResponse(string Output, double Confidence, IReadOnlyList<string> CitedSources);

    private static ParsedResponse TryParse(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var output = root.TryGetProperty("output", out var o) ? (o.GetString() ?? raw) : raw;
            var confidence = root.TryGetProperty("confidence", out var c) && c.TryGetDouble(out var cd) ? cd : 0.6;
            var cited = new List<string>();
            if (root.TryGetProperty("citedSources", out var cs) && cs.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in cs.EnumerateArray())
                    if (el.ValueKind == JsonValueKind.String && el.GetString() is { Length: > 0 } s)
                        cited.Add(s);
            }
            return new ParsedResponse(output, confidence, cited);
        }
        catch
        {
            return new ParsedResponse(raw, 0.6, []);
        }
    }
}

public sealed class FoundryAdapterOptions
{
    public string? ProjectEndpoint { get; init; }
    public TokenCredential? Credential { get; init; }
}
