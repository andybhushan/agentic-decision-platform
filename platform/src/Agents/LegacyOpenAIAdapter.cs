using System.ClientModel;
using System.Diagnostics;
using System.Text.Json;
using Azure.AI.OpenAI;
using OpenAI.Chat;
using Adp.ToolRuntime;

namespace Adp.Agents;

// Real LLM-backed adapter. Calls Azure OpenAI gpt-4o directly (reuses dt-navigator-openai).
// Supports tool calling: if the request carries an IToolRegistry, tools are exposed to the model
// and dispatched in a loop until the model returns a final answer.
public sealed class LegacyOpenAIAdapter(LegacyOpenAIAdapterOptions options) : IAgentAdapter
{
    private const int MaxToolCallIterations = 4;

    private readonly AzureOpenAIClient _client = new(
        new Uri(options.Endpoint ?? throw new ArgumentException("AZURE_OPENAI_ENDPOINT not set")),
        new ApiKeyCredential(options.ApiKey ?? throw new ArgumentException("AZURE_OPENAI_API_KEY not set")));

    public static LegacyOpenAIAdapter FromEnvironment()
    {
        var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException(
                "LegacyOpenAIAdapter requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY environment variables.");
        return new LegacyOpenAIAdapter(new LegacyOpenAIAdapterOptions { Endpoint = endpoint, ApiKey = apiKey });
    }

    public async Task<AgentInvocationResult> InvokeAsync(
        AgentInvocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();
        var executed = new List<ToolCallExecuted>();

        var deployment = request.Agent.FoundryModel ?? "gpt-4o";
        var chat = _client.GetChatClient(deployment);

        var systemMessage = BuildSystemMessage(request);
        var userMessage = BuildUserMessage(request);

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemMessage),
            new UserChatMessage(userMessage),
        };

        var chatOptions = new ChatCompletionOptions
        {
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat(),
            Temperature = 0.2f,
            MaxOutputTokenCount = 1200,
        };

        var toolByFnName = new Dictionary<string, IMcpTool>(StringComparer.Ordinal);
        if (request.Tools is not null)
        {
            foreach (var tool in request.Tools.All)
            {
                var fnName = ToFunctionName(tool.Id);
                toolByFnName[fnName] = tool;
                chatOptions.Tools.Add(ChatTool.CreateFunctionTool(
                    functionName: fnName,
                    functionDescription: tool.Description,
                    functionParameters: BinaryData.FromString(tool.ParametersJsonSchema)));
            }
        }

        ChatCompletion? completion = null;
        try
        {
            for (int iteration = 0; iteration < MaxToolCallIterations; iteration++)
            {
                completion = await chat.CompleteChatAsync(messages, chatOptions, cancellationToken);
                if (completion.FinishReason != ChatFinishReason.ToolCalls) break;
                if (completion.ToolCalls.Count == 0) break;

                messages.Add(new AssistantChatMessage(completion));
                foreach (var call in completion.ToolCalls)
                {
                    var toolStart = Stopwatch.StartNew();
                    if (!toolByFnName.TryGetValue(call.FunctionName, out var tool))
                    {
                        messages.Add(new ToolChatMessage(call.Id, "{\"error\":\"unknown tool\"}"));
                        executed.Add(new ToolCallExecuted(call.FunctionName, call.FunctionArguments.ToString(), "unknown tool", toolStart.ElapsedMilliseconds, false));
                        continue;
                    }

                    var argsJson = call.FunctionArguments.ToString();
                    var ctx = new ToolInvocationContext(request.SubjectId, request.Agent.Id, request.ContextSnippets);

                    ToolResult tr;
                    try { tr = await tool.InvokeAsync(argsJson, ctx, cancellationToken); }
                    catch (Exception ex) { tr = new ToolResult("{}", false, ex.Message); }
                    toolStart.Stop();

                    messages.Add(new ToolChatMessage(call.Id, tr.ResultJson));
                    executed.Add(new ToolCallExecuted(tool.Id, argsJson, tr.ResultJson, toolStart.ElapsedMilliseconds, tr.Success));
                }
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new AgentInvocationResult(
                AgentId: request.Agent.Id,
                Output: $"LLM call failed: {ex.Message}",
                Confidence: 0.0,
                Origin: "DERIVED",
                ElapsedMilliseconds: sw.ElapsedMilliseconds,
                ToolCallsExecuted: executed);
        }

        sw.Stop();

        var rawText = completion?.Content.Count > 0 ? completion.Content[0].Text : "{}";
        var parsed = TryParse(rawText);

        // Provenance: GROUNDED if the model cited sources OR if it called a successful tool.
        var origin = (parsed.CitedSources.Count > 0 || executed.Any(e => e.Success)) ? "GROUNDED" : "DERIVED";

        var structured = new Dictionary<string, string>();
        if (parsed.CitedSources.Count > 0) structured["citedSources"] = string.Join(", ", parsed.CitedSources);
        if (executed.Count > 0) structured["toolsCalled"] = string.Join(", ", executed.Select(e => e.ToolId).Distinct());

        return new AgentInvocationResult(
            AgentId: request.Agent.Id,
            Output: parsed.Output,
            Confidence: Math.Clamp(parsed.Confidence, 0.0, 1.0),
            Origin: origin,
            ElapsedMilliseconds: sw.ElapsedMilliseconds,
            StructuredFields: structured.Count > 0 ? structured : null,
            ToolCallsExecuted: executed.Count > 0 ? executed : null);
    }

    // OpenAI function names allow [A-Za-z0-9_-]. Map dots from our tool IDs to underscores.
    private static string ToFunctionName(string toolId) => toolId.Replace('.', '_').Replace('-', '_');

    private static string BuildSystemMessage(AgentInvocationRequest req)
    {
        var ontology = req.Agent.OntologyBinding is { Count: > 0 } b
            ? "\n\nOntology entities you may reason over: " + string.Join(", ", b) + "."
            : "";

        var calibration = req.Agent.ConfidenceCalibration is { } c
            ? $"\n\nConfidence guidance: report < {c.LowThreshold:F2} if the evidence is materially ambiguous; "
              + $"≥ {c.HighThreshold:F2} only when the answer is clear and supported by cited fields."
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
              - Knowledge document IDs (e.g. PAC-COV-001) when you relied on the ### knowledge ### section.
              - Specific input field names (e.g. claim.policy.coverages) when you relied on the claim data.
              - Tool names (e.g. tool.adjuster-roster) when you relied on a tool result.
              - Previous step labels (e.g. coverage-verification) when you relied on a prior agent's conclusion.
            If you reasoned without grounding in any provided source, return an empty array — DO NOT invent citations.
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

public sealed class LegacyOpenAIAdapterOptions
{
    public string? Endpoint { get; init; }
    public string? ApiKey { get; init; }
}
