using System.Text.Json.Serialization;

namespace Adp.DecisionIngest;

// Decision Journal wire format per ADR-0004. One event per agent step within a trace.
// Persisted via:
//   Plan Executor → Event Hubs (Kafka API) → Decision-Ingest service → Cosmos (dw-state container)
//                                          → RTI (KQL eventhouse, future)
//                                          → Bronze (cold-storage medallion, future)
// Partition key on Event Hubs: digitalWorkerId. Cosmos partition key: /subjectId.

public sealed record DecisionEvent(
    [property: JsonPropertyName("decisionId")]      string DecisionId,       // unique per event — idempotency key
    [property: JsonPropertyName("traceId")]         string TraceId,
    [property: JsonPropertyName("subjectId")]       string SubjectId,
    [property: JsonPropertyName("digitalWorkerId")] string DigitalWorkerId,
    [property: JsonPropertyName("packageId")]       string PackageId,
    [property: JsonPropertyName("packageVersion")]  string PackageVersion,
    [property: JsonPropertyName("packageSchemaVersion")] string PackageSchemaVersion,
    [property: JsonPropertyName("agentCount")]      int AgentCount,
    [property: JsonPropertyName("skillCount")]      int SkillCount,
    [property: JsonPropertyName("toolCount")]       int ToolCount,
    [property: JsonPropertyName("stepId")]          string StepId,
    [property: JsonPropertyName("stepLabel")]       string StepLabel,
    [property: JsonPropertyName("agentId")]         string AgentId,
    [property: JsonPropertyName("confidence")]      double Confidence,
    [property: JsonPropertyName("status")]          string Status,
    [property: JsonPropertyName("origin")]          string Origin,
    [property: JsonPropertyName("outputSummary")]   string OutputSummary,
    [property: JsonPropertyName("hitlGateId")]      string? HitlGateId,
    [property: JsonPropertyName("toolCallCount")]   int ToolCallCount,
    [property: JsonPropertyName("durationMs")]      long DurationMs,
    [property: JsonPropertyName("slos")]            IReadOnlyList<SloSnapshot> Slos,
    [property: JsonPropertyName("emittedAt")]       DateTimeOffset EmittedAt,
    // v1.1: flat doc-id list of fragments cited on this step (e.g. ["PAC-COV-001", "PAC-REG-001"]).
    // Flat strings keep the Cosmos / Event Hubs wire payload small; full citation objects live on
    // the trace itself.
    [property: JsonPropertyName("citedSources")]    IReadOnlyList<string>? CitedSources = null,
    // v1.1: distinct ontology entity IDs touched by this step.
    [property: JsonPropertyName("ontologyBindings")] IReadOnlyList<string>? OntologyBindings = null,
    // v1.1: distinct regulatory paragraph IDs this step grounded against. Closes the per-paragraph
    // regulatory-mapping ask from the agentic-claims-alpha PRD (Renee persona).
    [property: JsonPropertyName("regulatoryBasis")]  IReadOnlyList<string>? RegulatoryBasis = null);

// SloDecl re-serialised into a flat shape that travels with each event.
// Small (≤ 5 per DW); duplicated per event for v0 simplicity.
public sealed record SloSnapshot(
    [property: JsonPropertyName("metric")] string Metric,
    [property: JsonPropertyName("target")] string Target,
    [property: JsonPropertyName("window")] string Window);
