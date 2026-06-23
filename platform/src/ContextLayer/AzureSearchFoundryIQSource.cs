using System.Text.Json.Serialization;
using Azure;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;

namespace Adp.ContextLayer;

// Foundry IQ implementation backed by Azure AI Search.
// Same IContextSource contract as LocalFoundryIQSource — drop-in replacement.
// Index schema is defined in AzureSearchIndexer and must be populated by `adpc index` first.
public sealed class AzureSearchFoundryIQSource(
    AzureSearchOptions options,
    EmbeddingService embeddings) : IContextSource
{
    public const string IndexName = "adp-knowledge";

    private readonly SearchClient _client = new(
        new Uri(options.Endpoint ?? throw new ArgumentException("AZURE_SEARCH_ENDPOINT not set")),
        IndexName,
        new AzureKeyCredential(options.ApiKey ?? throw new ArgumentException("AZURE_SEARCH_API_KEY not set")));

    public static AzureSearchFoundryIQSource FromEnvironment(EmbeddingService embeddings)
    {
        var endpoint = Environment.GetEnvironmentVariable("AZURE_SEARCH_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_SEARCH_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("AzureSearchFoundryIQSource requires AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY.");
        return new AzureSearchFoundryIQSource(new AzureSearchOptions { Endpoint = endpoint, ApiKey = apiKey }, embeddings);
    }

    public string SourceId => "FoundryIQ";

    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Procedural,
        ContextDimension.Regulatory,
        ContextDimension.Historical,
    ];

    public async Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        var query = $"intent: {request.Intent}\nsubject: {request.SubjectId}\ndimensions: {string.Join(", ", request.Dimensions)}";
        var queryEmbedding = await embeddings.EmbedAsync(query, cancellationToken);

        var searchOptions = new SearchOptions
        {
            Size = topK,
            VectorSearch = new VectorSearchOptions
            {
                Queries =
                {
                    new VectorizedQuery(queryEmbedding)
                    {
                        KNearestNeighborsCount = topK,
                        Fields = { "embedding" },
                    },
                },
            },
        };

        // Compose OData filter from dimension-any and (optionally) industry-scoped domain prefix.
        // The `domain` field on indexed docs is "<industry>/<subdomain>/<topic>" so industry scoping
        // is just startswith(domain, 'insurance/'). Without this, cross-industry retrieval would let
        // a banking agent cite Meridian PAC-* docs purely on vector similarity (the original D-WorkIQ
        // observation that prompted the v0.5 factor-out).
        var filterClauses = new List<string>();
        if (request.Dimensions.Count > 0)
        {
            var dimFilters = string.Join(" or ", request.Dimensions.Select(d => $"d eq '{d.ToString().ToLowerInvariant()}'"));
            filterClauses.Add($"dimensions/any(d: {dimFilters})");
        }
        if (!string.IsNullOrEmpty(request.Industry))
        {
            var safeIndustry = request.Industry.Replace("'", "''");
            filterClauses.Add($"industry eq '{safeIndustry}'");
        }
        if (filterClauses.Count > 0)
        {
            searchOptions.Filter = string.Join(" and ", filterClauses);
        }

        searchOptions.Select.Add("docId");
        searchOptions.Select.Add("title");
        searchOptions.Select.Add("content");
        searchOptions.Select.Add("dimensions");
        searchOptions.Select.Add("ontologyBindings");
        searchOptions.Select.Add("regulatoryBasis");

        var results = await _client.SearchAsync<IndexedKnowledgeDoc>(searchText: null, searchOptions, cancellationToken);

        var fragments = new List<ContextFragment>();
        await foreach (var result in results.Value.GetResultsAsync().WithCancellation(cancellationToken))
        {
            var doc = result.Document;
            var dims = (doc.Dimensions ?? [])
                .Select(s => Enum.TryParse<ContextDimension>(s, ignoreCase: true, out var d) ? d : (ContextDimension?)null)
                .Where(d => d.HasValue)
                .Select(d => d!.Value)
                .ToList();
            fragments.Add(new ContextFragment(
                SourceId: SourceId,
                DocId: doc.DocId ?? "",
                Title: doc.Title ?? "",
                Content: doc.Content ?? "",
                RelevanceScore: result.Score is double s ? Math.Round(s, 3) : 0.0,
                Origin: "GROUNDED",
                Dimensions: dims,
                OntologyBindings: doc.OntologyBindings is { Length: > 0 } ob ? ob : null,
                RegulatoryBasis:  doc.RegulatoryBasis  is { Length: > 0 } rb ? rb : null));
        }
        return fragments;
    }
}

public sealed class AzureSearchOptions
{
    public string? Endpoint { get; init; }
    public string? ApiKey { get; init; }
}

internal sealed class IndexedKnowledgeDoc
{
    [JsonPropertyName("docId")]            public string? DocId { get; set; }
    [JsonPropertyName("title")]            public string? Title { get; set; }
    [JsonPropertyName("content")]          public string? Content { get; set; }
    [JsonPropertyName("dimensions")]       public string[]? Dimensions { get; set; }
    [JsonPropertyName("domain")]           public string? Domain { get; set; }
    [JsonPropertyName("industry")]         public string? Industry { get; set; }
    [JsonPropertyName("ontologyBindings")] public string[]? OntologyBindings { get; set; }
    [JsonPropertyName("regulatoryBasis")]  public string[]? RegulatoryBasis  { get; set; }
    [JsonPropertyName("embedding")]        public float[]? Embedding { get; set; }
}
