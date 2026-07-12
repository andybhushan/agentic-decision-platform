using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;

namespace Adp.TracesApi.Functions;

// GET /api/aggregate/cycletime?window=7d&packages=a,b
// Decision cycle time per worker: for every trace in the window, duration = last agent-step
// emittedAt minus first (operator-action rows excluded so a judgment journaled hours later
// does not inflate decision latency). Returns p50/p90/avg/max per packageId.
public sealed class GetCycleTime(DwStateReader reader)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetCycleTime))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "aggregate/cycletime")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var qd = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var window = ParseSpan(qd["window"]) ?? TimeSpan.FromDays(7);
        var packagesRaw = qd["packages"];
        var packageFilter = string.IsNullOrWhiteSpace(packagesRaw)
            ? null
            : packagesRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToHashSet(StringComparer.Ordinal);

        var rows = (await reader.ListRecentAsync(window, cancellationToken))
            .Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false))
            .Where(r => !string.IsNullOrEmpty(r.TraceId) && !string.IsNullOrEmpty(r.PackageId) && r.EmittedAt.HasValue)
            .Where(r => packageFilter is null || packageFilter.Contains(r.PackageId!))
            .ToList();

        var perPackage = rows
            .GroupBy(r => r.PackageId!, StringComparer.Ordinal)
            .Select(pkg =>
            {
                var durations = pkg
                    .GroupBy(r => r.TraceId!, StringComparer.Ordinal)
                    .Select(t => (t.Max(r => r.EmittedAt!.Value) - t.Min(r => r.EmittedAt!.Value)).TotalMilliseconds)
                    .Where(ms => ms >= 0)
                    .OrderBy(ms => ms)
                    .ToList();
                return new CycleTimeEntry(
                    PackageId: pkg.Key,
                    Runs: durations.Count,
                    P50Ms: Math.Round(Percentile(durations, 0.5)),
                    P90Ms: Math.Round(Percentile(durations, 0.9)),
                    AvgMs: durations.Count == 0 ? 0 : Math.Round(durations.Average()),
                    MaxMs: durations.Count == 0 ? 0 : Math.Round(durations[^1]));
            })
            .OrderByDescending(e => e.Runs)
            .ToList();

        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await resp.WriteStringAsync(
            JsonSerializer.Serialize(new CycleTimeResponse(window.TotalHours, perPackage), CamelCase), cancellationToken);
        return resp;
    }

    private static double Percentile(List<double> sortedAscending, double p)
    {
        if (sortedAscending.Count == 0) return 0;
        var rank = p * (sortedAscending.Count - 1);
        var lo = (int)Math.Floor(rank);
        var hi = (int)Math.Ceiling(rank);
        if (lo == hi) return sortedAscending[lo];
        return sortedAscending[lo] + (sortedAscending[hi] - sortedAscending[lo]) * (rank - lo);
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
                _ => TimeSpan.Zero,
            };
            current.Clear();
        }
        return total > TimeSpan.Zero ? total : null;
    }
}

public sealed record CycleTimeResponse(double WindowHours, IReadOnlyList<CycleTimeEntry> Packages);

public sealed record CycleTimeEntry(
    string PackageId,
    int Runs,
    double P50Ms,
    double P90Ms,
    double AvgMs,
    double MaxMs);
