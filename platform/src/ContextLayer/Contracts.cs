namespace Adp.ContextLayer;

// Public contract for the context layer. Per ADR-0009 the platform federates across Fabric IQ,
// Foundry IQ, and Work IQ. v0 implements Foundry IQ only; the other two return empty.
// Agents call IContextRouter.GetContextAsync; the router fans out to sources, applies dimension
// filtering, and returns a unified Context object.

public enum ContextDimension
{
    Entity,
    Procedural,
    Regulatory,
    Historical,
    Collaboration,
    Temporal,
}

public sealed record ContextRequest(
    string Intent,
    string SubjectId,
    IReadOnlyList<ContextDimension> Dimensions,
    string LatencyTier = "warm",
    // Industry slug from the active package (e.g., "insurance", "banking"). Sources that index across
    // industries (FoundryIQ via AI Search) use this to scope retrieval and avoid cross-industry bleed.
    string? Industry = null,
    // Per-source named-primitive routing for this intent, copied from the package's
    // ContextBinding.SourceBindings. Each source looks up its own SourceId in this dict to find the
    // list of primitives to invoke. Empty list / missing key / null value → source returns empty.
    IReadOnlyDictionary<string, IReadOnlyList<string>?>? SourceBindings = null,
    // Track 5 (ADR-0016): generic semantic schema declaration from the package. FabricLakehouseSource
    // and SqlSemanticLayerSource use this to issue templated queries against the package's tables
    // (Meridian=fact_claims/dim_policyholder/dim_vehicle; banking=fact_loan_applications/dim_borrower).
    // When null, sources fall back to the P&C-default shape for backward compat.
    SchemaContext? SchemaContext = null);

// Minimal, transport-friendly schema descriptor (ContextLayer can't import PackageModel, so we
// re-shape SchemaBinding into this neutral type). StepRunner translates from the package side.
public sealed record SchemaContext(
    EntitySchema? PrimaryEntity = null,
    EntitySchema? SecondaryEntity = null,
    IReadOnlyList<string>? SimilarityFilters = null);

public sealed record EntitySchema(
    string FactTable,
    string FactSubjectKey,
    string FactForeignKey,
    string FactDateColumn,
    IReadOnlyList<string> FactDescColumns,
    string? DimTable = null,
    string? DimKeyColumn = null,
    IReadOnlyList<string>? DimDisplayColumns = null);

public sealed record ContextFragment(
    string SourceId,
    string DocId,
    string Title,
    string Content,
    double RelevanceScore,
    string Origin,                // "GROUNDED" or "DERIVED"
    IReadOnlyList<ContextDimension> Dimensions,
    // v1.1: ontology entity IDs this fragment is bound to (e.g. ["acl:Claim", "acl:Coverage"]).
    // Sourced from the doc's front-matter `ontologyBindings:` field; null when the source / doc
    // doesn't declare any binding. The v2.4 auto-claims ontology is the canonical namespace for
    // the Meridian corpus; banking docs declare against a separate banking ontology when introduced.
    IReadOnlyList<string>? OntologyBindings = null,
    // v1.1: regulatory paragraphs this fragment grounds against (e.g. "NAIC AI Model Bulletin §4.2",
    // "10 CCR §2695.4(a)"). Aggregated upward by StepRunner into TraceStep.RegulatoryBasis so the
    // explainability trace can answer "what regulation does this decision implement?". Null when
    // the doc isn't regulatory in nature.
    IReadOnlyList<string>? RegulatoryBasis = null);

public sealed record ContextResponse(
    string Intent,
    IReadOnlyList<ContextFragment> Fragments,
    long ElapsedMilliseconds);

public interface IContextRouter
{
    Task<ContextResponse> GetContextAsync(ContextRequest request, CancellationToken cancellationToken = default);
}

// One implementation per IQ source (Fabric IQ, Foundry IQ, Work IQ).
public interface IContextSource
{
    string SourceId { get; }
    IReadOnlyList<ContextDimension> SupportedDimensions { get; }
    Task<IReadOnlyList<ContextFragment>> QueryAsync(ContextRequest request, int topK, CancellationToken cancellationToken = default);
}
