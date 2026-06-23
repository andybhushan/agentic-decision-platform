using System.Diagnostics;

namespace Adp.ContextLayer;

// Federates across registered sources. For each query:
//   1. Pick sources whose SupportedDimensions intersect the request's dimensions.
//   2. Query each in parallel for top-K fragments.
//   3. Merge, deduplicate by DocId, sort by RelevanceScore, take overall top-K.
public sealed class ContextRouter(IEnumerable<IContextSource> sources, int defaultTopK = 3) : IContextRouter
{
    private readonly IReadOnlyList<IContextSource> _sources = sources.ToList();
    private readonly int _topK = defaultTopK;

    public async Task<ContextResponse> GetContextAsync(ContextRequest request, CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();

        var requestedDims = request.Dimensions.ToHashSet();
        var applicableSources = _sources
            .Where(s => requestedDims.Count == 0 || s.SupportedDimensions.Any(requestedDims.Contains))
            .ToList();

        var queries = applicableSources.Select(s => s.QueryAsync(request, _topK, cancellationToken)).ToList();
        var perSourceResults = await Task.WhenAll(queries);

        var merged = perSourceResults
            .SelectMany(r => r)
            .GroupBy(f => f.DocId)
            .Select(g => g.OrderByDescending(f => f.RelevanceScore).First())
            .OrderByDescending(f => f.RelevanceScore)
            .Take(_topK)
            .ToList();

        sw.Stop();
        return new ContextResponse(
            Intent: request.Intent,
            Fragments: merged,
            ElapsedMilliseconds: sw.ElapsedMilliseconds);
    }
}
