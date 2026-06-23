using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Adp.TracesApi.Functions;

// GET /api/health — cheap liveness probe. No Cosmos call.
public static class Health
{
    [Function("Health")]
    public static IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequest req)
    {
        return new OkObjectResult(new
        {
            status = "ok",
            service = "adp-v1-traces-api",
            timestamp = DateTimeOffset.UtcNow,
        });
    }
}
