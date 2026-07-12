using System.ClientModel;
using System.Diagnostics;
using System.Text.Json;
using Azure.AI.OpenAI;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Adp.ToolRuntime;

namespace Adp.Agents;

// Microsoft Agent Framework adapter (Wave 2 alternative). Each AgentSpec runs as an in-process
// Agent Framework AIAgent over Azure OpenAI with key auth: the "latest Microsoft agentic stack"
// runtime with zero RBAC dependency. The framework owns the tool-invocation loop; our MCP tools
// are bridged in as AIFunctions and every execution is journaled exactly like the other adapters.
//
// Same prompt/response contract as LegacyOpenAIAdapter (PromptContract), so decision semantics,
// grounding, and confidence calibration are identical across runtimes: only the engine changes.
//
// Activation: AGENT_BACKEND=agent-framework (+ the existing AZURE_OPENAI_ENDPOINT / _API_KEY).
// Complementary to FoundryAdapter, not a replacement: when the Azure AI User role grant lands,
// AGENT_BACKEND=foundry hosts the same agents on Foundry Agent Service.
public sealed class AgentFrameworkAdapter(LegacyOpenAIAdapterOptions options) : IAgentAdapter
{
    private readonly AzureOpenAIClient _client = new(
        new Uri(options.Endpoint ?? throw new ArgumentException("AZURE_OPENAI_ENDPOINT not set")),
        new ApiKeyCredential(options.ApiKey ?? throw new ArgumentException("AZURE_OPENAI_API_KEY not set")));

    public static AgentFrameworkAdapter FromEnvironment()
    {
        var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException(
                "AgentFrameworkAdapter requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY environment variables.");
        return new AgentFrameworkAdapter(new LegacyOpenAIAdapterOptions { Endpoint = endpoint, ApiKey = apiKey });
    }

    public async Task<AgentInvocationResult> InvokeAsync(
        AgentInvocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();
        var executed = new List<ToolCallExecuted>();

        try
        {
            var tools = new List<AITool>();
            if (request.Tools is not null)
            {
                foreach (var tool in request.Tools.All)
                    tools.Add(new McpBridgeFunction(tool, request, executed));
            }

            var deployment = request.Agent.FoundryModel ?? "gpt-4o";
            var agent = new ChatClientAgent(
                _client.GetChatClient(deployment).AsIChatClient(),
                instructions: PromptContract.BuildSystemMessage(request),
                name: PromptContract.ToFunctionName(request.Agent.Id),
                description: request.Agent.Id,
                tools: tools);

            var session = await agent.CreateSessionAsync(cancellationToken);
            var runOptions = new ChatClientAgentRunOptions
            {
                ChatOptions = new ChatOptions
                {
                    ResponseFormat = ChatResponseFormat.Json,
                    Temperature = 0.2f,
                    MaxOutputTokens = 1200,
                },
            };
            var response = await agent.RunAsync(
                [new ChatMessage(ChatRole.User, PromptContract.BuildUserMessage(request))],
                session, runOptions, cancellationToken);
            sw.Stop();

            var parsed = PromptContract.TryParse(response.Text ?? "{}");

            // Provenance: GROUNDED if the model cited sources OR if it called a successful tool.
            var origin = (parsed.CitedSources.Count > 0 || executed.Any(e => e.Success)) ? "GROUNDED" : "DERIVED";

            var structured = new Dictionary<string, string> { ["runtime"] = "microsoft-agent-framework" };
            if (parsed.CitedSources.Count > 0) structured["citedSources"] = string.Join(", ", parsed.CitedSources);
            if (executed.Count > 0) structured["toolsCalled"] = string.Join(", ", executed.Select(e => e.ToolId).Distinct());

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
                Output: $"Agent Framework run failed: {ex.Message}",
                Confidence: 0.0,
                Origin: "DERIVED",
                ElapsedMilliseconds: sw.ElapsedMilliseconds,
                ToolCallsExecuted: executed.Count > 0 ? executed : null);
        }
    }

    // Bridges one MCP tool into the framework's tool loop. The framework decides when to call;
    // we execute through IToolRegistry semantics and journal every call with timing + success.
    private sealed class McpBridgeFunction(
        IMcpTool tool, AgentInvocationRequest request, List<ToolCallExecuted> executed) : AIFunction
    {
        public override string Name { get; } = PromptContract.ToFunctionName(tool.Id);
        public override string Description => tool.Description;
        public override JsonElement JsonSchema { get; } = JsonDocument.Parse(tool.ParametersJsonSchema).RootElement.Clone();

        protected override async ValueTask<object?> InvokeCoreAsync(
            AIFunctionArguments arguments, CancellationToken cancellationToken)
        {
            var toolSw = Stopwatch.StartNew();
            var argsJson = JsonSerializer.Serialize(arguments.ToDictionary(kv => kv.Key, kv => kv.Value));
            var ctx = new ToolInvocationContext(request.SubjectId, request.Agent.Id, request.ContextSnippets);

            ToolResult tr;
            try { tr = await tool.InvokeAsync(argsJson, ctx, cancellationToken); }
            catch (Exception ex) { tr = new ToolResult("{}", false, ex.Message); }
            toolSw.Stop();

            lock (executed)
            {
                executed.Add(new ToolCallExecuted(tool.Id, argsJson, tr.ResultJson, toolSw.ElapsedMilliseconds, tr.Success));
            }
            return JsonSerializer.Deserialize<JsonElement>(tr.ResultJson);
        }
    }
}
