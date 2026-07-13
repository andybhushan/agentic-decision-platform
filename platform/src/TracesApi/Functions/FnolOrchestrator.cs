using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// Durable orchestrator. Per-step loop with HITL pause/resume.
//
// Flow:
//   1. PrepareRunActivity loads pkg + claim once, returns metadata.
//   2. For each agent in the DW:
//        a. RunStepActivity executes the step (LLM + retrieval + tools + Cosmos + SignalR push).
//        b. If status == needs-human-review:
//             - Wait for an external "HitlResolution" event (30-minute timeout).
//             - ResolveHitlActivity applies the operator's override, persists, pushes update.
//   3. Return RunResult to the client.
//
// All side effects are inside activities — orchestrator code is deterministic and replay-safe.
public static class FnolOrchestrator
{
    private static readonly TimeSpan HitlTimeout = TimeSpan.FromMinutes(30);

    [Function(nameof(FnolOrchestrator))]
    public static async Task<RunResult> Run(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var input = context.GetInput<RunInput>()
                    ?? throw new InvalidOperationException("orchestrator received null input");

        var logger = context.CreateReplaySafeLogger(nameof(FnolOrchestrator));
        logger.LogInformation("orchestrator started subject={SubjectId} forceHitlAt={ForceAt}", input.SubjectId, input.ForceHitlAtAgentId ?? "(none)");

        var prep = await context.CallActivityAsync<PrepareResult>(nameof(PrepareRunActivity), input);
        var stepsSoFar = new List<TraceStep>();
        int hitlResolvedCount = 0;

        for (int i = 0; i < prep.AgentRefs.Count; i++)
        {
            var stepInput = new StepActivityInput(
                TraceId: prep.TraceId,
                SubjectId: input.SubjectId,
                ArtifactPath: prep.ArtifactPath,
                ClaimJson: prep.ClaimJson,
                StepIndex: i,
                PreviousSteps: stepsSoFar,
                ForceHitlAtAgentId: input.ForceHitlAtAgentId,
                Backend: input.Backend);

            var stepResult = await context.CallActivityAsync<StepActivityResult>(nameof(RunStepActivity), stepInput);
            stepsSoFar.Add(stepResult.Step);

            if (stepResult.Step.Status == "needs-human-review")
            {
                logger.LogInformation("HITL gate open at step {StepId}; awaiting resolution", stepResult.Step.StepId);

                HitlResolution resolution;
                try
                {
                    resolution = await context.WaitForExternalEvent<HitlResolution>("HitlResolution", HitlTimeout);
                }
                catch (TaskCanceledException)
                {
                    logger.LogWarning("HITL gate timed out after {Timeout}", HitlTimeout);
                    return new RunResult(prep.TraceId, input.SubjectId, input.PackageId, stepsSoFar.Count, HitlGatesOpen: 1, DateTimeOffset.UtcNow);
                }

                var resolveInput = new ResolveHitlActivityInput(
                    TraceId: prep.TraceId,
                    SubjectId: input.SubjectId,
                    ArtifactPath: prep.ArtifactPath,
                    BlockedStep: stepResult.Step,
                    Resolution: resolution);
                var resolved = await context.CallActivityAsync<StepActivityResult>(nameof(ResolveHitlActivity), resolveInput);

                stepsSoFar[i] = resolved.Step;
                hitlResolvedCount++;
                logger.LogInformation("HITL resolved at step {StepId}, continuing", resolved.Step.StepId);
            }
        }

        logger.LogInformation("orchestrator completed trace={TraceId} steps={Steps} hitlResolved={HitlResolved}", prep.TraceId, stepsSoFar.Count, hitlResolvedCount);
        return new RunResult(prep.TraceId, input.SubjectId, input.PackageId, stepsSoFar.Count, HitlGatesOpen: 0, DateTimeOffset.UtcNow);
    }
}

public sealed record RunResult(
    string TraceId,
    string SubjectId,
    string PackageId,
    int StepCount,
    int HitlGatesOpen,
    DateTimeOffset CompletedAt);
