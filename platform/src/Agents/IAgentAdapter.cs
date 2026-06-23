using Adp.PackageModel;
using Adp.ToolRuntime;

namespace Adp.Agents;

// Platform-level adapter. Knows nothing about the domain.
// One implementation talks to Foundry (real chat completion + function calling); another returns deterministic stub outputs (dev).
public interface IAgentAdapter
{
    Task<AgentInvocationResult> InvokeAsync(
        AgentInvocationRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record AgentInvocationRequest(
    AgentSpec Agent,
    string SubjectId,
    string Intent,
    IReadOnlyDictionary<string, string> ContextSnippets,
    IToolRegistry? Tools = null);

public sealed record AgentInvocationResult(
    string AgentId,
    string Output,
    double Confidence,
    string Origin,
    long ElapsedMilliseconds,
    IReadOnlyDictionary<string, string>? StructuredFields = null,
    IReadOnlyList<ToolCallExecuted>? ToolCallsExecuted = null);

public sealed record ToolCallExecuted(
    string ToolId,
    string ArgumentsJson,
    string ResultJson,
    long DurationMs,
    bool Success);
