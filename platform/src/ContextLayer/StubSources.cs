namespace Adp.ContextLayer;

// Fabric IQ and Work IQ — stubbed in v0. Architecture supports them; implementations land in v1.

public sealed class StubFabricIqSource : IContextSource
{
    public string SourceId => "FabricIQ";
    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Entity, ContextDimension.Temporal,
    ];
    public Task<IReadOnlyList<ContextFragment>> QueryAsync(ContextRequest request, int topK, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<ContextFragment>>([]);
}

public sealed class StubWorkIqSource : IContextSource
{
    public string SourceId => "WorkIQ";
    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Collaboration,
    ];
    public Task<IReadOnlyList<ContextFragment>> QueryAsync(ContextRequest request, int topK, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<ContextFragment>>([]);
}
