using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// GET /api/decisions
// The decision-queue read-side: every subject the bundled packages can decide on, joined with
// the latest trace state per subject from Cosmos. Platform-generic per ADR-0001: package
// metadata (industry/useCase) + digitalWorker.corpusBinding drive everything; no domain
// vocabulary lives here. ?window=Nd/Nh bounds the Cosmos scan (default 30d).
public sealed class GetDecisions(DwStateReader reader, IntakeStore intake, ILogger<GetDecisions> logger)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetDecisions))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "decisions")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var baseDir = AppContext.BaseDirectory;
        var resourcesDir = Path.Combine(baseDir, "Resources");

        // 1. Enumerate bundled packages and their corpus subjects.
        var packages = new List<PackageSummary>();
        var decisionsBySubject = new Dictionary<string, DecisionItem>(StringComparer.Ordinal);
        foreach (var zipPath in Directory.EnumerateFiles(resourcesDir, "*.zip").OrderBy(p => p, StringComparer.Ordinal))
        {
            Adp.PackageModel.AgentPackage pkg;
            try
            {
                pkg = PlanExecutor.LoadPackage(zipPath);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "GetDecisions: skipping unreadable artifact {Zip}", zipPath);
                continue;
            }

            var industry = pkg.Package.Industry ?? "insurance";
            var subjectIds = LoadCorpusSubjectIds(baseDir, industry, pkg.DigitalWorker.CorpusBinding, logger);

            packages.Add(new PackageSummary(
                PackageId: pkg.Package.Id,
                Version: pkg.Package.Version,
                Industry: industry,
                UseCase: pkg.Package.UseCase,
                WorkerName: pkg.DigitalWorker.Name,
                AgentCount: pkg.Agents.Count,
                SubjectCount: subjectIds.Count,
                Stage: pkg.Package.Stage,
                StageOrder: pkg.Package.StageOrder));

            foreach (var subjectId in subjectIds)
            {
                // Several packages can decide the same subject (all insurance DWs share the claims
                // corpus), so a decision carries every capable packageId; packageId stays as the
                // deterministic default (first enumerated, replaced by the traced one when a run exists).
                if (decisionsBySubject.TryGetValue(subjectId, out var existing))
                {
                    decisionsBySubject[subjectId] = existing with
                    {
                        PackageIds = [.. existing.PackageIds, pkg.Package.Id],
                    };
                }
                else
                {
                    decisionsBySubject[subjectId] = new DecisionItem(
                        SubjectId: subjectId,
                        PackageId: pkg.Package.Id,
                        PackageIds: [pkg.Package.Id],
                        Industry: industry,
                        UseCase: pkg.Package.UseCase,
                        LatestTrace: null,
                        PackagesRun: []);
                }
            }
        }

        // 1b. Runtime intake submissions join the queue exactly like corpus subjects.
        var useCaseByIndustry = packages
            .GroupBy(p => p.Industry, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().UseCase, StringComparer.OrdinalIgnoreCase);
        var packageIdsByIndustry = packages
            .GroupBy(p => p.Industry, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Select(p => p.PackageId).ToList(), StringComparer.OrdinalIgnoreCase);
        foreach (var doc in await intake.ListAsync(cancellationToken: cancellationToken))
        {
            if (decisionsBySubject.ContainsKey(doc.SubjectId)) continue;
            var capable = packageIdsByIndustry.TryGetValue(doc.Industry, out var pids) ? pids : [];
            decisionsBySubject[doc.SubjectId] = new DecisionItem(
                SubjectId: doc.SubjectId,
                PackageId: capable.FirstOrDefault() ?? "",
                PackageIds: capable,
                Industry: doc.Industry,
                UseCase: doc.UseCase ?? (useCaseByIndustry.TryGetValue(doc.Industry, out var uc) ? uc : null),
                LatestTrace: null,
                PackagesRun: [],
                ReceivedAt: doc.ReceivedAt,
                Channel: doc.Channel);
        }

        // 2. Latest trace per subject from Cosmos, folded onto the corpus subjects.
        var window = ParseWindow(req.Url.Query) ?? TimeSpan.FromDays(30);
        var rows = await reader.ListRecentAsync(window, cancellationToken);
        foreach (var group in rows.Where(r => !string.IsNullOrEmpty(r.SubjectId)).GroupBy(r => r.SubjectId!, StringComparer.Ordinal))
        {
            var latestTraceId = group
                .GroupBy(r => r.TraceId ?? "")
                .OrderByDescending(g => g.Max(r => r.EmittedAt))
                .First().Key;
            var traceRows = group.Where(r => r.TraceId == latestTraceId).ToList();
            // Operator-action rows (agentId "human.*") count as activity but not as agent steps.
            var agentRows = traceRows
                .Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false))
                .ToList();
            var openGates = agentRows.Count(r => string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal));
            var hasFailed = agentRows.Any(r => string.Equals(r.Status, "failed", StringComparison.Ordinal));
            var confidences = agentRows.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).ToList();

            var summary = new TraceSummary(
                TraceId: latestTraceId,
                PackageId: traceRows[0].PackageId,
                StartedAt: traceRows.Min(r => r.EmittedAt),
                LastActivityAt: traceRows.Max(r => r.EmittedAt),
                StepCount: agentRows.Count,
                MinConfidence: confidences.Count == 0 ? 0 : Math.Round(confidences.Min(), 3),
                AvgConfidence: confidences.Count == 0 ? 0 : Math.Round(confidences.Average(), 3),
                OpenGates: openGates,
                GroundedSteps: agentRows.Count(r => string.Equals(r.Origin, "GROUNDED", StringComparison.Ordinal)),
                Status: openGates > 0 ? "needs-review" : hasFailed ? "failed" : "completed");

            // Every worker that has ever decided this subject: the lifecycle progress signal.
            var packagesRun = group
                .Where(r => !string.IsNullOrEmpty(r.PackageId))
                .Select(r => r.PackageId!)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(p => p, StringComparer.Ordinal)
                .ToList();

            if (decisionsBySubject.TryGetValue(group.Key, out var existing))
            {
                decisionsBySubject[group.Key] = existing with
                {
                    LatestTrace = summary,
                    PackageId = summary.PackageId ?? existing.PackageId,
                    PackagesRun = packagesRun,
                };
            }
            else
            {
                // Traced subject not present in any bundled corpus: still show it (the journal is the truth).
                decisionsBySubject[group.Key] = new DecisionItem(
                    SubjectId: group.Key,
                    PackageId: summary.PackageId ?? "",
                    PackageIds: summary.PackageId is null ? [] : [summary.PackageId],
                    Industry: null,
                    UseCase: null,
                    LatestTrace: summary,
                    PackagesRun: packagesRun);
            }
        }

        // Needs-review first, then most recent activity (a fresh intake counts as activity),
        // then never-run subjects in stable id order.
        var decisions = decisionsBySubject.Values
            .OrderByDescending(d => d.LatestTrace?.OpenGates > 0)
            .ThenByDescending(d => d.LatestTrace?.LastActivityAt ?? d.ReceivedAt ?? DateTimeOffset.MinValue)
            .ThenBy(d => d.SubjectId, StringComparer.Ordinal)
            .ToList();

        var resp = req.CreateResponse(HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        var json = JsonSerializer.Serialize(new DecisionsResponse(packages, decisions), CamelCase);
        await resp.WriteStringAsync(json, cancellationToken);
        return resp;
    }

    private static List<string> LoadCorpusSubjectIds(
        string baseDir, string industry, Adp.PackageModel.CorpusBinding? binding, ILogger logger)
    {
        var ids = new List<string>();
        if (!PrepareRunActivity.CorpusByIndustry.TryGetValue(industry, out var corpusRelPath))
        {
            corpusRelPath = PrepareRunActivity.CorpusByIndustry["insurance"];
        }
        var corpusPath = Path.Combine(baseDir, "Resources", corpusRelPath);
        if (!File.Exists(corpusPath))
        {
            logger.LogWarning("GetDecisions: corpus for industry '{Industry}' missing at {Path}", industry, corpusPath);
            return ids;
        }

        var arrayKey = binding?.ArrayKey ?? "claims";
        var idField = binding?.SubjectIdField ?? "claimNumber";
        using var doc = JsonDocument.Parse(File.ReadAllText(corpusPath));
        if (doc.RootElement.TryGetProperty(arrayKey, out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var entry in arr.EnumerateArray())
            {
                if (entry.TryGetProperty(idField, out var id) && id.ValueKind == JsonValueKind.String)
                {
                    var s = id.GetString();
                    if (!string.IsNullOrEmpty(s)) ids.Add(s);
                }
            }
        }
        return ids;
    }

    private static TimeSpan? ParseWindow(string query)
    {
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

public sealed record DecisionsResponse(
    IReadOnlyList<PackageSummary> Packages,
    IReadOnlyList<DecisionItem> Decisions);

public sealed record PackageSummary(
    string PackageId,
    string Version,
    string Industry,
    string UseCase,
    string WorkerName,
    int AgentCount,
    int SubjectCount,
    string? Stage,
    int? StageOrder);

public sealed record DecisionItem(
    string SubjectId,
    string PackageId,
    IReadOnlyList<string> PackageIds,
    string? Industry,
    string? UseCase,
    TraceSummary? LatestTrace,
    IReadOnlyList<string> PackagesRun,
    DateTimeOffset? ReceivedAt = null,
    string? Channel = null);

public sealed record TraceSummary(
    string TraceId,
    string? PackageId,
    DateTimeOffset? StartedAt,
    DateTimeOffset? LastActivityAt,
    int StepCount,
    double MinConfidence,
    double AvgConfidence,
    int OpenGates,
    int GroundedSteps,
    string Status);
