using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask.Client;

namespace Adp.TracesApi.Functions;

// GET /api/runs/{runId}/status — returns the Durable orchestration state plus a link to the trace.
//
// Status values map to OrchestrationRuntimeStatus:
//   Pending | Running | Completed | Failed | Terminated | Canceled | Suspended
public static class GetRunStatus
{
    [Function("GetRunStatus")]
    public static async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "runs/{runId}/status")] HttpRequest req,
        [DurableClient] DurableTaskClient client,
        string runId,
        CancellationToken cancellationToken)
    {
        var meta = await client.GetInstanceAsync(runId, getInputsAndOutputs: true, cancellation: cancellationToken);
        if (meta is null)
        {
            return new NotFoundObjectResult(new { error = $"run '{runId}' not found" });
        }

        RunResult? result = null;
        try { result = meta.ReadOutputAs<RunResult>(); }
        catch { /* still running, no output yet */ }

        return new OkObjectResult(new
        {
            runId,
            status = meta.RuntimeStatus.ToString(),
            createdAt = meta.CreatedAt,
            lastUpdatedAt = meta.LastUpdatedAt,
            result,
            traceUrl = result is not null ? $"/api/traces/{result.SubjectId}" : null,
        });
    }
}
