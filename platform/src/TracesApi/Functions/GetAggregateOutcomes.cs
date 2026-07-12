using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;

namespace Adp.TracesApi.Functions;

// Track 6: business-outcome aggregate over recent runs. Used by the console "Today's outcomes" panel
// and the docs portal's live status block. Default window = 24h; ?window=Nh / Nd customizes.
public sealed class GetAggregateOutcomes(DwStateReader reader)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetAggregateOutcomes))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "aggregate/outcomes")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var window = ParseWindow(req.Url.Query) ?? TimeSpan.FromHours(24);
        var packages = ParsePackages(req.Url.Query);
        var agg = await reader.AggregateAsync(window, packages, cancellationToken);
        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        // Default Functions JSON writer uses PascalCase. Force camelCase so the TS console
        // (which expects { claimsHandled, ... }) reads the response correctly.
        var json = JsonSerializer.Serialize(agg, CamelCase);
        await resp.WriteStringAsync(json, cancellationToken);
        return resp;
    }

    // ?packages=fnol-handler,damage-handler scopes the aggregate (the console's use-case lens).
    private static HashSet<string>? ParsePackages(string query)
    {
        var qd = System.Web.HttpUtility.ParseQueryString(query);
        var raw = qd["packages"];
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var set = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.Ordinal);
        return set.Count == 0 ? null : set;
    }

    private static TimeSpan? ParseWindow(string query)
    {
        // accepts ?window=24h, ?window=7d, ?window=1h, ?window=4d12h
        var qd = System.Web.HttpUtility.ParseQueryString(query);
        var w = qd["window"];
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
