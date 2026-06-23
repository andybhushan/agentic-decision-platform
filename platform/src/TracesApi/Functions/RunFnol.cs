using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.Logging;

namespace Adp.TracesApi.Functions;

// POST /api/runs — starts a Durable orchestration for a claim.
//
// Request body (JSON):
//   { "subjectId": "CLM-2026-10000", "packageId": "fnol-handler", "forceHitlAtAgentId": "agent.initial-triage" }
//
// `forceHitlAtAgentId` (optional) deterministically opens the HITL gate at the named agent. Used for
// reliable demos when the model would otherwise return high confidence and skip the gate.
//
// Response (202 Accepted):
//   { runId, subjectId, packageId, statusUrl, traceUrl, resolveHitlUrl }
public sealed class RunFnol(ILogger<RunFnol> logger)
{
    [Function("RunFnol")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "runs")] HttpRequest req,
        [DurableClient] DurableTaskClient client,
        CancellationToken cancellationToken)
    {
        RunRequest? body;
        try
        {
            using var reader = new StreamReader(req.Body);
            var raw = await reader.ReadToEndAsync(cancellationToken);
            body = string.IsNullOrWhiteSpace(raw)
                ? new RunRequest(null, null, null)
                : JsonSerializer.Deserialize<RunRequest>(raw, JsonOptions);
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }

        var subjectId = body?.SubjectId ?? "CLM-2026-10000";
        var packageId = body?.PackageId ?? "fnol-handler";
        // Allow ?forceHitlAt=agent.id as a query override too.
        var forceHitlAtAgentId = body?.ForceHitlAtAgentId ?? req.Query["forceHitlAt"].ToString();
        if (string.IsNullOrWhiteSpace(forceHitlAtAgentId)) forceHitlAtAgentId = null;

        logger.LogInformation("RunFnol starting subject={SubjectId}, package={PackageId}, forceHitlAt={ForceAt}", subjectId, packageId, forceHitlAtAgentId ?? "(none)");

        var instanceId = await client.ScheduleNewOrchestrationInstanceAsync(
            nameof(FnolOrchestrator),
            new RunInput(subjectId, packageId, forceHitlAtAgentId),
            cancellation: cancellationToken);

        return new AcceptedResult(
            location: $"/api/runs/{instanceId}/status",
            value: new RunStarted(
                RunId: instanceId,
                SubjectId: subjectId,
                PackageId: packageId,
                StatusUrl: $"/api/runs/{instanceId}/status",
                TraceUrl: $"/api/traces/{subjectId}",
                ResolveHitlUrl: $"/api/runs/{instanceId}/resolve-hitl"));
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

public sealed record RunRequest(string? SubjectId, string? PackageId, string? ForceHitlAtAgentId);
public sealed record RunInput(string SubjectId, string PackageId, string? ForceHitlAtAgentId = null);
public sealed record RunStarted(string RunId, string SubjectId, string PackageId, string StatusUrl, string TraceUrl, string ResolveHitlUrl);
