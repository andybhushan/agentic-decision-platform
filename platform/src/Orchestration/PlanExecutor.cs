using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Adp.Agents;
using Adp.ContextLayer;
using Adp.DecisionIngest;
using Adp.PackageModel;
using Adp.ToolRuntime;

namespace Adp.Orchestration;

// Sequential driver over StepRunner for the all-in-one path (CLI + simple Durable activity).
// For HITL pause/resume, the Durable orchestrator uses StepRunner directly per-step (see TracesApi).
public sealed class PlanExecutor(
    IAgentAdapter adapter,
    IContextRouter? contextRouter = null,
    IToolRegistry? toolRegistry = null,
    IDecisionSink? decisionSink = null)
{
    public async Task<Trace> ExecuteAsync(
        string artifactZipPath,
        string subjectId,
        string? claimPath = null,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(artifactZipPath))
            throw new FileNotFoundException($"Artifact not found: {artifactZipPath}");

        var pkg = LoadPackage(artifactZipPath);
        var claimJson = LoadClaim(claimPath, subjectId, pkg.DigitalWorker.CorpusBinding);

        var traceId = $"trc-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds():x}";
        var startedAt = DateTimeOffset.UtcNow;
        var steps = new List<TraceStep>();
        var runner = new StepRunner(adapter, contextRouter, toolRegistry);

        for (int i = 0; i < pkg.DigitalWorker.AgentRefs.Count; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var result = await runner.RunStepAsync(pkg, i, subjectId, traceId, claimJson, steps, cancellationToken);
            steps.Add(result.Step);

            if (decisionSink is not null)
            {
                try { await decisionSink.PublishAsync(result.Event, cancellationToken); }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"warn: decision publish failed for step {result.Step.StepId}: {ex.Message}");
                }
            }

            // CLI policy: stop at first HITL gate. Durable orchestrator pauses + waits for resolution instead.
            if (result.Step.Status == "needs-human-review") break;
        }

        return new Trace(
            TraceId: traceId,
            Subject: subjectId,
            Package: new PackageRef(
                Id: pkg.Package.Id,
                Version: pkg.Package.Version,
                SchemaVersion: pkg.Package.SchemaVersion,
                AgentCount: pkg.Agents.Count,
                SkillCount: pkg.Skills.Count,
                ToolCount: pkg.Tools.Count),
            Steps: steps,
            HitlOptions: BuildHitlOptions(steps),
            Slos: pkg.DigitalWorker.Slos.Select(s => new SloEntry(
                Metric: s.Metric,
                Target: $"{s.Comparator} {s.Target.ToString(CultureInfo.InvariantCulture)}",
                Window: s.Window)).ToList(),
            StartedAt: startedAt);
    }

    public static string? LoadClaim(string? claimPath, string subjectId, CorpusBinding? binding = null)
    {
        if (string.IsNullOrEmpty(claimPath)) return null;
        if (!File.Exists(claimPath))
            throw new FileNotFoundException($"Claim file not found: {claimPath}");

        // Default to the P&C-shaped corpus keys for backward compat. Packages from non-P&C industries
        // (banking, healthcare, etc.) declare their own keys via digitalWorker.corpusBinding so the
        // platform stays agnostic and `applications[].applicationId` is just as valid as `claims[].claimNumber`.
        var arrayKey = binding?.ArrayKey ?? "claims";
        var idField  = binding?.SubjectIdField ?? "claimNumber";

        var content = File.ReadAllText(claimPath);
        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        if (root.TryGetProperty(arrayKey, out var subjectArray) && subjectArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var c in subjectArray.EnumerateArray())
            {
                if (c.TryGetProperty(idField, out var num)
                    && string.Equals(num.GetString(), subjectId, StringComparison.Ordinal))
                {
                    return c.GetRawText();
                }
            }
            throw new InvalidDataException($"Subject '{subjectId}' not found in corpus {claimPath} (array='{arrayKey}', id field='{idField}').");
        }

        return root.GetRawText();
    }

    public static AgentPackage LoadPackage(string artifactZipPath)
    {
        using var archive = ZipFile.OpenRead(artifactZipPath);
        return LoadEntry<AgentPackage>(archive, "package.json")
               ?? throw new InvalidDataException("Artifact missing package.json");
    }

    private static IReadOnlyList<HitlOption> BuildHitlOptions(IReadOnlyList<TraceStep> steps)
    {
        var blocking = steps.FirstOrDefault(s => s.Status == "needs-human-review");
        if (blocking is null) return [];
        return
        [
            new HitlOption("approve-as-is", "Approve as-is",       "primary",   $"Operator approved step output for {blocking.Label}."),
            new HitlOption("escalate",      "Escalate to senior",   "secondary", $"Operator escalated {blocking.Label} to a senior reviewer."),
        ];
    }

    private static T? LoadEntry<T>(ZipArchive archive, string entryName) where T : class
    {
        var entry = archive.GetEntry(entryName);
        if (entry is null) return null;
        using var stream = entry.Open();
        return JsonSerializer.Deserialize<T>(stream, AgentPackageSerializer.Options);
    }
}
