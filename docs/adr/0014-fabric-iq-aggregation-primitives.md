# ADR-0014 — Fabric IQ via Lakehouse aggregation primitives (v1 cut)

- **Status:** Accepted (v1)
- **Date:** 2026-05-28
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

After D11, the v1 "Fabric IQ" source was honestly just row-level T-SQL over the Lakehouse SQL endpoint (`SELECT * FROM fact_claims WHERE policyholder_id = ...`). The architectural label says "Fabric IQ"; the implementation was T-SQL row reads. User flagged this directly: *"We are using Fabric? not fabric IQ? I see there is not semantic model then how come we say we're using Fabric IQ?"* — a fair observation.

The maximalist target is a Power BI semantic model on Direct Lake over the Lakehouse with custom DAX measures + relationships, queried via Power BI REST `executeQueries` or XMLA. That delivers true "Fabric IQ" (named measures, business semantics, Copilot integration). It requires either:

- Manual portal authoring of the semantic model (TMDL files in `.SemanticModel` artifact, defining tables / relationships / measures), or
- Programmatic creation via Fabric REST POST with base64-encoded TMDL parts.

Both routes are non-trivial. The TMDL definitions for Direct Lake are intricate; portal-driven authoring is fast but manual; REST-driven authoring needs the full TMDL grammar.

## Options considered

### Option A — Full Power BI semantic model with named DAX measures, Direct Lake on Lakehouse

- Pros: matches the canonical "Fabric IQ" definition. Named measures (`Claim Count`, `Total Loss Rate`, `Avg Severity by State`) are queryable via `executeQueries` REST. Cached values speed repeat queries. Copilot-for-PowerBI integration becomes available.
- Cons: ~1-1.5d work for the model authoring alone; TMDL grammar deep dive; one-shot manual authoring is fast but not idempotent / version-controlled cleanly without git integration setup. v1 schedule pressure.

### Option B — Aggregation primitives via Lakehouse SQL endpoint (chosen for v1)

- Pros: same Lakehouse, same SQL endpoint already provisioned. Aggregations (GROUP BY / COUNT / SUM CASE WHEN / DATEPART) deliver functionally equivalent rollups for the agent context use case. Zero new infrastructure. Idempotent and version-controlled in code. ~2 hours to implement.
- Cons: not a "real" semantic model. No named DAX measures (the rollup definitions live in C# code, not in Fabric). No cached values. No Copilot integration. The "Fabric IQ" label remains accurate at the Lakehouse-default-semantic-model level — but not at the named-measures level.

### Option C — Use Lakehouse's default semantic model with on-the-fly DAX

- Pros: every Lakehouse auto-creates a "default semantic model" surface. Could query it via `executeQueries` with inline DAX expressions like `EVALUATE ROW("count", COUNTROWS(fact_claims))`.
- Cons: per-call overhead of DAX parsing without cached measures; one more layer of indirection vs. Option B's direct SQL endpoint. No business value beyond Option B for the agent-context use case.

## Decision

**Option B — Aggregation primitives via Lakehouse SQL endpoint.**

Concretely: extended `FabricLakehouseSource` with 4 new named primitives that issue GROUP BY / aggregate queries against the existing Delta tables. These deliver business-rollup context to agents: severity distribution by state, hour-of-day FNOL concentration (fraud signal), state loss-ratio, and incident-type mix by state. The package's `contextBindings[].sourceBindings["FabricIQ"]` block can list these alongside the row-level primitives — a single intent can now pull both a per-policyholder history AND a state-level severity rollup in one decision step.

Migration path to Option A (real Power BI semantic model with DAX measures) is preserved: the package's source-binding map is the API. v1.5 work would author the semantic model in Fabric, add a `FabricSemanticModelSource` with the same primitive names (`severity-distribution-by-state` etc.) but backed by `executeQueries` DAX, then DI-swap the implementations. Zero package change required.

## Implementation

### Source-side widening (contract change)

`ContextBinding.SourceBindings` and `ContextRequest.SourceBindings` value type changed from `string?` to `IReadOnlyList<string>?`. Reason: a single intent benefits from multiple primitives per source (e.g., fraud-pattern-scan wants similar-claims AND hour-of-day-concentration AND incident-type-mix). Empty list / null = "source has nothing for this intent" (clean degradation, same semantics as before).

All 3 sources updated to iterate the list and combine fragments. Banking package's null bindings continue to degrade cleanly.

### New primitives in `FabricLakehouseSource`

| Primitive name | What it returns | Used by |
|---|---|---|
| `severity-distribution-by-state` | "Severity distribution across 240 prior claims in IL: low: 152 (63.3%), medium: 58 (24.2%), high: 22 (9.2%), total-loss-suspect: 8 (3.3%)" | `triage_decision`, `assess_damage` |
| `hour-of-day-concentration` | Hourly FNOL count distribution + flags whether the subject's claim is in the off-hours band (00:00-05:59 = fraud-suggestive per PAC-FRD-001) | `analyze_fraud_patterns` |
| `state-loss-ratio` | Total-loss-suspect rate + high-or-above severity rate for the subject's state | `calculate_settlement` |
| `incident-type-mix-by-state` | Top 10 incident types in the state with counts + this-claim marker | `estimate_repair`, `analyze_fraud_patterns` |

These are honest "semantic rollups" — the same business signals a Power BI measure would surface, computed on-the-fly via the Lakehouse SQL endpoint.

### Package updates

- fnol-handler: `triage_decision` now pulls `similar-claims` + `severity-distribution-by-state`.
- damage-handler: `assess_damage` pulls `similar-claims` + `severity-distribution-by-state`; `estimate_repair` pulls `vehicle-history` + `incident-type-mix-by-state`.
- fraud-handler: `analyze_fraud_patterns` pulls `similar-claims` + `hour-of-day-concentration` + `incident-type-mix-by-state` (3 rollups for the pattern scan).
- settlement-handler: `calculate_settlement` pulls `vehicle-history` + `state-loss-ratio`.
- banking-loan-origination: no Fabric bindings yet (deferred to Track 5 — schema-aware sources + banking-side tables).

## Consequences

- The "Fabric IQ" label is now honest at the *aggregation rollup* level. A fraud-pattern-scan trace now cites `SEVERITY_DIST/IL`, `HOUR_OF_DAY/CLM-...`, `INCIDENT_MIX/IL` — these are genuinely Fabric Lakehouse signals, not row-level reads.
- `SourceBindings` is now a list, not a single string. Schema and code updated. All 5 packages migrated.
- No new Azure resources required.
- No latency degradation (aggregation queries on 1K-row tables are sub-100ms).
- The TracesApi Function continues to use the same Lakehouse SQL endpoint, same MI access, same SEMANTIC_BACKEND env var.

## Trade-offs accepted

- **Not a "real" Power BI semantic model.** Named DAX measures don't exist. Aggregations run on-the-fly. Acceptable for v1; v1.5 lifts to a real semantic model when time permits.
- **Aggregation logic in C# code, not in Fabric.** Means semantic-model authoring discipline (measure definitions, descriptions, formatting) doesn't live in Fabric. Acceptable v1 trade-off.
- **No Copilot-for-PowerBI integration.** Not a v1 demo asset; deferred.
- **`SourceBindings` widened from `string?` to `IReadOnlyList<string>?`** — minor backward-incompatible schema change. Migration was small (5 packages) and absorbed in this same change set.

## Migration plan (v1.5 — Power BI semantic model with DAX)

1. Author semantic model in Fabric portal: workspace `adp-v1` → New → Semantic model → Direct Lake on Lakehouse `adp`. Add 2 relationships (`fact_claims[policyholder_id]` → `dim_policyholder`, `fact_claims[vin]` → `dim_vehicle`). Add 5-8 named measures (Claim Count, Avg Severity Rank, Total Loss Rate, Claims by State, Hour-of-Day Concentration, Avg Vehicle Year, Severity Distribution, Claim Frequency Per Policyholder).
2. Capture the model's ID + workspace ID; store as `FABRIC_SEMANTIC_MODEL_ID` Function app setting.
3. New source `FabricSemanticModelSource : IContextSource` issues DAX via Power BI REST `executeQueries`. Same primitive names as today's `FabricLakehouseSource`. Auth via `DefaultAzureCredential` against `https://analysis.windows.net/powerbi/api/.default`.
4. DI swap: keep `FabricLakehouseSource` for row-level primitives; route aggregation primitives through `FabricSemanticModelSource` (Composite IContextSource per primitive type).
5. Zero package change.

## Validation

- ✅ All 5 packages compile clean with new list-valued sourceBindings.
- ✅ Bundled into `TracesApi/Resources` — 4 Meridian zips ready for deploy.
- ✅ ADR-0011 (semantic layer SQL→Fabric) chain extended honestly: D10=SQL, D11=Fabric Lakehouse row-level, ADR-0014=Fabric Lakehouse aggregation rollups. v1.5=Power BI semantic model.
- Cloud verification after deploy: a fraud-pattern-scan trace will cite 3 Fabric rollups (`SEVERITY_DIST`, `HOUR_OF_DAY`, `INCIDENT_MIX`) interleaved with PAC-FRD-* knowledge docs.
