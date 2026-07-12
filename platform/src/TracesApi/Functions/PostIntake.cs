using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Adp.ContextLayer;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// POST /api/intake
// Body: { industry, channel?, record: { ...use-case record shape, id field omitted } }
// Accepts a new subject into the platform at runtime: assigns the next subject id following
// the corpus's own id pattern, stores the record durably (Cosmos "intake"), and from then on
// the subject is runnable and appears in the decision queue. Platform-generic: id field and
// pattern are learned from the industry's corpus + corpusBinding, never hardcoded.
public sealed class PostIntake(
    IntakeStore intake,
    EvidenceStore evidence,
    Lazy<EvidenceVision?> visionLazy,
    ILogger<PostIntake> logger)
{
    [Function("PostIntake")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "intake")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        JsonNode? body;
        try
        {
            using var sr = new StreamReader(req.Body);
            body = JsonNode.Parse(await sr.ReadToEndAsync(cancellationToken));
        }
        catch (JsonException ex)
        {
            return new BadRequestObjectResult(new { error = $"invalid JSON: {ex.Message}" });
        }

        var industry = body?["industry"]?.GetValue<string>();
        var record = body?["record"];
        if (string.IsNullOrEmpty(industry) || record is null)
            return new BadRequestObjectResult(new { error = "body must contain industry and record" });
        var channel = body?["channel"]?.GetValue<string>() ?? "web";

        // Learn the corpus conventions for this industry from its first bundled package.
        var resolved = ResolveIndustryConventions(industry);
        if (resolved is null)
            return new BadRequestObjectResult(new { error = $"no bundled package found for industry '{industry}'" });
        var (useCase, arrayKey, idField, corpusPath) = resolved.Value;

        // Next id = corpus pattern (prefix + zero-padded number) continued past corpus + intake.
        var existingIds = LoadCorpusIds(corpusPath, arrayKey, idField);
        foreach (var doc in await intake.ListAsync(industry, cancellationToken)) existingIds.Add(doc.SubjectId);
        var subjectId = NextSubjectId(existingIds);
        if (subjectId is null)
            return new UnprocessableEntityObjectResult(new { error = "could not derive a subject id pattern from the corpus" });

        record[idField] = subjectId;
        var receivedAt = DateTimeOffset.UtcNow;

        // Evidence: when the record carries an evidenceGroupId (the portal uploaded photos
        // before submitting), link it to the subject and run GPT-4o vision ONCE at intake.
        // The objective description is embedded in the record so every downstream stage's
        // agents receive it as part of the subject's own data. Failure degrades gracefully.
        var evidenceGroupId = record["evidenceGroupId"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(evidenceGroupId))
        {
            try
            {
                await evidence.WriteSubjectAliasAsync(subjectId, evidenceGroupId, cancellationToken);
                var files = await evidence.ListAsync(evidenceGroupId, cancellationToken);
                var images = new List<(byte[] Bytes, string ContentType)>();
                foreach (var f in files.Where(f => f.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)).Take(6))
                {
                    var dl = await evidence.DownloadAsync(evidenceGroupId, f.Name, cancellationToken);
                    if (dl is not null) images.Add(dl.Value);
                }
                var vision = visionLazy.Value;
                if (images.Count > 0 && vision is not null)
                {
                    var description = await vision.DescribeAsync(subjectId, images, cancellationToken);
                    if (!string.IsNullOrWhiteSpace(description))
                    {
                        record["evidenceAssessment"] = description.Length > 1500 ? description[..1500] : description;
                        record["evidencePhotoCount"] = images.Count;
                        logger.LogInformation("PostIntake vision assessed {Count} images for {SubjectId}", images.Count, subjectId);
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "PostIntake evidence processing failed for {SubjectId}; continuing without", subjectId);
            }
        }

        await intake.UpsertAsync(new IntakeDoc(
            Id: subjectId,
            SubjectId: subjectId,
            Industry: industry,
            UseCase: useCase,
            Channel: channel,
            ReceivedAt: receivedAt,
            RecordJson: record.ToJsonString()), cancellationToken);

        logger.LogInformation("PostIntake accepted subject={SubjectId} industry={Industry} channel={Channel}", subjectId, industry, channel);

        return new ObjectResult(new { subjectId, industry, useCase, channel, receivedAt }) { StatusCode = 201 };
    }

    private static (string UseCase, string ArrayKey, string IdField, string CorpusPath)? ResolveIndustryConventions(string industry)
    {
        var baseDir = AppContext.BaseDirectory;
        foreach (var zipPath in Directory.EnumerateFiles(Path.Combine(baseDir, "Resources"), "*.zip").OrderBy(p => p, StringComparer.Ordinal))
        {
            Adp.PackageModel.AgentPackage pkg;
            try { pkg = PlanExecutor.LoadPackage(zipPath); }
            catch { continue; }
            if (!string.Equals(pkg.Package.Industry, industry, StringComparison.OrdinalIgnoreCase)) continue;
            if (!PrepareRunActivity.CorpusByIndustry.TryGetValue(industry, out var corpusRel)) return null;
            return (
                pkg.Package.UseCase,
                pkg.DigitalWorker.CorpusBinding?.ArrayKey ?? "claims",
                pkg.DigitalWorker.CorpusBinding?.SubjectIdField ?? "claimNumber",
                Path.Combine(baseDir, "Resources", corpusRel));
        }
        return null;
    }

    private static List<string> LoadCorpusIds(string corpusPath, string arrayKey, string idField)
    {
        var ids = new List<string>();
        if (!File.Exists(corpusPath)) return ids;
        using var doc = JsonDocument.Parse(File.ReadAllText(corpusPath));
        if (doc.RootElement.TryGetProperty(arrayKey, out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var entry in arr.EnumerateArray())
            {
                if (entry.TryGetProperty(idField, out var id) && id.ValueKind == JsonValueKind.String)
                {
                    var s = id.GetString();
                    if (!string.IsNullOrEmpty(s)) ids.Add(s);
                }
            }
        }
        return ids;
    }

    // "CLM-2026-10024" -> prefix "CLM-2026-", width 5, next 10025. Works for any
    // "<prefix><number>" corpus id scheme; returns null if no id matches that shape.
    private static string? NextSubjectId(IReadOnlyList<string> existingIds)
    {
        string? prefix = null;
        var width = 0;
        long max = -1;
        foreach (var id in existingIds)
        {
            var i = id.Length;
            while (i > 0 && char.IsAsciiDigit(id[i - 1])) i--;
            if (i == id.Length) continue; // no trailing number
            var p = id[..i];
            var numText = id[i..];
            if (!long.TryParse(numText, out var num)) continue;
            if (prefix is null) { prefix = p; width = numText.Length; }
            if (!string.Equals(p, prefix, StringComparison.Ordinal)) continue;
            if (num > max) { max = num; width = numText.Length; }
        }
        if (prefix is null || max < 0) return null;
        return prefix + (max + 1).ToString(System.Globalization.CultureInfo.InvariantCulture).PadLeft(width, '0');
    }
}
