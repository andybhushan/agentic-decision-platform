using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// Applies the operator's HITL resolution to a paused step. Writes the resolved step back to Cosmos
// and pushes a SignalR update so the console flips the step from needs-human-review to completed.
public sealed class ResolveHitlActivity(
    DwStateWriter dwWriter,
    Lazy<Task<SignalRStepSink?>> signalRSinkLazy,
    ILogger<ResolveHitlActivity> logger)
{
    [Function(nameof(ResolveHitlActivity))]
    public async Task<StepActivityResult> Run(
        [ActivityTrigger] ResolveHitlActivityInput input,
        CancellationToken cancellationToken)
    {
        logger.LogInformation("ResolveHitl trace={TraceId} step={StepId} option={OptionId}", input.TraceId, input.BlockedStep.StepId, input.Resolution.OptionId);

        var pkg = PlanExecutor.LoadPackage(input.ArtifactPath);
        var pkgMeta = pkg;

        // Apply the override to the blocked step.
        var resolved = input.BlockedStep with
        {
            Status = "completed",
            Confidence = Math.Max(input.BlockedStep.Confidence, 0.93),
            Origin = "GROUNDED",
            Output = $"{input.Resolution.OverrideOutput}  (HITL resolved via {input.Resolution.OptionId})",
        };

        var sloSnapshots = pkgMeta.DigitalWorker.Slos.Select(s => new SloSnapshot(
            Metric: s.Metric,
            Target: $"{s.Comparator} {s.Target}",
            Window: s.Window)).ToList();

        var evt = new DecisionEvent(
            DecisionId: $"{input.TraceId}/{resolved.StepId}",
            TraceId: input.TraceId,
            SubjectId: input.SubjectId,
            DigitalWorkerId: pkgMeta.DigitalWorker.Id,
            PackageId: pkgMeta.Package.Id,
            PackageVersion: pkgMeta.Package.Version,
            PackageSchemaVersion: pkgMeta.Package.SchemaVersion,
            AgentCount: pkgMeta.Agents.Count,
            SkillCount: pkgMeta.Skills.Count,
            ToolCount: pkgMeta.Tools.Count,
            StepId: resolved.StepId,
            StepLabel: resolved.Label,
            AgentId: resolved.AgentId,
            Confidence: resolved.Confidence,
            Status: resolved.Status,
            Origin: resolved.Origin,
            OutputSummary: resolved.Output.Length > 500 ? resolved.Output[..500] + "…" : resolved.Output,
            HitlGateId: resolved.HitlGateId,
            ToolCallCount: resolved.ToolCalls?.Count ?? 0,
            DurationMs: resolved.DurationMs,
            Slos: sloSnapshots,
            EmittedAt: DateTimeOffset.UtcNow);

        var signalR = await signalRSinkLazy.Value;
        IDecisionSink sink = signalR is null
            ? dwWriter
            : new CompositeDecisionSink([dwWriter, signalR]);

        try { await sink.PublishAsync(evt, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "resolve-hitl publish failed for step {StepId}", resolved.StepId); }

        return new StepActivityResult(resolved);
    }
}

public sealed record ResolveHitlActivityInput(
    string TraceId,
    string SubjectId,
    string ArtifactPath,
    TraceStep BlockedStep,
    HitlResolution Resolution);

public sealed record HitlResolution(
    string OptionId,
    string OverrideOutput,
    DateTimeOffset ResolvedAt);
