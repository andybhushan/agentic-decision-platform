using System.Text.RegularExpressions;

namespace Adp.ContextLayer;

// Foundry IQ implementation, v0 — in-process semantic search over markdown knowledge docs.
// Docs declare their supported dimensions in YAML frontmatter and are embedded once at startup.
// At query time: filter by intent's dimensions → cosine similarity against query embedding → top-K.
// On Azure deploy this swaps for an Azure AI Search-backed implementation (same IContextSource interface).
public sealed partial class LocalFoundryIQSource : IContextSource, IDisposable
{
    public string SourceId => "FoundryIQ";

    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Procedural,
        ContextDimension.Regulatory,
        ContextDimension.Historical,
    ];

    private readonly EmbeddingService _embeddings;
    private List<IndexedDoc> _docs = [];
    private bool _initialised;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public string KnowledgeDirectory { get; }

    public LocalFoundryIQSource(EmbeddingService embeddings, string knowledgeDirectory)
    {
        _embeddings = embeddings;
        KnowledgeDirectory = knowledgeDirectory;
    }

    public void Dispose() => _initLock.Dispose();

    public async Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        await EnsureInitialisedAsync(cancellationToken);
        if (_docs.Count == 0) return [];

        var query = $"intent: {request.Intent}\nsubject: {request.SubjectId}\ndimensions: {string.Join(", ", request.Dimensions)}";
        var queryEmbedding = await _embeddings.EmbedAsync(query, cancellationToken);

        var requestedDims = request.Dimensions.ToHashSet();
        var candidates = _docs
            .Where(d => requestedDims.Count == 0 || d.Dimensions.Any(requestedDims.Contains))
            .ToList();
        if (candidates.Count == 0) candidates = _docs;

        var scored = candidates
            .Select(d => new
            {
                Doc = d,
                Score = EmbeddingService.CosineSimilarity(queryEmbedding, d.Embedding),
            })
            .OrderByDescending(x => x.Score)
            .Take(topK)
            .ToList();

        return scored.Select(s => new ContextFragment(
            SourceId: SourceId,
            DocId: s.Doc.DocId,
            Title: s.Doc.Title,
            Content: s.Doc.Content,
            RelevanceScore: Math.Round(s.Score, 3),
            Origin: "GROUNDED",
            Dimensions: s.Doc.Dimensions,
            OntologyBindings: s.Doc.OntologyBindings.Count > 0 ? s.Doc.OntologyBindings : null,
            RegulatoryBasis:  s.Doc.RegulatoryBasis.Count  > 0 ? s.Doc.RegulatoryBasis  : null)).ToList();
    }

    public async Task<IReadOnlyList<string>> ListDocIdsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureInitialisedAsync(cancellationToken);
        return [.. _docs.Select(d => d.DocId)];
    }

    private async Task EnsureInitialisedAsync(CancellationToken cancellationToken)
    {
        if (_initialised) return;
        await _initLock.WaitAsync(cancellationToken);
        try
        {
            if (_initialised) return;
            _docs = await LoadAndEmbedAsync(cancellationToken);
            _initialised = true;
        }
        finally { _initLock.Release(); }
    }

    private async Task<List<IndexedDoc>> LoadAndEmbedAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(KnowledgeDirectory)) return [];
        var files = Directory.GetFiles(KnowledgeDirectory, "*.md");
        if (files.Length == 0) return [];

        var parsed = files.Select(ParseDoc).Where(d => d is not null).Cast<ParsedDoc>().ToList();
        if (parsed.Count == 0) return [];

        // Embed all docs in one batch to minimise round trips.
        var texts = parsed.Select(p => $"{p.Title}\n\n{p.Body}").ToList();
        var embeddings = await _embeddings.EmbedBatchAsync(texts, cancellationToken);

        var indexed = new List<IndexedDoc>(parsed.Count);
        for (int i = 0; i < parsed.Count; i++)
        {
            indexed.Add(new IndexedDoc(
                DocId: parsed[i].DocId,
                Title: parsed[i].Title,
                Content: parsed[i].Body,
                Dimensions: parsed[i].Dimensions,
                OntologyBindings: parsed[i].OntologyBindings,
                RegulatoryBasis: parsed[i].RegulatoryBasis,
                Embedding: embeddings[i]));
        }
        return indexed;
    }

    private static ParsedDoc? ParseDoc(string path)
    {
        var raw = File.ReadAllText(path);
        var frontmatterMatch = FrontmatterRegex().Match(raw);
        if (!frontmatterMatch.Success) return null;

        var yaml = frontmatterMatch.Groups[1].Value;
        var body = raw[frontmatterMatch.Length..].TrimStart();

        var docId = ExtractScalar(yaml, "docId") ?? Path.GetFileNameWithoutExtension(path);
        var title = ExtractScalar(yaml, "title") ?? docId;
        var dimensionsRaw = ExtractArray(yaml, "dimensions");
        var dimensions = dimensionsRaw
            .Select(s => Enum.TryParse<ContextDimension>(s, ignoreCase: true, out var dim) ? dim : (ContextDimension?)null)
            .Where(d => d.HasValue)
            .Select(d => d!.Value)
            .ToList();
        var ontologyBindings = ExtractArray(yaml, "ontologyBindings");
        var regulatoryBasis  = ExtractArray(yaml, "regulatoryBasis");

        return new ParsedDoc(docId, title, body, dimensions, ontologyBindings, regulatoryBasis);
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

    private sealed record ParsedDoc(
        string DocId,
        string Title,
        string Body,
        IReadOnlyList<ContextDimension> Dimensions,
        IReadOnlyList<string> OntologyBindings,
        IReadOnlyList<string> RegulatoryBasis);

    private sealed record IndexedDoc(
        string DocId,
        string Title,
        string Content,
        IReadOnlyList<ContextDimension> Dimensions,
        IReadOnlyList<string> OntologyBindings,
        IReadOnlyList<string> RegulatoryBasis,
        float[] Embedding);
}
