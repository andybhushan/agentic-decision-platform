using Microsoft.Azure.SignalR.Management;
using Adp.DecisionIngest;

namespace Adp.TracesApi;

// Pushes per-step events to Azure SignalR. Clients connect with a userId = subjectId and
// receive only events for the subject they're watching.
public sealed class SignalRStepSink : IDecisionSink
{
    public const string HubName = "fnoltrace";
    public const string MessageTarget = "step";

    private readonly ServiceHubContext _hub;

    private SignalRStepSink(ServiceHubContext hub) { _hub = hub; }

    public static async Task<SignalRStepSink> FromEnvironmentAsync(CancellationToken cancellationToken = default)
    {
        var conn = Environment.GetEnvironmentVariable("AZURE_SIGNALR_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("SignalRStepSink requires AZURE_SIGNALR_CONNECTION.");

        var manager = new ServiceManagerBuilder()
            .WithOptions(o =>
            {
                o.ConnectionString = conn;
                o.ServiceTransportType = ServiceTransportType.Transient;
            })
            .BuildServiceManager();

        var hub = await manager.CreateHubContextAsync(HubName, cancellationToken);
        return new SignalRStepSink(hub);
    }

    public async Task PublishAsync(DecisionEvent evt, CancellationToken cancellationToken = default)
    {
        // Send only to clients connected with userId = subjectId.
        // Wire shape mirrors what the console renders for each step row.
        var payload = new
        {
            traceId = evt.TraceId,
            stepId = evt.StepId,
            label = evt.StepLabel,
            agentId = evt.AgentId,
            confidence = evt.Confidence,
            status = evt.Status,
            origin = evt.Origin,
            outputSummary = evt.OutputSummary,
            durationMs = evt.DurationMs,
            hitlGateId = evt.HitlGateId,
            toolCallCount = evt.ToolCallCount,
            emittedAt = evt.EmittedAt,
        };

        await _hub.Clients.User(evt.SubjectId).SendCoreAsync(
            MessageTarget,
            [payload],
            cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await _hub.DisposeAsync();
    }
}
