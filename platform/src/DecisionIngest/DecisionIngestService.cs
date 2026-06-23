using System.Text;
using System.Text.Json;
using Azure.Messaging.EventHubs.Consumer;
using Microsoft.Azure.Cosmos;

namespace Adp.DecisionIngest;

// v0 consumer: reads from Event Hubs and upserts each DecisionEvent into Cosmos dw-state container.
// One-shot mode: runs until N events processed or timeout elapsed — perfect for local smoke tests.
// v1+: this becomes a long-running Container Apps service.
public sealed class DecisionIngestService : IAsyncDisposable
{
    public const string DefaultConsumerGroup = "decision-ingest";
    public const string DefaultTopic = "adp-v1-decisions";

    private readonly EventHubConsumerClient _consumer;
    private readonly CosmosClient _cosmos;
    private readonly Container _container;

    public DecisionIngestService(
        string eventHubsConnection,
        string cosmosConnection,
        string databaseName,
        string containerName,
        string topic = DefaultTopic,
        string consumerGroup = DefaultConsumerGroup)
    {
        _consumer = new EventHubConsumerClient(consumerGroup, eventHubsConnection, topic);
        _cosmos = new CosmosClient(cosmosConnection);
        _container = _cosmos.GetContainer(databaseName, containerName);
    }

    public static DecisionIngestService FromEnvironment(string databaseName = "adp", string containerName = "dw-state")
    {
        var ehConn = Environment.GetEnvironmentVariable("AZURE_EVENTHUBS_CONNECTION");
        var cosmosConn = Environment.GetEnvironmentVariable("AZURE_COSMOS_CONNECTION");
        if (string.IsNullOrEmpty(ehConn) || string.IsNullOrEmpty(cosmosConn))
            throw new InvalidOperationException("DecisionIngestService requires AZURE_EVENTHUBS_CONNECTION and AZURE_COSMOS_CONNECTION.");
        return new DecisionIngestService(ehConn, cosmosConn, databaseName, containerName);
    }

    public async Task<IngestReport> RunAsync(int maxEvents, TimeSpan timeout, CancellationToken cancellationToken = default)
    {
        var processed = new List<string>();
        var failed = new List<string>();
        using var timeoutCts = new CancellationTokenSource(timeout);
        using var combined = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        // Read from latest (only events emitted after we start) — matches v0 smoke-test pattern.
        var readOptions = new ReadEventOptions
        {
            MaximumWaitTime = TimeSpan.FromSeconds(2),
        };

        try
        {
            await foreach (var partitionEvent in _consumer.ReadEventsAsync(startReadingAtEarliestEvent: false, readOptions, combined.Token))
            {
                if (partitionEvent.Data is null) continue;

                var bodyBytes = partitionEvent.Data.EventBody.ToArray();
                var json = Encoding.UTF8.GetString(bodyBytes);
                DecisionEvent? evt;
                try { evt = JsonSerializer.Deserialize<DecisionEvent>(json); }
                catch (JsonException ex) { failed.Add($"deserialize: {ex.Message}"); continue; }

                if (evt is null) { failed.Add("null event"); continue; }

                try
                {
                    await UpsertAsync(evt, combined.Token);
                    processed.Add(evt.DecisionId);
                    if (processed.Count >= maxEvents) break;
                }
                catch (Exception ex)
                {
                    failed.Add($"upsert {evt.DecisionId}: {ex.Message}");
                }
            }
        }
        catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
        {
            // Timeout — expected for v0 demo. Return what we have.
        }

        return new IngestReport(processed.Count, failed.Count, processed, failed);
    }

    private async Task UpsertAsync(DecisionEvent evt, CancellationToken cancellationToken)
    {
        // id is unique per step+trace; partition key is subjectId (claim number).
        // Idempotent: replaying the same event re-upserts the same document.
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

    public async ValueTask DisposeAsync()
    {
        await _consumer.DisposeAsync();
        _cosmos.Dispose();
    }
}

public sealed record IngestReport(
    int EventsProcessed,
    int EventsFailed,
    IReadOnlyList<string> ProcessedDecisionIds,
    IReadOnlyList<string> Errors);
