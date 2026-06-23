using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// GET /api/traces/{subjectId}
// Returns the Trace shape wire-compatible with platform/console/src/types.ts.
// Reconstructed from Cosmos `dw-state` rows for that subject. Per ADR-0006 §state-contract.
public sealed class GetTrace(DwStateReader reader, ILogger<GetTrace> logger)
{
    [Function("GetTrace")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "traces/{subjectId}")] HttpRequest req,
        string subjectId,
        CancellationToken cancellationToken)
    {
        logger.LogInformation("GetTrace subject={SubjectId}", subjectId);

        var allRows = await reader.ListBySubjectAsync(subjectId, cancellationToken);
        if (allRows.Count == 0)
        {
            return new NotFoundObjectResult(new { error = $"no trace found for subject '{subjectId}'" });
        }

        // Subject may have multiple traces over time. Pick the most recent one (by max emittedAt per traceId).
        var requestedTraceId = req.Query["traceId"].ToString();
        var latestTraceId = string.IsNullOrEmpty(requestedTraceId)
            ? allRows.GroupBy(r => r.TraceId ?? "").OrderByDescending(g => g.Max(r => r.EmittedAt)).First().Key
            : requestedTraceId;

        var rows = allRows.Where(r => r.TraceId == latestTraceId).OrderBy(r => r.StepId).ToList();
        if (rows.Count == 0)
        {
            return new NotFoundObjectResult(new { error = $"trace '{latestTraceId}' not found for subject '{subjectId}'" });
        }

        var first = rows[0];
        var steps = rows.Select(r => new TraceStep(
            StepId: r.StepId ?? "",
            AgentId: r.AgentId ?? "",
            Label: r.StepLabel ?? "",
            Confidence: r.Confidence ?? 0,
            Status: r.Status ?? "completed",
            Origin: r.Origin ?? "DERIVED",
            Output: r.OutputSummary ?? "",
            DurationMs: r.DurationMs ?? 0,
            HitlGateId: r.HitlGateId,
            ToolCalls: null,
            // v1.1: reconstruct structured citations from the flat docId list stored on the row.
            // SourceId, title and score don't survive Cosmos round-trip in v1.1 (DwStateRow holds
            // only docIds); the console renders the docId in the citation chip, with the cheap
            // fallback "v1.1" sourceId tag for now. v1.2 widens DwStateRow to carry full citations.
            CitedSources: r.CitedSources is { Count: > 0 } cs
                ? cs.Select(docId => new CitedSource("FoundryIQ", docId, docId, 0.0)).ToList()
                : null,
            OntologyBindings: r.OntologyBindings,
            RegulatoryBasis: r.RegulatoryBasis)).ToList();

        var slos = (first.Slos ?? []).Select(s => new SloEntry(
            Metric: s.Metric,
            Target: s.Target,
            Window: s.Window)).ToList();

        var trace = new Trace(
            TraceId: first.TraceId ?? "",
            Subject: first.SubjectId ?? subjectId,
            Package: new PackageRef(
                Id: first.PackageId ?? "",
                Version: first.PackageVersion ?? "",
                SchemaVersion: first.PackageSchemaVersion ?? "v1",
                AgentCount: first.AgentCount ?? 0,
                SkillCount: first.SkillCount ?? 0,
                ToolCount: first.ToolCount ?? 0),
            Steps: steps,
            HitlOptions: BuildHitlOptions(steps),
            Slos: slos,
            StartedAt: rows.Min(r => r.EmittedAt) ?? first.EmittedAt ?? DateTimeOffset.UtcNow);

        return new OkObjectResult(trace);
    }

    private static List<HitlOption> BuildHitlOptions(IReadOnlyList<TraceStep> steps)
    {
        var blocking = steps.FirstOrDefault(s => s.Status == "needs-human-review");
        if (blocking is null) return [];
        return
        [
            new HitlOption("approve-as-is", "Approve as-is",     "primary",   $"Operator approved step output for {blocking.Label}."),
            new HitlOption("escalate",      "Escalate to senior", "secondary", $"Operator escalated {blocking.Label} to a senior reviewer."),
        ];
    }
}
