using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;

namespace Adp.TracesApi.Functions;

// GET /api/journey/{subjectId}
// The subject's full lifecycle: every trace ever journaled for it, in time order, one
// summary per trace. Together with each package's declared stage/stageOrder this lets a
// console render the end-to-end process (intake -> ... -> settlement) without the platform
// knowing any domain flow. Operator-action rows count as activity, not as agent steps.
public sealed class GetJourney(DwStateReader reader)
{
    private static readonly JsonSerializerOptions CamelCase = new(JsonSerializerDefaults.Web);

    [Function(nameof(GetJourney))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "journey/{subjectId}")] HttpRequestData req,
        string subjectId,
        CancellationToken cancellationToken)
    {
        var allRows = await reader.ListBySubjectAsync(subjectId, cancellationToken);

        var traces = allRows
            .Where(r => !string.IsNullOrEmpty(r.TraceId))
            .GroupBy(r => r.TraceId!, StringComparer.Ordinal)
            .Select(g =>
            {
                var rows = g.ToList();
                var agentRows = rows
                    .Where(r => !(r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false))
                    .ToList();
                var confidences = agentRows.Where(r => r.Confidence.HasValue).Select(r => r.Confidence!.Value).ToList();
                var openGates = agentRows.Count(r => string.Equals(r.Status, "needs-human-review", StringComparison.Ordinal));
                var hasFailed = agentRows.Any(r => string.Equals(r.Status, "failed", StringComparison.Ordinal));
                return new JourneyTrace(
                    TraceId: g.Key,
                    PackageId: rows[0].PackageId,
                    StartedAt: rows.Min(r => r.EmittedAt),
                    LastActivityAt: rows.Max(r => r.EmittedAt),
                    StepCount: agentRows.Count,
                    OpenGates: openGates,
                    GroundedSteps: agentRows.Count(r => string.Equals(r.Origin, "GROUNDED", StringComparison.Ordinal)),
                    MinConfidence: confidences.Count == 0 ? 0 : Math.Round(confidences.Min(), 3),
                    AvgConfidence: confidences.Count == 0 ? 0 : Math.Round(confidences.Average(), 3),
                    OperatorActions: rows.Count(r => r.AgentId?.StartsWith("human.", StringComparison.Ordinal) ?? false),
                    Status: openGates > 0 ? "needs-review" : hasFailed ? "failed" : "completed");
            })
            .OrderBy(t => t.StartedAt)
            .ToList();

        var resp = req.CreateResponse(traces.Count == 0 ? HttpStatusCode.NotFound : HttpStatusCode.OK);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        var payload = traces.Count == 0
            ? JsonSerializer.Serialize(new { error = $"no journey found for subject '{subjectId}'" }, CamelCase)
            : JsonSerializer.Serialize(new JourneyResponse(subjectId, traces), CamelCase);
        await resp.WriteStringAsync(payload, cancellationToken);
        return resp;
    }
}

public sealed record JourneyResponse(
    string SubjectId,
    IReadOnlyList<JourneyTrace> Traces);

public sealed record JourneyTrace(
    string TraceId,
    string? PackageId,
    DateTimeOffset? StartedAt,
    DateTimeOffset? LastActivityAt,
    int StepCount,
    int OpenGates,
    int GroundedSteps,
    double MinConfidence,
    double AvgConfidence,
    int OperatorActions,
    string Status);
