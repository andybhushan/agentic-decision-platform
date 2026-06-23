using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.Logging;

namespace Adp.TracesApi.Functions;

// POST /api/runs/{runId}/resolve-hitl
// Body: { optionId: "approve-as-is" | "escalate", overrideOutput: "..." }
// Effect: raises the "HitlResolution" external event on the paused Durable orchestration.
public sealed class ResolveHitl(ILogger<ResolveHitl> logger)
{
    [Function("ResolveHitl")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "runs/{runId}/resolve-hitl")] HttpRequest req,
        [DurableClient] DurableTaskClient client,
        string runId,
        CancellationToken cancellationToken)
    {
        ResolveRequest? body;
        try
        {
            using var reader = new StreamReader(req.Body);
            var raw = await reader.ReadToEndAsync(cancellationToken);
            body = string.IsNullOrWhiteSpace(raw)
                ? null
                : JsonSerializer.Deserialize<ResolveRequest>(raw, JsonOptions);
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }

        if (body is null || string.IsNullOrEmpty(body.OptionId))
            return new BadRequestObjectResult(new { error = "body must contain optionId" });

        var meta = await client.GetInstanceAsync(runId, cancellation: cancellationToken);
        if (meta is null)
            return new NotFoundObjectResult(new { error = $"run '{runId}' not found" });

        var resolution = new HitlResolution(
            OptionId: body.OptionId,
            OverrideOutput: body.OverrideOutput ?? $"Operator selected '{body.OptionId}'.",
            ResolvedAt: DateTimeOffset.UtcNow);

        logger.LogInformation("ResolveHitl run={RunId} option={OptionId}", runId, body.OptionId);
        await client.RaiseEventAsync(runId, "HitlResolution", resolution, cancellation: cancellationToken);

        return new OkObjectResult(new
        {
            runId,
            accepted = true,
            optionId = body.OptionId,
            resolvedAt = resolution.ResolvedAt,
        });
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

public sealed record ResolveRequest(string? OptionId, string? OverrideOutput);
