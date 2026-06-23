# ADR-0016 — Schema-aware semantic primitive (entity-history) on Fabric Lakehouse

- **Status:** Accepted (v1, Track 5)
- **Date:** 2026-05-28
- **Deciders:** Anand Bhushan

## Context

Banking stress test (FINDINGS.md, 2026-05-27) identified that the platform's row-level Fabric primitives (`policyholder-history`, `similar-claims`, `vehicle-history`) had `dim_policyholder` / `dim_vehicle` / `fact_claims` table + column names hardcoded in their SQL. Banking packages had to leave `FabricIQ: null` in their sourceBindings because no banking-shaped primitives existed.

Goal: a banking package gets *real* Fabric IQ entity-history context against `dim_borrower` + `fact_loan_applications`, without platform code mentioning banking-specific table names.

## Decision

Add ONE new generic primitive `entity-history` to `FabricLakehouseSource`. The primitive reads `ContextRequest.SchemaContext` (translated from the package's `digitalWorker.schemaBinding`) and issues a SQL-templated query against the package's declared tables + columns. Industry-agnostic — Meridian, banking, healthcare packages all use the same primitive name and just declare their own schema.

Existing P&C primitives (`policyholder-history`, `similar-claims`, `vehicle-history`) remain unchanged for backward compat. Meridian packages can continue to use them OR switch to `entity-history` by adding a `schemaBinding` block. Banking package switches to `entity-history` for its 2 intents.

## Schema additions

- `DigitalWorker.schemaBinding` — optional, declares primary + secondary entity tables/columns + similarity filters.
- `EntityBinding` — `factTable`, `factSubjectKey`, `factForeignKey`, `factDateColumn`, `factDescColumns[]`, optional `dimTable` + `dimKeyColumn` + `dimDisplayColumns[]`.
- `ContextRequest.SchemaContext` — transport-shaped twin of SchemaBinding used by the ContextLayer (which can't import PackageModel).
- `EntitySchema` — the EntityBinding equivalent inside ContextLayer.
- StepRunner translates between them: `pkg.DigitalWorker.SchemaBinding` → `SchemaContext` per request.

## Implementation

`FabricLakehouseSource.EntityHistoryAsync` (new method):

1. Reads `request.SchemaContext.PrimaryEntity`. Returns empty if null (clean degradation).
2. **Validates identifiers** — only `[A-Za-z0-9_]` allowed in table/column names. Even though SchemaBinding comes from signed packages, defence-in-depth prevents SQL injection via the schema declaration.
3. Resolves the subject's foreign-key (entity-id) from FactTable.
4. Issues parameterised `SELECT TOP (@topK) ... FROM <factTable> c [JOIN <dimTable> d ON d.<dimKey>=c.<factForeignKey>] WHERE c.<factForeignKey> = @ent AND c.<factSubjectKey> <> @subj ORDER BY c.<factDateColumn> DESC`.
5. Formats the narrative using FactDescColumns + DimDisplayColumns (display name from dim row, summary line per fact row).

Returns a single `ContextFragment` with `DocId = ENTITY_HISTORY/{entityId}`.

## Banking activation

`usecases/banking-loan-origination/packages/loan-handler.json` now has:

```json
"schemaBinding": {
  "primaryEntity": {
    "factTable": "fact_loan_applications",
    "factSubjectKey": "application_id",
    "factForeignKey": "borrower_id",
    "factDateColumn": "application_date",
    "factDescColumns": ["loan_purpose", "decision", "state"],
    "dimTable": "dim_borrower",
    "dimKeyColumn": "borrower_id",
    "dimDisplayColumns": ["full_name"]
  },
  "similarityFilters": ["loan_purpose", "state"]
},
...
"contextBindings": [
  { "intent": "parse_loan_application", "sourceBindings": { "FabricIQ": ["entity-history"], "WorkIQ": null } },
  { "intent": "evaluate_eligibility",   "sourceBindings": { "FabricIQ": ["entity-history"], "WorkIQ": null } }
]
```

Banking Fabric tables provisioned: `scripts/load-fabric-banking.ps1` loaded `dim_borrower` (30 rows) + `fact_loan_applications` (40 rows) into the same Lakehouse `adp`. Some borrowers have multiple applications so `entity-history` returns meaningful results.

## Consequences

- Banking now gets `ENTITY_HISTORY/BOR-NNNNNN` citations in its agent traces — first time banking has non-empty Fabric IQ context. The boundary holds: platform code has zero banking-specific table names.
- Meridian packages can opt into `entity-history` later by declaring schemaBinding for `fact_claims/dim_policyholder`. v1 keeps existing primitives for compatibility.
- One new ADR; documented as Track 5.

## Trade-offs accepted

- **Two parallel implementations** of "primary-entity-history" — Meridian's `policyholder-history` (P&C-hardcoded SQL) and the generic `entity-history` (schema-templated). Acceptable for v1; v1.5 deprecates the hardcoded ones once Meridian packages migrate to schemaBinding.
- **`similar-by-attributes` + `secondary-entity-history` generic primitives not implemented this round.** Only `entity-history` (the primary-entity equivalent). Banking's 2 intents map to both `parse_loan_application` and `evaluate_eligibility` against the same primitive for now; v1.5 adds the missing two generic primitives.
- **Identifier validation is conservative** — only ASCII letters/digits/underscore. Real-world schemas might use dots (`schema.table`) or brackets — defer until needed.

## Validation

- ✅ Schema validation passes for both Meridian packages (no `schemaBinding`) and banking package (with `schemaBinding`).
- ✅ `dotnet build` clean.
- ✅ Banking Fabric tables loaded; SQL endpoint metadata refresh requested.
- Cloud smoke after final deploy: banking stress-test on `LOAN-2026-00001` should cite `ENTITY_HISTORY/BOR-100001` showing Maria's PRIOR `LOAN-2026-00004` application from August 2025.
