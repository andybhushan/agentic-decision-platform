using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.Agents;
using Adp.ContextLayer;
using Adp.DecisionIngest;
using Adp.Orchestration;
using Adp.ToolRuntime;

namespace Adp.TracesApi.Functions;

// Runs ONE agent step via StepRunner. Persists the resulting DecisionEvent to both Cosmos (DwStateWriter)
// and SignalR (SignalRStepSink) via a CompositeDecisionSink so the console gets the live tail.
//
// If FORCE_HITL_AT_AGENT_ID env var matches the agent being run, the activity post-processes the
// StepRunResult to force a low-confidence/needs-human-review status — useful for reliable HITL demos.
public sealed class RunStepActivity(
    AdapterRegistry adapters,
    IContextRouter contextRouter,
    IToolRegistry toolRegistry,
    DwStateWriter dwWriter,
    Lazy<Task<SignalRStepSink?>> signalRSinkLazy,
    ILogger<RunStepActivity> logger)
{
    [Function(nameof(RunStepActivity))]
    public async Task<StepActivityResult> Run(
        [ActivityTrigger] StepActivityInput input,
        CancellationToken cancellationToken)
    {
        logger.LogInformation("RunStepActivity trace={TraceId} step={StepIndex} subject={SubjectId} backend={Backend}",
            input.TraceId, input.StepIndex, input.SubjectId, input.Backend ?? adapters.DefaultName);

        var pkg = PlanExecutor.LoadPackage(input.ArtifactPath);

        // Per-run runtime selection: the run names its backend or rides the AGENT_BACKEND default.
        var adapter = adapters.Resolve(input.Backend);
        var runner = new StepRunner(adapter, contextRouter, toolRegistry);
        var result = await runner.RunStepAsync(
            pkg,
            input.StepIndex,
            input.SubjectId,
            input.TraceId,
            input.ClaimJson,
            input.PreviousSteps,
            cancellationToken);

        // Forced-HITL demo override: if the agent matches FORCE_HITL_AT_AGENT_ID, downgrade.
        var forced = Environment.GetEnvironmentVariable("FORCE_HITL_AT_AGENT_ID") ?? input.ForceHitlAtAgentId;
        var step = result.Step;
        var evt = result.Event;
        if (!string.IsNullOrEmpty(forced) && string.Equals(step.AgentId, forced, StringComparison.Ordinal))
        {
            logger.LogWarning("forced HITL on agent {AgentId}", step.AgentId);
            var agent = pkg.Agents.FirstOrDefault(a => a.Id == step.AgentId)
                        ?? throw new InvalidOperationException($"agent {step.AgentId} not found");
            var lowThreshold = agent.ConfidenceCalibration?.LowThreshold ?? 0.6;
            var forcedConf = Math.Max(0, lowThreshold - 0.1);
            step = step with
            {
                Confidence = forcedConf,
                Status = "needs-human-review",
                Origin = "DERIVED",
                HitlGateId = pkg.DigitalWorker.Orchestration.HitlGates?.FirstOrDefault()?.GateId ?? "gate.forced-demo",
                Output = step.Output + "  [forced-hitl demo]",
            };
            evt = evt with
            {
                Confidence = step.Confidence,
                Status = step.Status,
                Origin = step.Origin,
                HitlGateId = step.HitlGateId,
                OutputSummary = step.Output.Length > 500 ? step.Output[..500] + "…" : step.Output,
            };
        }

        // Composite write: Cosmos + SignalR
        var signalR = await signalRSinkLazy.Value;
        IDecisionSink sink = signalR is null
            ? dwWriter
            : new CompositeDecisionSink([dwWriter, signalR]);

        try { await sink.PublishAsync(evt, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "decision publish failed for step {StepId}", step.StepId); }

        return new StepActivityResult(step);
    }
}

public sealed record StepActivityInput(
    string TraceId,
    string SubjectId,
    string ArtifactPath,
    string ClaimJson,
    int StepIndex,
    IReadOnlyList<TraceStep> PreviousSteps,
    string? ForceHitlAtAgentId,
    string? Backend = null);

public sealed record StepActivityResult(TraceStep Step);
