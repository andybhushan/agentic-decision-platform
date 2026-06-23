using Microsoft.Azure.Cosmos;

namespace Adp.DecisionIngest;

// Read-side helper for the dw-state container. Used by `adpc show-state` for verification,
// and by the TracesApi Function for the operator console's trace-fetch endpoint.
public sealed class DwStateReader : IDisposable
{
    private readonly CosmosClient _cosmos;
    private readonly Container _container;

    public DwStateReader(string cosmosConnection, string databaseName = "adp", string containerName = "dw-state")
    {
        _cosmos = new CosmosClient(cosmosConnection);
        _container = _cosmos.GetContainer(databaseName, containerName);
    }

    public static DwStateReader FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("AZURE_COSMOS_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("DwStateReader requires AZURE_COSMOS_CONNECTION.");
        return new DwStateReader(conn);
    }

    public async Task<IReadOnlyList<DwStateRow>> ListBySubjectAsync(string subjectId, CancellationToken cancellationToken = default)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.subjectId = @subjectId ORDER BY c.stepId ASC")
            .WithParameter("@subjectId", subjectId);

        var iterator = _container.GetItemQueryIterator<DwStateRow>(
            query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(subjectId) });

        var rows = new List<DwStateRow>();
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            rows.AddRange(page);
        }
        return rows;
    }

    // Track 6: aggregate outcomes across runs in a recent window. Used by the operator console's
    // "Today's outcomes" panel + the docs portal's live status section.
    public async Task<OutcomesAggregate> AggregateAsync(TimeSpan window, CancellationToken cancellationToken = default)
    {
        var since = DateTimeOffset.UtcNow.Subtract(window);
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.emittedAt >= @since")
            .WithParameter("@since", since.ToString("o"));

        var iterator = _container.GetItemQueryIterator<DwStateRow>(query);
        var rows = new List<DwStateRow>();
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            rows.AddRange(page);
        }

        // Per-subject roll-up: identify completed claim runs vs HITL-paused.
        var distinctSubjects = rows.Select(r => r.SubjectId).Where(s => !string.IsNullOrEmpty(s)).Distinct(StringComparer.Ordinal).Count();
        var distinctTraces = rows.Select(r => r.TraceId).Where(t => !string.IsNullOrEmpty(t)).Distinct(StringComparer.Ordinal).Count();
        var totalSteps = rows.Count;
        var hitlSteps = rows.Count(r => string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal));
        var completedSteps = rows.Count(r => string.Equals(r.Status, "completed", StringComparison.Ordinal));
        var groundedSteps = rows.Count(r => string.Equals(r.Origin, "GROUNDED", StringComparison.Ordinal));

        // Per-package count
        var byPackage = rows
            .Where(r => !string.IsNullOrEmpty(r.PackageId))
            .GroupBy(r => r.PackageId!, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Select(r => r.TraceId).Distinct().Count(), StringComparer.Ordinal);

        var avgConfidence = rows.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).DefaultIfEmpty(0).Average();
        var avgStepMs = rows.Where(r => r.DurationMs.HasValue).Select(r => r.DurationMs!.Value).DefaultIfEmpty(0).Average();

        return new OutcomesAggregate(
            WindowHours: window.TotalHours,
            ClaimsHandled: distinctSubjects,
            TracesRecorded: distinctTraces,
            StepsTotal: totalSteps,
            StepsCompleted: completedSteps,
            StepsNeedingHumanReview: hitlSteps,
            GroundedStepRate: totalSteps == 0 ? 0 : Math.Round((double)groundedSteps / totalSteps, 3),
            AvgConfidence: Math.Round(avgConfidence, 3),
            AvgStepDurationMs: Math.Round(avgStepMs, 0),
            RunsByPackage: byPackage);
    }

    public void Dispose() => _cosmos.Dispose();
}

public sealed record OutcomesAggregate(
    double WindowHours,
    int ClaimsHandled,
    int TracesRecorded,
    int StepsTotal,
    int StepsCompleted,
    int StepsNeedingHumanReview,
    double GroundedStepRate,
    double AvgConfidence,
    double AvgStepDurationMs,
    IReadOnlyDictionary<string, int> RunsByPackage);

// All fields stored in the Cosmos dw-state container. Mirrors DecisionEvent plus ingestion metadata.
public sealed record DwStateRow(
    string Id,
    string? SubjectId,
    string? TraceId,
    string? StepId,
    string? StepLabel,
    string? AgentId,
    string? DigitalWorkerId,
    string? PackageId,
    string? PackageVersion,
    string? PackageSchemaVersion,
    int? AgentCount,
    int? SkillCount,
    int? ToolCount,
    double? Confidence,
    string? Status,
    string? Origin,
    string? OutputSummary,
    string? HitlGateId,
    int? ToolCallCount,
    long? DurationMs,
    IReadOnlyList<SloSnapshot>? Slos,
    DateTimeOffset? EmittedAt,
    DateTimeOffset? IngestedAt,
    // v1.1: ontology + regulatory + cited-source flat lists round-tripped through Cosmos.
    // Match the flat shape on DecisionEvent — full citation objects live on the trace itself.
    IReadOnlyList<string>? CitedSources = null,
    IReadOnlyList<string>? OntologyBindings = null,
    IReadOnlyList<string>? RegulatoryBasis = null);
