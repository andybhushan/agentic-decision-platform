using Microsoft.Azure.Functions.Worker;
using Adp.Orchestration;
using Adp.PackageModel;

namespace Adp.TracesApi.Functions;

// Loads the bundled agent package + the matching subject corpus once at the start of the run.
// Returns metadata the orchestrator needs to drive the per-step loop. Idempotent.
public static class PrepareRunActivity
{
    private const string ResourcesRoot = "Resources";

    // Per-industry corpus convention: Resources/usecases/{industryFolder}/{corpusFile}
    // Keeps the platform generic — adding an industry is one new entry, not a new switch arm.
    private static readonly Dictionary<string, string> CorpusByIndustry = new(StringComparer.OrdinalIgnoreCase)
    {
        ["insurance"] = "usecases/meridian-pnc-auto-claims/claims-25.json",
        ["banking"]   = "usecases/banking-loan-origination/applications-runtime.json",
    };

    [Function(nameof(PrepareRunActivity))]
    public static PrepareResult Run([ActivityTrigger] RunInput input)
    {
        var baseDir = AppContext.BaseDirectory;
        // Resolve artifact by packageId so the same Function can drive multiple DWs.
        // Convention: Resources/{packageId}.zip (kebab-case, no version). v1+ swaps this for a blob lookup.
        var artifactPath = Path.Combine(baseDir, ResourcesRoot, $"{input.PackageId}.zip");
        if (!File.Exists(artifactPath)) throw new FileNotFoundException($"Bundled artifact for package '{input.PackageId}' missing at {artifactPath}");

        var pkg = PlanExecutor.LoadPackage(artifactPath);

        // Industry-aware corpus resolution. Falls back to insurance for unknown industries (backward compat).
        var industry = pkg.Package.Industry ?? "insurance";
        if (!CorpusByIndustry.TryGetValue(industry, out var corpusRelPath))
        {
            corpusRelPath = CorpusByIndustry["insurance"];
        }
        var corpusPath = Path.Combine(baseDir, ResourcesRoot, corpusRelPath);
        if (!File.Exists(corpusPath)) throw new FileNotFoundException($"Bundled corpus for industry '{industry}' missing at {corpusPath}");

        var claimJson = PlanExecutor.LoadClaim(corpusPath, input.SubjectId, pkg.DigitalWorker.CorpusBinding)
                        ?? throw new InvalidDataException($"Subject '{input.SubjectId}' not found in corpus");

        var traceId = $"trc-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds():x}";

        return new PrepareResult(
            TraceId: traceId,
            ArtifactPath: artifactPath,
            CorpusPath: corpusPath,
            ClaimJson: claimJson,
            AgentRefs: [.. pkg.DigitalWorker.AgentRefs],
            DigitalWorkerId: pkg.DigitalWorker.Id);
    }
}

// What the orchestrator needs to drive per-step activities. ArtifactPath + CorpusPath are passed
// to subsequent activities because each activity needs to re-load to construct StepRunner inputs.
public sealed record PrepareResult(
    string TraceId,
    string ArtifactPath,
    string CorpusPath,
    string ClaimJson,
    IReadOnlyList<string> AgentRefs,
    string DigitalWorkerId);
