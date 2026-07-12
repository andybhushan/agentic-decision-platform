using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.DecisionIngest;

namespace Adp.TracesApi.Functions;

// POST /api/actions
// Body: { subjectId, traceId, actionId, label, rationale }
// The governed-action write side: journals an operator action as an immutable row on the
// subject's trace (agentId "human.operator", origin DERIVED: it is a judgment, not a
// retrieval-grounded agent step) and pushes it on the SignalR tail so consoles update live.
// Step metrics elsewhere exclude "human.*" rows; the trace itself shows them in full.
public sealed class ExecuteAction(
    DwStateReader reader,
    DwStateWriter writer,
    Lazy<Task<SignalRStepSink?>> signalRSinkLazy,
    ILogger<ExecuteAction> logger)
{
    [Function("ExecuteAction")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "actions")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        ActionRequest? body;
        try
        {
            using var sr = new StreamReader(req.Body);
            var raw = await sr.ReadToEndAsync(cancellationToken);
            body = string.IsNullOrWhiteSpace(raw)
                ? null
                : JsonSerializer.Deserialize<ActionRequest>(raw, JsonOptions);
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }

        if (body is null || string.IsNullOrEmpty(body.SubjectId) || string.IsNullOrEmpty(body.TraceId) || string.IsNullOrEmpty(body.ActionId))
            return new BadRequestObjectResult(new { error = "body must contain subjectId, traceId, actionId" });

        var allRows = await reader.ListBySubjectAsync(body.SubjectId, cancellationToken);
        var traceRows = allRows.Where(r => string.Equals(r.TraceId, body.TraceId, StringComparison.Ordinal)).ToList();
        if (traceRows.Count == 0)
            return new NotFoundObjectResult(new { error = $"trace '{body.TraceId}' not found for subject '{body.SubjectId}'" });

        var first = traceRows[0];
        var stepId = $"s{traceRows.Count + 1}";
        var emittedAt = DateTimeOffset.UtcNow;

        var evt = new DecisionEvent(
            DecisionId: Guid.NewGuid().ToString("n"),
            TraceId: body.TraceId,
            SubjectId: body.SubjectId,
            DigitalWorkerId: first.DigitalWorkerId ?? "",
            PackageId: first.PackageId ?? "",
            PackageVersion: first.PackageVersion ?? "",
            PackageSchemaVersion: first.PackageSchemaVersion ?? "v1",
            AgentCount: first.AgentCount ?? 0,
            SkillCount: first.SkillCount ?? 0,
            ToolCount: first.ToolCount ?? 0,
            StepId: stepId,
            StepLabel: body.Label ?? $"operator-action ({body.ActionId})",
            AgentId: "human.operator",
            Confidence: 1.0,
            Status: "completed",
            Origin: "DERIVED",
            OutputSummary: string.IsNullOrWhiteSpace(body.Rationale)
                ? $"Operator executed governed action '{body.ActionId}'."
                : $"{body.Rationale} (governed action '{body.ActionId}')",
            HitlGateId: null,
            ToolCallCount: 0,
            DurationMs: 0,
            Slos: first.Slos ?? [],
            EmittedAt: emittedAt);

        await writer.PublishAsync(evt, cancellationToken);

        var signalR = await signalRSinkLazy.Value;
        if (signalR is not null)
        {
            try { await signalR.PublishAsync(evt, cancellationToken); }
            catch (Exception ex) { logger.LogWarning(ex, "ExecuteAction: SignalR push failed (journal write succeeded)"); }
        }

        logger.LogInformation(
            "ExecuteAction journaled subject={SubjectId} trace={TraceId} action={ActionId} step={StepId}",
            body.SubjectId, body.TraceId, body.ActionId, stepId);

        return new OkObjectResult(new
        {
            accepted = true,
            subjectId = body.SubjectId,
            traceId = body.TraceId,
            stepId,
            actionId = body.ActionId,
            journaledAt = emittedAt,
        });
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

public sealed record ActionRequest(
    string? SubjectId,
    string? TraceId,
    string? ActionId,
    string? Label,
    string? Rationale);
