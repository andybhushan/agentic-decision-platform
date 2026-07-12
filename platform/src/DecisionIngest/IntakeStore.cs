using Microsoft.Azure.Cosmos;

namespace Adp.DecisionIngest;

// Durable store for subjects that entered the platform at runtime (an intake submission)
// rather than from a bundled corpus. Platform-generic: a row is "a subject record for an
// industry"; what the record means belongs to the use case. Container is created on first
// use so no infra change is needed.
public sealed class IntakeStore : IDisposable
{
    private readonly CosmosClient _cosmos;
    private readonly Database _database;
    private Container? _container;

    public IntakeStore(string cosmosConnection, string databaseName = "adp")
    {
        _cosmos = new CosmosClient(cosmosConnection);
        _database = _cosmos.GetDatabase(databaseName);
    }

    public static IntakeStore FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("AZURE_COSMOS_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("IntakeStore requires AZURE_COSMOS_CONNECTION.");
        return new IntakeStore(conn);
    }

    private async Task<Container> EnsureContainerAsync(CancellationToken cancellationToken)
    {
        if (_container is not null) return _container;
        var resp = await _database.CreateContainerIfNotExistsAsync(
            new ContainerProperties("intake", "/subjectId"), cancellationToken: cancellationToken);
        _container = resp.Container;
        return _container;
    }

    public async Task UpsertAsync(IntakeDoc doc, CancellationToken cancellationToken = default)
    {
        var container = await EnsureContainerAsync(cancellationToken);
        // Anonymous lowercase shape: Cosmos requires a lowercase "id" and the SDK's default
        // serializer would write the record's properties PascalCase (same pattern as DwStateWriter).
        var item = new
        {
            id = doc.Id,
            subjectId = doc.SubjectId,
            industry = doc.Industry,
            useCase = doc.UseCase,
            channel = doc.Channel,
            receivedAt = doc.ReceivedAt,
            recordJson = doc.RecordJson,
        };
        await container.UpsertItemAsync(item, new PartitionKey(doc.SubjectId), cancellationToken: cancellationToken);
    }

    public async Task<IntakeDoc?> GetAsync(string subjectId, CancellationToken cancellationToken = default)
    {
        var container = await EnsureContainerAsync(cancellationToken);
        try
        {
            var resp = await container.ReadItemAsync<IntakeDoc>(
                subjectId, new PartitionKey(subjectId), cancellationToken: cancellationToken);
            return resp.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<IntakeDoc>> ListAsync(string? industry = null, CancellationToken cancellationToken = default)
    {
        var container = await EnsureContainerAsync(cancellationToken);
        var query = industry is null
            ? new QueryDefinition("SELECT * FROM c")
            : new QueryDefinition("SELECT * FROM c WHERE c.industry = @industry").WithParameter("@industry", industry);
        var iterator = container.GetItemQueryIterator<IntakeDoc>(query);
        var docs = new List<IntakeDoc>();
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(cancellationToken);
            docs.AddRange(page);
        }
        return docs;
    }

    public void Dispose() => _cosmos.Dispose();
}

// RecordJson is the use case's own record shape, stored verbatim as a JSON string
// (the Cosmos SDK's default serializer round-trips strings safely).
public sealed record IntakeDoc(
    string Id,
    string SubjectId,
    string Industry,
    string? UseCase,
    string? Channel,
    DateTimeOffset ReceivedAt,
    string RecordJson);
