using Microsoft.Azure.Cosmos;

namespace Adp.DecisionIngest;

// Cosmos-direct decision sink. Used by the Durable Function activity in Azure where there is no
// Event Hubs ↔ Decision-Ingest consumer in the path. Writes the same document shape that
// DecisionIngestService.UpsertAsync would write — DwStateReader / TracesApi reads them the same way.
public sealed class DwStateWriter : IDecisionSink
{
    private readonly CosmosClient _cosmos;
    private readonly Container _container;

    public DwStateWriter(string cosmosConnection, string databaseName = "adp", string containerName = "dw-state")
    {
        _cosmos = new CosmosClient(cosmosConnection);
        _container = _cosmos.GetContainer(databaseName, containerName);
    }

    public static DwStateWriter FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("AZURE_COSMOS_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("DwStateWriter requires AZURE_COSMOS_CONNECTION.");
        return new DwStateWriter(conn);
    }

    public async Task PublishAsync(DecisionEvent evt, CancellationToken cancellationToken = default)
    {
        var doc = new
        {
            id = $"{evt.TraceId}/{evt.StepId}",
            subjectId = evt.SubjectId,
            traceId = evt.TraceId,
            stepId = evt.StepId,
            stepLabel = evt.StepLabel,
            agentId = evt.AgentId,
            digitalWorkerId = evt.DigitalWorkerId,
            packageId = evt.PackageId,
            packageVersion = evt.PackageVersion,
            packageSchemaVersion = evt.PackageSchemaVersion,
            agentCount = evt.AgentCount,
            skillCount = evt.SkillCount,
            toolCount = evt.ToolCount,
            confidence = evt.Confidence,
            status = evt.Status,
            origin = evt.Origin,
            outputSummary = evt.OutputSummary,
            hitlGateId = evt.HitlGateId,
            toolCallCount = evt.ToolCallCount,
            durationMs = evt.DurationMs,
            slos = evt.Slos,
            emittedAt = evt.EmittedAt,
            ingestedAt = DateTimeOffset.UtcNow,
            citedSources = evt.CitedSources,
            ontologyBindings = evt.OntologyBindings,
            regulatoryBasis = evt.RegulatoryBasis,
        };
        await _container.UpsertItemAsync(doc, new PartitionKey(evt.SubjectId), cancellationToken: cancellationToken);
    }

    public ValueTask DisposeAsync()
    {
        _cosmos.Dispose();
        return ValueTask.CompletedTask;
    }
}
