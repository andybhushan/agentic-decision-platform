using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;

namespace Adp.TracesApi.Functions;

// GET /api/aggregate/insights?window=7d&packages=a,b
// The governance-story aggregates behind the Outcomes page's insight charts:
//   citationsBySource  - where the evidence came from (the IQ federation mix)
//   confidenceBins     - distribution of step confidence in 10% bins (calibration)
//   gateOutcomes       - opened gates and how humans resolved them (approve vs override)
//   straightThrough    - runs that completed with zero human intervention
// Everything is computed from the immutable journal; nothing is claimed that was not journaled.
public sealed class GetInsights(DwStateReader reader)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetInsights))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "aggregate/insights")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var qd = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var window = ParseWindow(qd["window"]) ?? TimeSpan.FromDays(7);
        var packages = ParsePackages(qd["packages"]);

        var rows = (await reader.ListRecentAsync(window, cancellationToken))
            .Where(r => packages is null || (r.PackageId is not null && packages.Contains(r.PackageId)))
            .ToList();
        var agentRows = rows.Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false)).ToList();

        // 1. Evidence mix: structured citations (v1.2) preferred; legacy flat doc ids classified by prefix.
        var bySource = new Dictionary<string, int>(StringComparer.Ordinal);
        void Count(string source) => bySource[source] = bySource.TryGetValue(source, out var n) ? n + 1 : 1;
        foreach (var r in agentRows)
        {
            if (r.CitedSourcesFull is { Count: > 0 })
            {
                foreach (var c in r.CitedSourcesFull)
                    Count(ClassifyCitation(c.SourceId, c.DocId));
            }
            else if (r.CitedSources is { Count: > 0 })
            {
                foreach (var docId in r.CitedSources)
                    Count(ClassifyCitation(null, docId));
            }
        }

        // 2. Confidence calibration: ten 10% bins over agent steps that carry a confidence.
        var bins = new int[10];
        foreach (var r in agentRows)
        {
            if (!r.Confidence.HasValue) continue;
            var idx = Math.Clamp((int)(r.Confidence.Value * 10), 0, 9);
            bins[idx]++;
        }

        // 3. Human judgment outcomes: gates opened, and how the resolved ones went.
        // Resolution is journaled on the completed step output: "(HITL resolved via <optionId>)".
        var gatesOpened = agentRows.Count(r => string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal));
        var resolvedRows = agentRows
            .Where(r => r.OutputSummary?.Contains("HITL resolved via", StringComparison.Ordinal) ?? false)
            .ToList();
        var approvedAsIs = resolvedRows.Count(r => r.OutputSummary!.Contains("approve-as-is", StringComparison.Ordinal));
        var overridden = resolvedRows.Count - approvedAsIs;

        // 4. Straight-through: traces that completed without any gate or human action on them.
        var byTrace = rows.Where(r => r.TraceId is not null).GroupBy(r => r.TraceId!).ToList();
        var completedTraces = byTrace.Count(g => g.All(r =>
            !string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal)));
        var touchedTraces = byTrace.Count(g => g.Any(r =>
            string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal) ||
            (r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false) ||
            (r.OutputSummary?.Contains("HITL resolved via", StringComparison.Ordinal) ?? false)));

        var payload = new
        {
            windowHours = window.TotalHours,
            citationsBySource = bySource,
            confidenceBins = bins,
            stepsWithConfidence = bins.Sum(),
            gateOutcomes = new { opened = gatesOpened, resolved = resolvedRows.Count, approvedAsIs, overridden },
            straightThrough = new
            {
                traces = byTrace.Count,
                untouched = byTrace.Count - touchedTraces,
                rate = byTrace.Count > 0 ? Math.Round((byTrace.Count - touchedTraces) / (double)byTrace.Count, 3) : 0,
            },
            tracesCompleted = completedTraces,
        };

        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await resp.WriteStringAsync(JsonSerializer.Serialize(payload, CamelCase), cancellationToken);
        return resp;
    }

    // Maps a citation to the IQ system that produced it: structured sourceId when present,
    // otherwise the doc-id prefix conventions used across the context sources.
    private static string ClassifyCitation(string? sourceId, string? docId)
    {
        if (!string.IsNullOrEmpty(sourceId))
        {
            if (docId?.StartsWith("DATA_AGENT/", StringComparison.Ordinal) ?? false) return "Fabric IQ Data Agent";
            return sourceId switch
            {
                "FabricIQ" => "Fabric IQ",
                "FoundryIQ" => "Foundry IQ",
                "WorkIQ" => "Work IQ",
                _ => sourceId,
            };
        }
        var d = docId ?? "";
        if (d.StartsWith("DATA_AGENT/", StringComparison.Ordinal)) return "Fabric IQ Data Agent";
        if (d.StartsWith("POLICYHOLDER_HISTORY/", StringComparison.Ordinal) ||
            d.StartsWith("SIMILAR_CLAIMS/", StringComparison.Ordinal) ||
            d.StartsWith("VEHICLE_HISTORY/", StringComparison.Ordinal) ||
            d.StartsWith("INCIDENT_MIX/", StringComparison.Ordinal) ||
            d.StartsWith("SEVERITY_DIST/", StringComparison.Ordinal) ||
            d.StartsWith("ENTITY_HISTORY", StringComparison.Ordinal)) return "Fabric IQ";
        if (d.StartsWith("TEAMS_THREAD/", StringComparison.Ordinal) ||
            d.StartsWith("CALENDAR_SIGNAL/", StringComparison.Ordinal) ||
            d.StartsWith("SHOP", StringComparison.Ordinal)) return "Work IQ";
        return "Foundry IQ";
    }

    private static HashSet<string>? ParsePackages(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var set = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.Ordinal);
        return set.Count == 0 ? null : set;
    }

    private static TimeSpan? ParseWindow(string? w)
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
