using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Adp.DecisionIngest;
using Adp.Orchestration;

namespace Adp.TracesApi.Functions;

// GET /api/records?industry=insurance
// Returns the industry's subject records: the bundled corpus plus runtime intake submissions,
// verbatim, with the id-field name so a client can key them. Platform-generic: records are
// opaque use-case data; interpretation (members, policies, borrowers, ...) belongs to the
// use-case experience that consumes them.
public sealed class GetRecords(IntakeStore intake)
{
    [Function(nameof(GetRecords))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "records")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var qd = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var industry = qd["industry"] ?? "insurance";

        var baseDir = AppContext.BaseDirectory;
        string? useCase = null, arrayKey = null, idField = null;
        foreach (var zipPath in Directory.EnumerateFiles(Path.Combine(baseDir, "Resources"), "*.zip").OrderBy(p => p, StringComparer.Ordinal))
        {
            Adp.PackageModel.AgentPackage pkg;
            try { pkg = PlanExecutor.LoadPackage(zipPath); }
            catch { continue; }
            if (!string.Equals(pkg.Package.Industry, industry, StringComparison.OrdinalIgnoreCase)) continue;
            useCase = pkg.Package.UseCase;
            arrayKey = pkg.DigitalWorker.CorpusBinding?.ArrayKey ?? "claims";
            idField = pkg.DigitalWorker.CorpusBinding?.SubjectIdField ?? "claimNumber";
            break;
        }

        var resp = req.CreateResponse();
        resp.Headers.Add("Access-Control-Allow-Origin", "*");
        resp.Headers.Add("Content-Type", "application/json; charset=utf-8");

        if (useCase is null || arrayKey is null || idField is null)
        {
            resp.StatusCode = HttpStatusCode.NotFound;
            await resp.WriteStringAsync(JsonSerializer.Serialize(new { error = $"no bundled package for industry '{industry}'" }), cancellationToken);
            return resp;
        }

        var records = new List<JsonElement>();
        if (PrepareRunActivity.CorpusByIndustry.TryGetValue(industry, out var corpusRel))
        {
            var corpusPath = Path.Combine(baseDir, "Resources", corpusRel);
            if (File.Exists(corpusPath))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(corpusPath));
                if (doc.RootElement.TryGetProperty(arrayKey, out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var entry in arr.EnumerateArray()) records.Add(entry.Clone());
                }
            }
        }

        var intakeDocs = await intake.ListAsync(industry, cancellationToken);
        var intakeMeta = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var docItem in intakeDocs.OrderBy(d => d.ReceivedAt))
        {
            using var parsed = JsonDocument.Parse(docItem.RecordJson);
            records.Add(parsed.RootElement.Clone());
            intakeMeta[docItem.SubjectId] = new { receivedAt = docItem.ReceivedAt, channel = docItem.Channel };
        }

        resp.StatusCode = HttpStatusCode.OK;
        var payload = JsonSerializer.Serialize(new
        {
            industry,
            useCase,
            subjectIdField = idField,
            records,
            intake = intakeMeta,
        });
        await resp.WriteStringAsync(payload, cancellationToken);
        return resp;
    }
}
