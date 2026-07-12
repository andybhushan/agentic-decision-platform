using System.Globalization;
using System.Text;
using Adp.Agents;
using Adp.ContextLayer;
using Adp.DecisionIngest;
using Adp.PackageModel;
using Adp.ToolRuntime;

namespace Adp.Orchestration;

// Executes a single agent step. Pulled out of PlanExecutor so two drivers can use it:
//   1. PlanExecutor — the CLI / all-in-one-activity driver
//   2. Durable FnolOrchestrator's per-step activity — supports HITL pause/resume
public sealed class StepRunner(
    IAgentAdapter adapter,
    IContextRouter? contextRouter = null,
    IToolRegistry? toolRegistry = null)
{
    public async Task<StepRunResult> RunStepAsync(
        AgentPackage pkg,
        int stepIndex,
        string subjectId,
        string traceId,
        string? claimJson,
        IReadOnlyList<TraceStep> previousSteps,
        CancellationToken cancellationToken = default)
    {
        var agentId = pkg.DigitalWorker.AgentRefs[stepIndex];
        var agent = pkg.Agents.FirstOrDefault(a => a.Id == agentId)
                    ?? throw new InvalidDataException($"agentRef '{agentId}' not found in package.agents");

        var binding = pkg.ContextBindings?.ElementAtOrDefault(stepIndex);
        var intent = binding?.Intent ?? agent.Capability;
        var dimensions = MapDimensions(binding);

        var contextSnippets = new Dictionary<string, string>();
        if (claimJson is not null) contextSnippets["claim"] = claimJson;
        if (previousSteps.Count > 0) contextSnippets["previousSteps"] = SummariseSteps(previousSteps);

        string? citedSourceList = null;
        IReadOnlyList<ContextFragment> fragments = [];
        if (contextRouter is not null)
        {
            // v0.5 + Track 5: pass industry + sourceBindings + schemaContext so semantic sources can
            // both scope retrieval AND issue templated queries against the package's schema. The
            // ContextLayer doesn't import PackageModel; we translate SchemaBinding → SchemaContext here.
            var contextResponse = await contextRouter.GetContextAsync(
                new ContextRequest(
                    Intent: intent,
                    SubjectId: subjectId,
                    Dimensions: dimensions,
                    Industry: pkg.Package.Industry,
                    SourceBindings: binding?.SourceBindings,
                    SchemaContext: ToSchemaContext(pkg.DigitalWorker.SchemaBinding)),
                cancellationToken);
            fragments = contextResponse.Fragments;
            if (fragments.Count > 0)
            {
                contextSnippets["knowledge"] = FormatFragments(fragments);
                citedSourceList = string.Join(", ", fragments.Select(f => f.DocId));
            }
        }

        var result = await adapter.InvokeAsync(
            new AgentInvocationRequest(
                Agent: agent,
                SubjectId: subjectId,
                Intent: intent,
                ContextSnippets: contextSnippets,
                Tools: toolRegistry),
            cancellationToken);

        var stepId = $"s{stepIndex + 1}";
        var (status, gateId) = EvaluateStatus(pkg, agent, stepId, result);

        var output = citedSourceList is null
            ? result.Output
            : $"{result.Output}  (context: {citedSourceList})";

        var toolCalls = result.ToolCallsExecuted?.Select(tc => new ToolCallRecord(
            ToolId: tc.ToolId,
            Arguments: Truncate(tc.ArgumentsJson, 400),
            Result: Truncate(tc.ResultJson, 600),
            DurationMs: tc.DurationMs,
            Success: tc.Success)).ToList();

        // v1.1: structured citations + ontology + regulatory aggregation from the fragments we just
        // pulled in. Empty lists collapse to null on the wire so traces stay tidy.
        var citedSources = fragments.Count > 0
            ? fragments.Select(f => new CitedSource(
                SourceId: f.SourceId,
                DocId: f.DocId,
                Title: f.Title,
                Score: f.RelevanceScore)).ToList()
            : null;
        var ontologyBindings = DistinctOrNull(fragments.SelectMany(f => f.OntologyBindings ?? []));
        var regulatoryBasis  = DistinctOrNull(fragments.SelectMany(f => f.RegulatoryBasis  ?? []));

        var step = new TraceStep(
            StepId: stepId,
            AgentId: result.AgentId,
            Label: agent.Capability,
            Confidence: result.Confidence,
            Status: status,
            Origin: result.Origin,
            Output: output,
            DurationMs: result.ElapsedMilliseconds,
            HitlGateId: gateId,
            ToolCalls: toolCalls,
            CitedSources: citedSources,
            OntologyBindings: ontologyBindings,
            RegulatoryBasis: regulatoryBasis);

        var sloSnapshots = pkg.DigitalWorker.Slos.Select(s => new SloSnapshot(
            Metric: s.Metric,
            Target: $"{s.Comparator} {s.Target.ToString(CultureInfo.InvariantCulture)}",
            Window: s.Window)).ToList();

        var evt = new DecisionEvent(
            DecisionId: $"{traceId}/{step.StepId}",
            TraceId: traceId,
            SubjectId: subjectId,
            DigitalWorkerId: pkg.DigitalWorker.Id,
            PackageId: pkg.Package.Id,
            PackageVersion: pkg.Package.Version,
            PackageSchemaVersion: pkg.Package.SchemaVersion,
            AgentCount: pkg.Agents.Count,
            SkillCount: pkg.Skills.Count,
            ToolCount: pkg.Tools.Count,
            StepId: step.StepId,
            StepLabel: step.Label,
            AgentId: step.AgentId,
            Confidence: step.Confidence,
            Status: step.Status,
            Origin: step.Origin,
            OutputSummary: Truncate(step.Output, 500),
            HitlGateId: step.HitlGateId,
            ToolCallCount: step.ToolCalls?.Count ?? 0,
            DurationMs: step.DurationMs,
            Slos: sloSnapshots,
            EmittedAt: DateTimeOffset.UtcNow,
            CitedSources: citedSources?.Select(c => c.DocId).ToList(),
            CitedSourcesFull: citedSources?
                .Select(c => new CitationSnapshot(c.SourceId, c.DocId, c.Title, Math.Round(c.Score, 3)))
                .ToList(),
            OntologyBindings: ontologyBindings,
            RegulatoryBasis: regulatoryBasis);

        return new StepRunResult(step, evt);
    }

    private static List<string>? DistinctOrNull(IEnumerable<string> values)
    {
        var distinct = values.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct(StringComparer.Ordinal).ToList();
        return distinct.Count > 0 ? distinct : null;
    }

    public static (string status, string? gateId) EvaluateStatus(
        AgentPackage pkg,
        AgentSpec agent,
        string stepId,
        AgentInvocationResult result)
    {
        var lowThreshold = agent.ConfidenceCalibration?.LowThreshold ?? 0.6;
        var gates = pkg.DigitalWorker.Orchestration.HitlGates;

        // 1) Confidence-based trigger (covers e.g. `step.X.confidence < 0.6`).
        if (result.Confidence < lowThreshold)
        {
            var confGate = gates?.FirstOrDefault(g =>
                g.Trigger.Contains(agent.Capability.Replace('-', '_'), StringComparison.OrdinalIgnoreCase)
                || g.Trigger.Contains(stepId, StringComparison.OrdinalIgnoreCase));
            return ("needs-human-review", confGate?.GateId);
        }

        // 2) Field-value triggers (e.g. `claim.totalLossSuspect == true`,
        //    `assignment.shopTier == 'tier-1'`). High-confidence step can still trip a gate when
        //    its output declares a business condition the package wants reviewed.
        var fieldGate = HitlGateEvaluator.EvaluateFieldGates(
            gates,
            result.Output,
            agent.Capability.Replace('-', '_'));
        if (fieldGate is not null)
            return ("needs-human-review", fieldGate.GateId);

        return ("completed", null);
    }

    public static List<HitlOption> BuildHitlOptions(AgentPackage pkg, TraceStep blocking)
    {
        return
        [
            new HitlOption("approve-as-is", "Approve as-is",       "primary",   $"Operator approved step output for {blocking.Label}."),
            new HitlOption("escalate",      "Escalate to senior",   "secondary", $"Operator escalated {blocking.Label} to a senior reviewer."),
        ];
    }

    // Translate package-side SchemaBinding (PackageModel) into the transport-friendly SchemaContext
    // (ContextLayer) that platform/src/ContextLayer/ can consume without importing PackageModel.
    private static SchemaContext? ToSchemaContext(SchemaBinding? sb)
    {
        if (sb is null) return null;
        return new SchemaContext(
            PrimaryEntity:   Translate(sb.PrimaryEntity),
            SecondaryEntity: Translate(sb.SecondaryEntity),
            SimilarityFilters: sb.SimilarityFilters);
    }

    private static EntitySchema? Translate(EntityBinding? e)
    {
        if (e is null) return null;
        return new EntitySchema(
            FactTable: e.FactTable,
            FactSubjectKey: e.FactSubjectKey,
            FactForeignKey: e.FactForeignKey,
            FactDateColumn: e.FactDateColumn,
            FactDescColumns: e.FactDescColumns,
            DimTable: e.DimTable,
            DimKeyColumn: e.DimKeyColumn,
            DimDisplayColumns: e.DimDisplayColumns);
    }

    private static List<ContextDimension> MapDimensions(ContextBinding? binding)
    {
        if (binding is null) return [ContextDimension.Procedural];
        return binding.Dimensions
            .Select(d => Enum.TryParse<ContextDimension>(d, ignoreCase: true, out var dim) ? dim : (ContextDimension?)null)
            .Where(d => d.HasValue)
            .Select(d => d!.Value)
            .ToList();
    }

    private static string FormatFragments(IReadOnlyList<ContextFragment> fragments)
    {
        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        foreach (var f in fragments)
        {
            sb.AppendLine(inv, $"### {f.DocId} — {f.Title}  [{f.SourceId}, score {f.RelevanceScore:F2}]");
            sb.AppendLine(f.Content.Length > 2000 ? f.Content[..2000] + "…" : f.Content);
            sb.AppendLine();
        }
        return sb.ToString();
    }

    private static string SummariseSteps(IReadOnlyList<TraceStep> steps)
    {
        var lines = steps.Select(s =>
            $"- {s.Label} (conf {s.Confidence:F2}, {s.Origin}, {s.Status}): {Truncate(s.Output, 200)}");
        return string.Join("\n", lines);
    }

    internal static string Truncate(string s, int max)
        => s.Length <= max ? s : s[..max] + "…";
}

public sealed record StepRunResult(TraceStep Step, DecisionEvent Event);
