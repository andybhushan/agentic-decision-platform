using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.SignalRService;

namespace Adp.TracesApi.Functions;

// Standard SignalR negotiate handler. Client calls GET /api/negotiate?subject=CLM-2026-1000X
// to obtain a connection URL + access token. The userId on the connection is set to subjectId,
// so SignalRStepSink can target events with Clients.User(subjectId).SendCoreAsync(...).
public static class Negotiate
{
    [Function("Negotiate")]
    public static IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "negotiate")] HttpRequest req,
        [SignalRConnectionInfoInput(HubName = SignalRStepSink.HubName, UserId = "{Query.subject}", ConnectionStringSetting = "AZURE_SIGNALR_CONNECTION")] string connectionInfo)
    {
        // The connectionInfo string is already a JSON document the SignalR client expects.
        return new ContentResult { Content = connectionInfo, ContentType = "application/json", StatusCode = 200 };
    }
}
