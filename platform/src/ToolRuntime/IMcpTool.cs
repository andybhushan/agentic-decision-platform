namespace Adp.ToolRuntime;

// Platform-level tool contract. Each registered tool can be called by an agent during reasoning.
// v0 implementations are in-process; v1+ swaps for real MCP-over-stdio servers.

public interface IMcpTool
{
    /// <summary>Canonical tool ID — matches the EA package's tools[].id. May contain dots.</summary>
    string Id { get; }

    /// <summary>Human description shown to the LLM.</summary>
    string Description { get; }

    /// <summary>JSON Schema (Draft 2020-12) describing the arguments object.</summary>
    string ParametersJsonSchema { get; }

    /// <summary>Invoke the tool. Receives args as a JSON object string; returns a JSON-shaped result string.</summary>
    Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default);
}

public sealed record ToolInvocationContext(
    string SubjectId,
    string AgentId,
    IReadOnlyDictionary<string, string> AmbientContext);

public sealed record ToolResult(string ResultJson, bool Success, string? ErrorMessage = null);

public interface IToolRegistry
{
    IReadOnlyCollection<IMcpTool> All { get; }
    IMcpTool? GetById(string id);
    Task<ToolResult> InvokeAsync(string toolId, string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default);
}

public sealed class ToolRegistry : IToolRegistry
{
    private readonly Dictionary<string, IMcpTool> _byId = new(StringComparer.Ordinal);
    public IReadOnlyCollection<IMcpTool> All => _byId.Values;

    public void Register(IMcpTool tool) => _byId[tool.Id] = tool;

    public IMcpTool? GetById(string id) => _byId.TryGetValue(id, out var t) ? t : null;

    public Task<ToolResult> InvokeAsync(string toolId, string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var tool = GetById(toolId);
        if (tool is null)
            return Task.FromResult(new ToolResult("{}", false, $"Unknown tool '{toolId}'"));
        return tool.InvokeAsync(argumentsJson, context, cancellationToken);
    }
}
