using System.Diagnostics;

namespace Adp.Agents;

// Deterministic stub adapter. No LLM call. No domain logic.
// Produces a confidence per (subjectId, agentId) that is reproducible across runs.
// Optionally forces a single step into a low-confidence "needs-review" range to demo the HITL gate.
public sealed class StubAdapter(StubAdapterOptions? options = null) : IAgentAdapter
{
    private readonly StubAdapterOptions _options = options ?? new StubAdapterOptions();

    public Task<AgentInvocationResult> InvokeAsync(
        AgentInvocationRequest request,
        CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();

        // Deterministic confidence: stable across runs given the same (subjectId, agentId).
        var seed = StableHash(request.SubjectId + "|" + request.Agent.Id);
        var pseudo = seed / (double)int.MaxValue; // 0..1
        var confidence = 0.78 + (pseudo * 0.17);   // baseline range 0.78..0.95

        var origin = "GROUNDED";

        // Demo hook: if this agent is the configured "force low confidence" target,
        // emit confidence just below its lowThreshold and mark DERIVED so the HITL gate trips.
        var lowThreshold = request.Agent.ConfidenceCalibration?.LowThreshold ?? 0.6;
        if (_options.ForceLowConfidenceForAgentId is { Length: > 0 } targetId
            && string.Equals(request.Agent.Id, targetId, StringComparison.Ordinal))
        {
            confidence = Math.Max(0.0, lowThreshold - 0.06);
            origin = "DERIVED";
        }

        sw.Stop();
        var output = BuildStubOutput(request, confidence);
        return Task.FromResult(new AgentInvocationResult(
            AgentId: request.Agent.Id,
            Output: output,
            Confidence: Math.Round(confidence, 2),
            Origin: origin,
            ElapsedMilliseconds: sw.ElapsedMilliseconds + 1));  // +1 so it never reads zero
    }

    private static string BuildStubOutput(AgentInvocationRequest req, double confidence)
    {
        var summary = $"stub adapter: {req.Agent.Kind} produced response for capability '{req.Agent.Capability}' on subject '{req.SubjectId}' (confidence {confidence:F2}).";
        if (req.Agent.OntologyBinding is { Count: > 0 } bound)
        {
            summary += $" Ontology entities considered: {string.Join(", ", bound)}.";
        }
        return summary;
    }

    private static int StableHash(string s)
    {
        // FNV-1a 32-bit. Stable across runs and CLR versions, unlike string.GetHashCode.
        unchecked
        {
            const uint offset = 2166136261;
            const uint prime = 16777619;
            uint h = offset;
            foreach (var c in s)
            {
                h ^= c;
                h *= prime;
            }
            return (int)(h & 0x7FFFFFFF);
        }
    }
}

public sealed class StubAdapterOptions
{
    /// <summary>If set, the named agent will return confidence just below its lowThreshold (and origin=DERIVED). Used by demos to open a HITL gate deterministically.</summary>
    public string? ForceLowConfidenceForAgentId { get; init; }
}
