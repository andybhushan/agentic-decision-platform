using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.ContextLayer;

namespace Adp.TracesApi.Functions;

// Evidence endpoints:
//   POST /api/evidence                      { groupId?, images: [{ contentType, dataBase64 }] } -> { groupId, files }
//   GET  /api/evidence/subject/{subjectId}  -> { groupId, files: [{name, contentType, size}] } (404 when none)
//   GET  /api/evidence/file/{groupId}/{name} -> the image bytes
// Uploads happen from the portal wizard BEFORE the subject id exists, keyed by a client
// group id; PostIntake links the group to the subject via the alias blob.
public sealed class Evidence(EvidenceStore store, ILogger<Evidence> logger)
{
    private const int MaxImages = 6;
    private const int MaxBytesPerImage = 2_500_000; // client resizes to ~1024px; this is a hard cap
    private const int MaxBytesPerDocument = 5_000_000; // police reports and similar, no client resize
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp",
    };
    private static readonly HashSet<string> AllowedDocumentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
    };
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    [Function("PostEvidence")]
    public async Task<IActionResult> Upload(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "evidence")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        UploadRequest? body;
        try
        {
            using var sr = new StreamReader(req.Body);
            body = JsonSerializer.Deserialize<UploadRequest>(await sr.ReadToEndAsync(cancellationToken), JsonOpts);
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }

        if (body?.Images is not { Count: > 0 })
            return new BadRequestObjectResult(new { error = "body must contain images[]" });
        if (body.Images.Count > MaxImages + 2)
            return new BadRequestObjectResult(new { error = $"at most {MaxImages} images plus 2 documents" });

        var groupId = string.IsNullOrWhiteSpace(body.GroupId) ? Guid.NewGuid().ToString("n") : SanitizeId(body.GroupId);
        var files = new List<string>();
        var photoIdx = 0;
        var docIdx = 0;
        for (var i = 0; i < body.Images.Count; i++)
        {
            var img = body.Images[i];
            var isDocument = img.ContentType is not null && AllowedDocumentTypes.Contains(img.ContentType);
            if (img.ContentType is null || (!AllowedTypes.Contains(img.ContentType) && !isDocument))
                return new BadRequestObjectResult(new { error = $"file {i + 1}: contentType must be jpeg/png/webp/pdf" });
            byte[] bytes;
            try { bytes = Convert.FromBase64String(img.DataBase64 ?? ""); }
            catch (FormatException) { return new BadRequestObjectResult(new { error = $"file {i + 1}: invalid base64" }); }
            var cap = isDocument ? MaxBytesPerDocument : MaxBytesPerImage;
            if (bytes.Length == 0 || bytes.Length > cap)
                return new BadRequestObjectResult(new { error = $"file {i + 1}: size must be 1..{cap} bytes" });

            string name;
            if (isDocument)
            {
                name = $"document-{++docIdx}.pdf";
            }
            else
            {
                var ext = img.ContentType.ToLowerInvariant() switch
                {
                    "image/png" => "png",
                    "image/webp" => "webp",
                    _ => "jpg",
                };
                name = $"photo-{++photoIdx}.{ext}";
            }
            await store.UploadAsync(groupId, name, bytes, img.ContentType, cancellationToken);
            files.Add(name);
        }

        logger.LogInformation("Evidence uploaded group={GroupId} files={Count}", groupId, files.Count);
        return new OkObjectResult(new { groupId, files });
    }

    [Function("GetEvidenceBySubject")]
    public async Task<IActionResult> BySubject(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "evidence/subject/{subjectId}")] HttpRequest req,
        string subjectId,
        CancellationToken cancellationToken)
    {
        var groupId = await store.ResolveGroupAsync(subjectId, cancellationToken);
        if (groupId is null) return new NotFoundObjectResult(new { error = "no evidence for subject" });
        var files = await store.ListAsync(groupId, cancellationToken);
        return new OkObjectResult(new { groupId, files });
    }

    [Function("GetEvidenceFile")]
    public async Task<IActionResult> File(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "evidence/file/{groupId}/{name}")] HttpRequest req,
        string groupId,
        string name,
        CancellationToken cancellationToken)
    {
        if (name.Contains("..") || name.Contains('/')) return new BadRequestObjectResult(new { error = "bad name" });
        var file = await store.DownloadAsync(SanitizeId(groupId), name, cancellationToken);
        if (file is null) return new NotFoundResult();
        return new FileContentResult(file.Value.Bytes, file.Value.ContentType);
    }

    private static string SanitizeId(string id) =>
        new([.. id.Where(c => char.IsAsciiLetterOrDigit(c) || c == '-')]);

    private sealed record UploadRequest(string? GroupId, List<UploadImage>? Images);
    private sealed record UploadImage(string? ContentType, string? DataBase64);
}
