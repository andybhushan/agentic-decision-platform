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

        var systemMessage = PromptContract.BuildSystemMessage(request);
        var userMessage = PromptContract.BuildUserMessage(request);

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
                var fnName = PromptContract.ToFunctionName(tool.Id);
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
        var parsed = PromptContract.TryParse(rawText);

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

}

public sealed class LegacyOpenAIAdapterOptions
{
    public string? Endpoint { get; init; }
    public string? ApiKey { get; init; }
}
