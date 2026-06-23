using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Adp.TracesApi.Functions;

// POST /api/generate/infographic
// Reusable backend for the InfographicGenerator React component.
// Calls OpenAI's gpt-image-1 (direct OpenAI API) with the server-side OPENAI_API_KEY
// app setting and returns a base64-encoded PNG. Frontend never sees the key.
//
// To enable, set the OPENAI_API_KEY app setting on the Function app:
//   az functionapp config appsettings set -g rg-adp-v1 \
//     -n func-adp-v1-fnol --settings OPENAI_API_KEY=sk-...
//
// If the key is not set, returns 503 with a clear message so the UI can guide the operator.
public static class GenerateInfographic
{
    private const string OpenAiEndpoint = "https://api.openai.com/v1/images/generations";
    private const string ImageModel = "gpt-image-1";

    private static readonly HashSet<string> AllowedSizes = new(StringComparer.OrdinalIgnoreCase)
    {
        "1024x1024", "1024x1536", "1536x1024", "auto",
    };

    private static readonly HashSet<string> AllowedQualities = new(StringComparer.OrdinalIgnoreCase)
    {
        "low", "medium", "high", "auto",
    };

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    [Function(nameof(GenerateInfographic))]
    public static async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "generate/infographic")] HttpRequestData req,
        FunctionContext context,
        CancellationToken cancellationToken)
    {
        var logger = context.GetLogger(nameof(GenerateInfographic));

        var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return await JsonResponse(req, HttpStatusCode.ServiceUnavailable, new
            {
                error = "configuration",
                message = "OPENAI_API_KEY app setting is not configured on the Function app. " +
                          "Set it via `az functionapp config appsettings set -g rg-adp-v1 " +
                          "-n func-adp-v1-fnol --settings OPENAI_API_KEY=<key>` to enable image generation.",
            }, cancellationToken);
        }

        InfographicRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<InfographicRequest>(req.Body, JsonOpts, cancellationToken);
        }
        catch (JsonException ex)
        {
            return await JsonResponse(req, HttpStatusCode.BadRequest, new { error = "invalid_json", message = ex.Message }, cancellationToken);
        }

        if (body is null || string.IsNullOrWhiteSpace(body.Prompt))
        {
            return await JsonResponse(req, HttpStatusCode.BadRequest, new { error = "missing_prompt", message = "Prompt is required." }, cancellationToken);
        }

        var size = string.IsNullOrWhiteSpace(body.Size) ? "1536x1024" : body.Size!;
        if (!AllowedSizes.Contains(size))
        {
            return await JsonResponse(req, HttpStatusCode.BadRequest, new
            {
                error = "invalid_size",
                message = $"Size must be one of: {string.Join(", ", AllowedSizes)}.",
            }, cancellationToken);
        }

        var quality = string.IsNullOrWhiteSpace(body.Quality) ? "high" : body.Quality!;
        if (!AllowedQualities.Contains(quality))
        {
            return await JsonResponse(req, HttpStatusCode.BadRequest, new
            {
                error = "invalid_quality",
                message = $"Quality must be one of: {string.Join(", ", AllowedQualities)}.",
            }, cancellationToken);
        }

        var prompt = body.Prompt.Trim();
        if (prompt.Length > 4000)
        {
            return await JsonResponse(req, HttpStatusCode.BadRequest, new
            {
                error = "prompt_too_long",
                message = "Prompt must be 4000 characters or fewer.",
            }, cancellationToken);
        }

        logger.LogInformation("InfographicGen request: size={Size} quality={Quality} promptLength={Len}",
            size, quality, prompt.Length);

        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(3) };
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new
        {
            model = ImageModel,
            prompt,
            size,
            quality,
            n = 1,
        };

        HttpResponseMessage openAiResp;
        string openAiBody;
        try
        {
            openAiResp = await http.PostAsJsonAsync(OpenAiEndpoint, payload, JsonOpts, cancellationToken);
            openAiBody = await openAiResp.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "OpenAI request failed");
            return await JsonResponse(req, HttpStatusCode.BadGateway, new
            {
                error = "upstream_failure",
                message = $"Failed to reach OpenAI API: {ex.Message}",
            }, cancellationToken);
        }
        catch (TaskCanceledException ex)
        {
            logger.LogError(ex, "OpenAI request timed out");
            return await JsonResponse(req, HttpStatusCode.GatewayTimeout, new
            {
                error = "upstream_timeout",
                message = "OpenAI request exceeded 3-minute timeout.",
            }, cancellationToken);
        }

        if (!openAiResp.IsSuccessStatusCode)
        {
            logger.LogWarning("OpenAI returned {Status}: {Body}", openAiResp.StatusCode, openAiBody);
            return await JsonResponse(req, openAiResp.StatusCode, new
            {
                error = "openai_error",
                status = (int)openAiResp.StatusCode,
                message = openAiBody,
            }, cancellationToken);
        }

        string? base64;
        try
        {
            using var doc = JsonDocument.Parse(openAiBody);
            base64 = doc.RootElement.GetProperty("data")[0].GetProperty("b64_json").GetString();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to parse OpenAI response shape");
            return await JsonResponse(req, HttpStatusCode.BadGateway, new
            {
                error = "parse_failure",
                message = "Unexpected OpenAI response shape (no data[0].b64_json).",
            }, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(base64))
        {
            return await JsonResponse(req, HttpStatusCode.BadGateway, new
            {
                error = "empty_image",
                message = "OpenAI returned an empty image payload.",
            }, cancellationToken);
        }

        return await JsonResponse(req, HttpStatusCode.OK, new
        {
            imageBase64 = base64,
            format = "png",
            model = ImageModel,
            size,
            quality,
            promptLength = prompt.Length,
        }, cancellationToken);
    }

    private static async Task<HttpResponseData> JsonResponse(HttpRequestData req, HttpStatusCode status, object body, CancellationToken ct)
    {
        var resp = req.CreateResponse(status);
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await resp.WriteStringAsync(JsonSerializer.Serialize(body, JsonOpts), ct);
        return resp;
    }
}

public sealed record InfographicRequest(string Prompt, string? Size, string? Quality);
