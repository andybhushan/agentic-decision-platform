using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// GET /api/agents?window=30d
// The governance registry: every digital worker and agent on the platform, straight from the
// signed packages (identity, model, guardrails, SLOs) joined with observed behavior from the
// immutable journal (runs, confidence, gates fired, operator judgments). This is the
// Agent-365-shaped control view; platform-generic throughout.
public sealed class GetAgents(DwStateReader reader, Adp.Agents.AdapterRegistry adapters)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetAgents))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "agents")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var qd = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var window = ParseSpan(qd["window"]) ?? TimeSpan.FromDays(30);

        var rows = (await reader.ListRecentAsync(window, cancellationToken)).ToList();
        var byPackage = rows
            .Where(r => !string.IsNullOrEmpty(r.PackageId))
            .GroupBy(r => r.PackageId!, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var workers = new List<WorkerGovernance>();
        var baseDir = AppContext.BaseDirectory;
        foreach (var zipPath in Directory.EnumerateFiles(Path.Combine(baseDir, "Resources"), "*.zip").OrderBy(p => p, StringComparer.Ordinal))
        {
            Adp.PackageModel.AgentPackage pkg;
            try { pkg = PlanExecutor.LoadPackage(zipPath); }
            catch { continue; }

            byPackage.TryGetValue(pkg.Package.Id, out var pkgRows);
            var agentRows = pkgRows?
                .Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false))
                .ToList();

            var agents = pkg.Agents.Select(a =>
            {
                var mine = agentRows?.Where(r => string.Equals(r.AgentId, a.Id, StringComparison.Ordinal)).ToList();
                var confs = mine?.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).ToList();
                return new AgentGovernance(
                    AgentId: a.Id,
                    Kind: a.Kind,
                    Capability: a.Capability,
                    Model: a.FoundryModel ?? "gpt-4o",
                    SkillCount: a.SkillRefs.Count,
                    OntologyBindings: a.OntologyBinding,
                    LowThreshold: a.ConfidenceCalibration?.LowThreshold,
                    HighThreshold: a.ConfidenceCalibration?.HighThreshold,
                    Stats: mine is { Count: > 0 }
                        ? new AgentStats(
                            Steps: mine.Count,
                            AvgConfidence: confs is { Count: > 0 } ? Math.Round(confs.Average(), 3) : 0,
                            GatesFired: mine.Count(r => !string.IsNullOrEmpty(r.HitlGateId)))
                        : null);
            }).ToList();

            var pkgConfs = agentRows?.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).ToList();
            workers.Add(new WorkerGovernance(
                PackageId: pkg.Package.Id,
                Version: pkg.Package.Version,
                Industry: pkg.Package.Industry,
                UseCase: pkg.Package.UseCase,
                Stage: pkg.Package.Stage,
                StageOrder: pkg.Package.StageOrder,
                WorkerId: pkg.DigitalWorker.Id,
                WorkerName: pkg.DigitalWorker.Name,
                EntraAgentId: pkg.DigitalWorker.EntraAgentId,
                Capabilities: pkg.DigitalWorker.Capabilities,
                Slos: pkg.DigitalWorker.Slos
                    .Select(s => new SloView(s.Metric, $"{s.Comparator} {s.Target.ToString(System.Globalization.CultureInfo.InvariantCulture)}", s.Window))
                    .ToList(),
                Agents: agents,
                Stats: pkgRows is { Count: > 0 }
                    ? new WorkerStats(
                        Runs: pkgRows.Select(r => r.TraceId).Where(t => !string.IsNullOrEmpty(t)).Distinct(StringComparer.Ordinal).Count(),
                        Steps: agentRows!.Count,
                        AvgConfidence: pkgConfs is { Count: > 0 } ? Math.Round(pkgConfs.Average(), 3) : 0,
                        GatesFired: agentRows.Count(r => !string.IsNullOrEmpty(r.HitlGateId)),
                        OperatorActions: pkgRows.Count(r => r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false),
                        LastActivityAt: pkgRows.Max(r => r.EmittedAt))
                    : null));
        }

        var payload = new AgentsResponse(
            Runtime: adapters.DefaultName,
            AvailableRuntimes: adapters.Available,
            WindowHours: window.TotalHours,
            Workers: workers);

        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
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
                _ => TimeSpan.Zero,
            };
            current.Clear();
        }
        return total > TimeSpan.Zero ? total : null;
    }
}

public sealed record AgentsResponse(
    string Runtime,
    IReadOnlyList<string> AvailableRuntimes,
    double WindowHours,
    IReadOnlyList<WorkerGovernance> Workers);

public sealed record WorkerGovernance(
    string PackageId,
    string Version,
    string Industry,
    string UseCase,
    string? Stage,
    int? StageOrder,
    string WorkerId,
    string WorkerName,
    string? EntraAgentId,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<SloView> Slos,
    IReadOnlyList<AgentGovernance> Agents,
    WorkerStats? Stats);

public sealed record SloView(string Metric, string Target, string Window);

public sealed record AgentGovernance(
    string AgentId,
    string Kind,
    string Capability,
    string Model,
    int SkillCount,
    IReadOnlyList<string>? OntologyBindings,
    double? LowThreshold,
    double? HighThreshold,
    AgentStats? Stats);

public sealed record AgentStats(int Steps, double AvgConfidence, int GatesFired);

public sealed record WorkerStats(
    int Runs,
    int Steps,
    double AvgConfidence,
    int GatesFired,
    int OperatorActions,
    DateTimeOffset? LastActivityAt);
