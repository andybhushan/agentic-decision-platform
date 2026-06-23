using System.Text.RegularExpressions;
using Azure;
using Azure.Search.Documents;
using Azure.Search.Documents.Indexes;
using Azure.Search.Documents.Indexes.Models;

namespace Adp.ContextLayer;

// One-shot indexer: walks a knowledge directory, parses markdown frontmatter,
// embeds each doc via Azure OpenAI, and uploads to the AI Search index.
// Invoked by `adpc index --knowledge <dir>`. Idempotent — safe to re-run.
public sealed partial class AzureSearchIndexer(AzureSearchOptions options, EmbeddingService embeddings)
{
    public const string IndexName = AzureSearchFoundryIQSource.IndexName;
    private const int EmbeddingDimensions = 3072;
    private const string VectorProfileName = "adp-vector-profile";
    private const string VectorAlgoName = "adp-hnsw";

    private readonly Uri _endpoint = new(options.Endpoint ?? throw new ArgumentException("AZURE_SEARCH_ENDPOINT not set"));
    private readonly AzureKeyCredential _credential = new(options.ApiKey ?? throw new ArgumentException("AZURE_SEARCH_API_KEY not set"));

    public static AzureSearchIndexer FromEnvironment(EmbeddingService embeddings)
    {
        var endpoint = Environment.GetEnvironmentVariable("AZURE_SEARCH_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_SEARCH_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("AzureSearchIndexer requires AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY.");
        return new AzureSearchIndexer(new AzureSearchOptions { Endpoint = endpoint, ApiKey = apiKey }, embeddings);
    }

    public async Task<IndexerReport> RebuildAsync(string knowledgeDir, CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(knowledgeDir)) throw new DirectoryNotFoundException(knowledgeDir);

        var indexClient = new SearchIndexClient(_endpoint, _credential);
        var index = BuildIndexDefinition();

        // CreateOrUpdate is idempotent — safe to re-run with the same schema.
        var indexResp = await indexClient.CreateOrUpdateIndexAsync(index, allowIndexDowntime: true, onlyIfUnchanged: false, cancellationToken);
        var indexUpdated = indexResp.Value.Name == IndexName;

        var docs = LoadDocs(knowledgeDir);
        if (docs.Count == 0)
            return new IndexerReport(IndexName, indexUpdated, 0, 0, []);

        var texts = docs.Select(d => $"{d.Title}\n\n{d.Content}").ToList();
        var vectors = await embeddings.EmbedBatchAsync(texts, cancellationToken);

        var batch = new List<IndexedKnowledgeDoc>();
        for (int i = 0; i < docs.Count; i++)
        {
            // Derive industry from the first segment of domain (e.g. "insurance/auto/triage" → "insurance",
            // "banking/consumer-lending/intake" → "banking"). Lets the source scope retrieval by industry
            // without false matches from vector similarity across industries.
            var industry = ExtractIndustry(docs[i].Domain);
            batch.Add(new IndexedKnowledgeDoc
            {
                DocId = docs[i].DocId,
                Title = docs[i].Title,
                Content = docs[i].Content,
                Dimensions = [.. docs[i].Dimensions],
                Domain = docs[i].Domain,
                Industry = industry,
                // AI Search Collection(String) fields are Nullable=False by default — always send
                // an array, never null. Empty array = "no bindings declared", and downstream
                // retrieval collapses zero-length arrays back to null via the { Length: > 0 } guard.
                OntologyBindings = [.. docs[i].OntologyBindings],
                RegulatoryBasis  = [.. docs[i].RegulatoryBasis],
                Embedding = vectors[i],
            });
        }

        var searchClient = new SearchClient(_endpoint, IndexName, _credential);
        var uploadResp = await searchClient.MergeOrUploadDocumentsAsync(batch, cancellationToken: cancellationToken);
        var uploaded = uploadResp.Value.Results.Count(r => r.Succeeded);
        var failed = uploadResp.Value.Results.Where(r => !r.Succeeded).Select(r => $"{r.Key}: {r.ErrorMessage}").ToList();

        return new IndexerReport(IndexName, indexUpdated, uploaded, batch.Count - uploaded, failed);
    }

    private static SearchIndex BuildIndexDefinition()
    {
        return new SearchIndex(IndexName)
        {
            Fields =
            {
                new SimpleField("docId", SearchFieldDataType.String) { IsKey = true, IsFilterable = true },
                new SearchableField("title") { IsFilterable = false },
                new SearchableField("content") { IsFilterable = false },
                new SimpleField("dimensions", SearchFieldDataType.Collection(SearchFieldDataType.String)) { IsFilterable = true },
                new SimpleField("domain", SearchFieldDataType.String) { IsFilterable = true },
                new SimpleField("industry", SearchFieldDataType.String) { IsFilterable = true },
                new SimpleField("ontologyBindings", SearchFieldDataType.Collection(SearchFieldDataType.String)) { IsFilterable = true },
                new SimpleField("regulatoryBasis",  SearchFieldDataType.Collection(SearchFieldDataType.String)) { IsFilterable = true },
                new SearchField("embedding", SearchFieldDataType.Collection(SearchFieldDataType.Single))
                {
                    IsSearchable = true,
                    VectorSearchDimensions = EmbeddingDimensions,
                    VectorSearchProfileName = VectorProfileName,
                },
            },
            VectorSearch = new VectorSearch
            {
                Profiles = { new VectorSearchProfile(VectorProfileName, VectorAlgoName) },
                Algorithms = { new HnswAlgorithmConfiguration(VectorAlgoName) },
            },
        };
    }

    private static List<ParsedKnowledgeDoc> LoadDocs(string dir)
    {
        var files = Directory.GetFiles(dir, "*.md");
        var out_ = new List<ParsedKnowledgeDoc>(files.Length);
        foreach (var f in files)
        {
            var raw = File.ReadAllText(f);
            var fm = FrontmatterRegex().Match(raw);
            if (!fm.Success) continue;
            var yaml = fm.Groups[1].Value;
            var body = raw[fm.Length..].TrimStart();

            var docId = ExtractScalar(yaml, "docId") ?? Path.GetFileNameWithoutExtension(f);
            var title = ExtractScalar(yaml, "title") ?? docId;
            var domain = ExtractScalar(yaml, "domain");
            var dimensions = ExtractArray(yaml, "dimensions");
            var ontologyBindings = ExtractArray(yaml, "ontologyBindings");
            var regulatoryBasis  = ExtractArray(yaml, "regulatoryBasis");
            out_.Add(new ParsedKnowledgeDoc(docId, title, body, dimensions, domain, ontologyBindings, regulatoryBasis));
        }
        return out_;
    }

    private static string? ExtractScalar(string yaml, string key)
    {
        var m = Regex.Match(yaml, $"^{Regex.Escape(key)}:\\s*(.+?)\\s*$", RegexOptions.Multiline);
        if (!m.Success) return null;
        var v = m.Groups[1].Value.Trim();
        if (v.StartsWith('"') && v.EndsWith('"')) v = v[1..^1];
        return v;
    }

    private static List<string> ExtractArray(string yaml, string key)
    {
        var m = Regex.Match(yaml, $"^{Regex.Escape(key)}:\\s*\\[(.+?)\\]\\s*$", RegexOptions.Multiline);
        if (!m.Success) return [];
        return [.. m.Groups[1].Value.Split(',').Select(s => s.Trim().Trim('"'))];
    }

    [GeneratedRegex(@"\A---\r?\n(.+?)\r?\n---\r?\n?", RegexOptions.Singleline)]
    private static partial Regex FrontmatterRegex();

    private static string? ExtractIndustry(string? domain)
    {
        if (string.IsNullOrEmpty(domain)) return null;
        var slash = domain.IndexOf('/');
        return slash > 0 ? domain[..slash] : domain;
    }

    private sealed record ParsedKnowledgeDoc(
        string DocId,
        string Title,
        string Content,
        IReadOnlyList<string> Dimensions,
        string? Domain,
        IReadOnlyList<string> OntologyBindings,
        IReadOnlyList<string> RegulatoryBasis);
}

public sealed record IndexerReport(
    string IndexName,
    bool IndexUpdated,
    int DocsUploaded,
    int DocsFailed,
    IReadOnlyList<string> Errors);
