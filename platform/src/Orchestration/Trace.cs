using System.Text.Json.Serialization;

namespace Adp.Orchestration;

// Wire-compatible with platform/console/src/types.ts.
// One contract; two consumers (JSON on the API side, TypeScript on the console side).

public sealed record Trace(
    [property: JsonPropertyName("traceId")]    string TraceId,
    [property: JsonPropertyName("subject")]    string Subject,
    [property: JsonPropertyName("package")]    PackageRef Package,
    [property: JsonPropertyName("steps")]      IReadOnlyList<TraceStep> Steps,
    [property: JsonPropertyName("hitlOptions")] IReadOnlyList<HitlOption> HitlOptions,
    [property: JsonPropertyName("slos")]       IReadOnlyList<SloEntry> Slos,
    [property: JsonPropertyName("startedAt")]  DateTimeOffset StartedAt);

public sealed record PackageRef(
    [property: JsonPropertyName("id")]            string Id,
    [property: JsonPropertyName("version")]       string Version,
    [property: JsonPropertyName("schemaVersion")] string SchemaVersion,
    [property: JsonPropertyName("agentCount")]    int AgentCount,
    [property: JsonPropertyName("skillCount")]    int SkillCount,
    [property: JsonPropertyName("toolCount")]     int ToolCount);

public sealed record TraceStep(
    [property: JsonPropertyName("stepId")]       string StepId,
    [property: JsonPropertyName("agentId")]      string AgentId,
    [property: JsonPropertyName("label")]        string Label,
    [property: JsonPropertyName("confidence")]   double Confidence,
    [property: JsonPropertyName("status")]       string Status,
    [property: JsonPropertyName("origin")]       string Origin,
    [property: JsonPropertyName("output")]       string Output,
    [property: JsonPropertyName("durationMs")]   long DurationMs,
    [property: JsonPropertyName("hitlGateId")]   string? HitlGateId = null,
    [property: JsonPropertyName("toolCalls")]    IReadOnlyList<ToolCallRecord>? ToolCalls = null,
    // v1.1: structured citation list aggregated from ContextFragments returned to the agent. Each
    // entry preserves docId + title + sourceId + score so the console + decision journal don't have
    // to scrape them back out of the prose `output` field.
    [property: JsonPropertyName("citedSources")]    IReadOnlyList<CitedSource>? CitedSources = null,
    // v1.1: distinct union of all `ontologyBindings` declared by the cited fragments (e.g.
    // ["acl:Claim", "acl:Coverage"]). Answers the auditor question "which canonical entities did
    // this decision touch?". The v2.4 auto-claims ontology is the namespace for Meridian.
    [property: JsonPropertyName("ontologyBindings")] IReadOnlyList<string>? OntologyBindings = null,
    // v1.1: distinct union of all `regulatoryBasis` declared by the cited regulatory fragments
    // (e.g. "NAIC AI Model Bulletin §4.2", "10 CCR §2695.7(b)(1)"). Closes the agentic-claims-alpha
    // PRD's per-paragraph regulatory mapping ask. Empty list when no regulatory doc was cited.
    [property: JsonPropertyName("regulatoryBasis")]  IReadOnlyList<string>? RegulatoryBasis = null);

public sealed record CitedSource(
    [property: JsonPropertyName("sourceId")]   string SourceId,
    [property: JsonPropertyName("docId")]      string DocId,
    [property: JsonPropertyName("title")]      string Title,
    [property: JsonPropertyName("score")]      double Score);

public sealed record ToolCallRecord(
    [property: JsonPropertyName("toolId")]       string ToolId,
    [property: JsonPropertyName("arguments")]    string Arguments,         // JSON-serialised args
    [property: JsonPropertyName("result")]       string Result,            // truncated result preview
    [property: JsonPropertyName("durationMs")]   long DurationMs,
    [property: JsonPropertyName("success")]      bool Success);

public sealed record HitlOption(
    [property: JsonPropertyName("optionId")]        string OptionId,
    [property: JsonPropertyName("label")]           string Label,
    [property: JsonPropertyName("appearance")]      string Appearance,
    [property: JsonPropertyName("overrideOutput")]  string OverrideOutput);

public sealed record SloEntry(
    [property: JsonPropertyName("metric")] string Metric,
    [property: JsonPropertyName("target")] string Target,
    [property: JsonPropertyName("window")] string Window);
