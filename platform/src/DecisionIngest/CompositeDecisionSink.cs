namespace Adp.DecisionIngest;

// Fans a DecisionEvent out to multiple sinks. Each sink is awaited in order; if any throws,
// remaining sinks still get the event (best-effort fanout) and the first error is rethrown.
// Used by the Durable activity: writes to Cosmos AND pushes to SignalR for the live tail.
public sealed class CompositeDecisionSink(IReadOnlyList<IDecisionSink> sinks) : IDecisionSink
{
    private readonly IReadOnlyList<IDecisionSink> _sinks = sinks;

    public async Task PublishAsync(DecisionEvent evt, CancellationToken cancellationToken = default)
    {
        Exception? firstError = null;
        foreach (var sink in _sinks)
        {
            try { await sink.PublishAsync(evt, cancellationToken); }
            catch (Exception ex) { firstError ??= ex; }
        }
        if (firstError is not null) throw firstError;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var sink in _sinks)
        {
            try { await sink.DisposeAsync(); }
            catch { /* best-effort */ }
        }
    }
}
