using System.Text.Json.Serialization;

namespace Adp.PackageModel;

public sealed record AgentPackage(
    [property: JsonPropertyName("package")]          PackageMetadata Package,
    [property: JsonPropertyName("digitalWorker")]    DigitalWorker DigitalWorker,
    [property: JsonPropertyName("agents")]           IReadOnlyList<AgentSpec> Agents,
    [property: JsonPropertyName("skills")]           IReadOnlyList<SkillRef> Skills,
    [property: JsonPropertyName("tools")]            IReadOnlyList<ToolRef> Tools,
    [property: JsonPropertyName("contextBindings")]  IReadOnlyList<ContextBinding>? ContextBindings = null,
    [property: JsonPropertyName("decisionJournal")]  DecisionJournal? DecisionJournal = null);

public sealed record PackageMetadata(
    [property: JsonPropertyName("id")]            string Id,
    [property: JsonPropertyName("version")]       string Version,
    [property: JsonPropertyName("industry")]      string Industry,
    [property: JsonPropertyName("useCase")]       string UseCase,
    [property: JsonPropertyName("schemaVersion")] string SchemaVersion,
    [property: JsonPropertyName("signedBy")]      string? SignedBy = null,
    [property: JsonPropertyName("registeredIn")]  string? RegisteredIn = null,
    [property: JsonPropertyName("compiledAt")]    DateTimeOffset? CompiledAt = null);

public sealed record DigitalWorker(
    [property: JsonPropertyName("id")]             string Id,
    [property: JsonPropertyName("name")]           string Name,
    [property: JsonPropertyName("capabilities")]   IReadOnlyList<string> Capabilities,
    [property: JsonPropertyName("agentRefs")]      IReadOnlyList<string> AgentRefs,
    [property: JsonPropertyName("slos")]           IReadOnlyList<SloDecl> Slos,
    [property: JsonPropertyName("orchestration")]  Orchestration Orchestration,
    [property: JsonPropertyName("description")]    string? Description = null,
    [property: JsonPropertyName("entraAgentId")]   string? EntraAgentId = null,
    [property: JsonPropertyName("stateStore")]     StateStore? StateStore = null,
    [property: JsonPropertyName("corpusBinding")]  CorpusBinding? CorpusBinding = null,
    [property: JsonPropertyName("schemaBinding")]  SchemaBinding? SchemaBinding = null);

// Track 5 (ADR-0016): declares the Fabric/SQL schema this package's semantic queries should target.
// The platform's row-level primitives (primary-entity-history, similar-by-attributes, secondary-entity-history)
// are generic shapes; the package teaches its tables + columns. Without a SchemaBinding, the source
// falls back to the P&C-default shape (fact_claims/dim_policyholder/dim_vehicle) for backward compat.
public sealed record SchemaBinding(
    [property: JsonPropertyName("primaryEntity")]    EntityBinding? PrimaryEntity = null,
    [property: JsonPropertyName("secondaryEntity")]  EntityBinding? SecondaryEntity = null,
    [property: JsonPropertyName("similarityFilters")] IReadOnlyList<string>? SimilarityFilters = null);

public sealed record EntityBinding(
    [property: JsonPropertyName("factTable")]           string FactTable,
    [property: JsonPropertyName("factSubjectKey")]      string FactSubjectKey,
    [property: JsonPropertyName("factForeignKey")]      string FactForeignKey,
    [property: JsonPropertyName("factDateColumn")]      string FactDateColumn,
    [property: JsonPropertyName("factDescColumns")]     IReadOnlyList<string> FactDescColumns,
    [property: JsonPropertyName("dimTable")]            string? DimTable = null,
    [property: JsonPropertyName("dimKeyColumn")]        string? DimKeyColumn = null,
    [property: JsonPropertyName("dimDisplayColumns")]   IReadOnlyList<string>? DimDisplayColumns = null,
    // v1.1: ontology entity ID this table maps to (e.g. "acl:Claim", "acl:Vehicle"). Optional
    // label for now — surfaces in traces + docs portal so the runtime is honest about what each
    // Delta table represents in the v2.4 ontology vocabulary.
    [property: JsonPropertyName("entitySemantics")]     string? EntitySemantics = null);

// Optional declaration of how the platform should resolve subject records from the corpus JSON file.
// Default (when null): root array key "claims" + per-entry id field "claimNumber" (P&C-shaped historical default).
public sealed record CorpusBinding(
    [property: JsonPropertyName("arrayKey")]        string ArrayKey = "claims",
    [property: JsonPropertyName("subjectIdField")]  string SubjectIdField = "claimNumber");

public sealed record StateStore(
    [property: JsonPropertyName("kind")]           string Kind,
    [property: JsonPropertyName("containerName")]  string? ContainerName = null,
    [property: JsonPropertyName("partitionKey")]   string? PartitionKey = null);

public sealed record SloDecl(
    [property: JsonPropertyName("metric")]      string Metric,
    [property: JsonPropertyName("target")]      double Target,
    [property: JsonPropertyName("window")]      string Window,
    [property: JsonPropertyName("comparator")]  string Comparator = "<=");

public sealed record Orchestration(
    [property: JsonPropertyName("strategy")]               string Strategy,
    [property: JsonPropertyName("stepFormation")]          string StepFormation,
    [property: JsonPropertyName("boundedReasoningZones")]  IReadOnlyList<BoundedReasoningZone>? BoundedReasoningZones = null,
    [property: JsonPropertyName("invariants")]             IReadOnlyList<Invariant>? Invariants = null,
    [property: JsonPropertyName("hitlGates")]              IReadOnlyList<HitlGate>? HitlGates = null);

public sealed record BoundedReasoningZone(
    [property: JsonPropertyName("zoneId")]         string ZoneId,
    [property: JsonPropertyName("allowedAgents")]  IReadOnlyList<string> AllowedAgents,
    [property: JsonPropertyName("maxSteps")]       int MaxSteps,
    [property: JsonPropertyName("returnPoint")]    string ReturnPoint);

public sealed record Invariant(
    [property: JsonPropertyName("id")]             string Id,
    [property: JsonPropertyName("description")]    string Description,
    [property: JsonPropertyName("ruleExpression")] string RuleExpression);

public sealed record HitlGate(
    [property: JsonPropertyName("gateId")]   string GateId,
    [property: JsonPropertyName("trigger")]  string Trigger,
    [property: JsonPropertyName("surface")]  string Surface);

public sealed record AgentSpec(
    [property: JsonPropertyName("id")]                     string Id,
    [property: JsonPropertyName("kind")]                   string Kind,
    [property: JsonPropertyName("capability")]             string Capability,
    [property: JsonPropertyName("systemPrompt")]           string SystemPrompt,
    [property: JsonPropertyName("skillRefs")]              IReadOnlyList<string> SkillRefs,
    [property: JsonPropertyName("ontologyBinding")]        IReadOnlyList<string>? OntologyBinding = null,
    [property: JsonPropertyName("confidenceCalibration")]  ConfidenceCalibration? ConfidenceCalibration = null,
    [property: JsonPropertyName("foundryModel")]           string? FoundryModel = null,
    [property: JsonPropertyName("deploymentTarget")]       string? DeploymentTarget = null);

public sealed record ConfidenceCalibration(
    [property: JsonPropertyName("lowThreshold")]         double LowThreshold,
    [property: JsonPropertyName("highThreshold")]        double HighThreshold,
    [property: JsonPropertyName("divergenceDetection")]  bool DivergenceDetection = false);

public sealed record SkillRef(
    [property: JsonPropertyName("id")]         string Id,
    [property: JsonPropertyName("name")]       string Name,
    [property: JsonPropertyName("skillFile")]  string SkillFile,
    [property: JsonPropertyName("promptFile")] string? PromptFile = null,
    [property: JsonPropertyName("evalFile")]   string? EvalFile = null,
    [property: JsonPropertyName("domain")]     string? Domain = null);

public sealed record ToolRef(
    [property: JsonPropertyName("id")]                string Id,
    [property: JsonPropertyName("name")]              string Name,
    [property: JsonPropertyName("mcpEndpoint")]       string McpEndpoint,
    [property: JsonPropertyName("auth")]              ToolAuth? Auth = null,
    [property: JsonPropertyName("backendComponent")]  string? BackendComponent = null);

public sealed record ToolAuth(
    [property: JsonPropertyName("kind")]   string Kind,
    [property: JsonPropertyName("scope")]  string? Scope = null);

public sealed record ContextBinding(
    [property: JsonPropertyName("intent")]          string Intent,
    [property: JsonPropertyName("dimensions")]      IReadOnlyList<string> Dimensions,
    [property: JsonPropertyName("latencyTier")]     string LatencyTier = "warm",
    // Per-source named-primitive routing. Key = SourceId (e.g., "FabricIQ", "WorkIQ"); value = list of
    // named primitive(s) the source should invoke for this intent. Empty list / null = "this source
    // has nothing to contribute for this intent" → clean empty degradation. Lets a single intent pull
    // multiple shapes from one source (e.g., row-level history AND aggregated rollup).
    //
    // JSON shape: { "FabricIQ": ["policyholder-history", "severity-distribution-by-state"], "WorkIQ": ["triage-supervisor-thread"] }
    [property: JsonPropertyName("sourceBindings")]  IReadOnlyDictionary<string, IReadOnlyList<string>?>? SourceBindings = null);

public sealed record DecisionJournal(
    [property: JsonPropertyName("eventHubTopic")]      string? EventHubTopic = null,
    [property: JsonPropertyName("provenanceTagging")]  ProvenanceTagging? ProvenanceTagging = null,
    [property: JsonPropertyName("rtiTable")]           string? RtiTable = null,
    [property: JsonPropertyName("bronzeTable")]        string? BronzeTable = null);

public sealed record ProvenanceTagging(
    [property: JsonPropertyName("defaultOrigin")] string DefaultOrigin = "DERIVED");
