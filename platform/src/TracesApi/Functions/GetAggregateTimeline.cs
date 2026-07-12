using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;

namespace Adp.TracesApi.Functions;

// GET /api/aggregate/timeline?window=7d&bucket=1d
// Bucketed run telemetry for the outcomes dashboard: per-bucket trace counts by package,
// step/grounding totals, average confidence, and open reviews. Buckets are gap-filled so
// charts get a continuous time axis. Operator-action journal rows (agentId "human.*")
// count as activity but are excluded from step metrics: they are judgments, not agent steps.
public sealed class GetAggregateTimeline(DwStateReader reader)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetAggregateTimeline))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "aggregate/timeline")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var qd = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var window = ParseSpan(qd["window"]) ?? TimeSpan.FromDays(7);
        var bucket = ParseSpan(qd["bucket"]) ?? (window <= TimeSpan.FromHours(48) ? TimeSpan.FromHours(1) : TimeSpan.FromDays(1));
        if (bucket > window) bucket = window;

        var packagesRaw = qd["packages"];
        var packageFilter = string.IsNullOrWhiteSpace(packagesRaw)
            ? null
            : packagesRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToHashSet(StringComparer.Ordinal);

        var allRows = await reader.ListRecentAsync(window, cancellationToken);
        var rows = allRows
            .Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false))
            .Where(r => packageFilter is null || (r.PackageId is not null && packageFilter.Contains(r.PackageId)))
            .ToList();

        var now = DateTimeOffset.UtcNow;
        var start = new DateTimeOffset(
            (now - window).Ticks - ((now - window).Ticks % bucket.Ticks), TimeSpan.Zero);

        var buckets = new List<TimelineBucket>();
        for (var t = start; t < now; t += bucket)
        {
            var end = t + bucket;
            var inBucket = rows.Where(r => r.EmittedAt >= t && r.EmittedAt < end).ToList();
            var confidences = inBucket.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).ToList();
            buckets.Add(new TimelineBucket(
                Start: t,
                Traces: inBucket.Select(r => r.TraceId).Where(x => !string.IsNullOrEmpty(x)).Distinct(StringComparer.Ordinal).Count(),
                Steps: inBucket.Count,
                GroundedSteps: inBucket.Count(r => string.Equals(r.Origin, "GROUNDED", StringComparison.Ordinal)),
                NeedsReview: inBucket.Count(r => string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal)),
                AvgConfidence: confidences.Count == 0 ? 0 : Math.Round(confidences.Average(), 3),
                TracesByPackage: inBucket
                    .Where(r => !string.IsNullOrEmpty(r.PackageId))
                    .GroupBy(r => r.PackageId!, StringComparer.Ordinal)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(r => r.TraceId).Distinct(StringComparer.Ordinal).Count(),
                        StringComparer.Ordinal)));
        }

        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        var payload = new TimelineResponse(window.TotalHours, bucket.TotalHours, buckets);
        await resp.WriteStringAsync(JsonSerializer.Serialize(payload, CamelCase), cancellationToken);
        return resp;
    }

    private static TimeSpan? ParseSpan(string? w)
    {
        if (string.IsNullOrEmpty(w)) return null;
        var total = TimeSpan.Zero;
        var current = new System.Text.StringBuilder();
        foreach (var ch in w)
        {
            if (char.IsDigit(ch)) { current.Append(ch); continue; }
            if (!int.TryParse(current.ToString(), out var n)) return null;
            total += ch switch
            {
                'h' or 'H' => TimeSpan.FromHours(n),
                'd' or 'D' => TimeSpan.FromDays(n),
                'm' or 'M' => TimeSpan.FromMinutes(n),
                _ => TimeSpan.Zero,
            };
            current.Clear();
        }
        return total > TimeSpan.Zero ? total : null;
    }
}

public sealed record TimelineResponse(
    double WindowHours,
    double BucketHours,
    IReadOnlyList<TimelineBucket> Buckets);

public sealed record TimelineBucket(
    DateTimeOffset Start,
    int Traces,
    int Steps,
    int GroundedSteps,
    int NeedsReview,
    double AvgConfidence,
    IReadOnlyDictionary<string, int> TracesByPackage);
