namespace Adp.DecisionIngest;

// Where a DecisionEvent goes when PlanExecutor emits it.
// Two implementations: EventHubs (CLI, local dev) and Cosmos direct (Durable activity in Azure).
// Both implementations are idempotent: replaying the same DecisionEvent (same decisionId) is safe.
public interface IDecisionSink : IAsyncDisposable
{
    Task PublishAsync(DecisionEvent evt, CancellationToken cancellationToken = default);
}
