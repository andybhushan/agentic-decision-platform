# ADR-0011 — Semantic layer: Azure SQL for v0, Fabric Lakehouse for v1

- **Status:** Accepted; v0 and v1 both implemented (D11, 2026-05-27)
- **Date:** 2026-05-27
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

User flagged 2026-05-27: *"I've not seen any fabric related or semantic layer related work as of now."*

Correct observation. ADR-0009 specced three context sources at L5 — Fabric IQ (entity ontology + business semantics), Foundry IQ (procedural + regulatory knowledge), Work IQ (collaboration). After D1–D9a, only Foundry IQ was real (Azure AI Search vector search over 8 P&C docs). Fabric IQ and Work IQ both returned empty from stub sources.

The **architectural** intent in ADR-0009 was an entity layer that agents query for business semantics: "what's this policyholder's claim history?", "how does this VIN compare to similar claims?", "what's the historical severity distribution for this incident type?". These are SQL-shaped questions, not vector-search-shaped questions. The intended target was a Fabric Lakehouse with a semantic model.

## Options considered

### Option A — Fabric Lakehouse + Semantic Model (the originally intended target)

- Pros: matches ADR-0009 framing; aligns with Microsoft's Fabric IQ branding; Lakehouse + Direct Lake on Power BI gives a clean Gold-tier semantic surface.
- Cons: Fabric is not first-class Bicep — workspace creation needs Fabric REST API or `fabric-cli`; capacity provisioning is its own concern (Trial vs paid Fabric capacity); data loading (Parquet upload + Lakehouse table sync) adds operational steps. Realistically a multi-hour discovery + provisioning task.

### Option B — Azure SQL Database (chosen for v0)

- Pros: Bicep-native; deployed in ~2 minutes; familiar T-SQL + `Microsoft.Data.SqlClient` toolchain; Basic SKU ~$5/month is honest v0 cost; schema + data-load story is mechanically simple.
- Cons: Not Fabric. The user's instinct to want Fabric is correct for the long run — but the semantic shape (entities, queries, intent → SQL mapping) is identical. v1 migrates by swapping `SqlSemanticLayerSource` for a `FabricLakehouseSource` against the same `IContextSource` interface.

### Option C — Cosmos DB SQL API as the semantic store

- Pros: already provisioned; no new resources.
- Cons: Cosmos is for DW *state* (per-claim, mid-flight); using it for cross-claim aggregations conflates concerns and burns RUs unnecessarily. Schema for joins (`fact_claims JOIN dim_policyholder`) is awkward in Cosmos.

### Option D — In-memory / file-backed semantic source

- Pros: zero new infra.
- Cons: doesn't survive Function restarts; can't do interesting aggregations; not a v0-shipping shape.

## Decision

**Option B — Azure SQL Database for v0**, with explicit migration path to Fabric Lakehouse in v1 (see "Migration plan" below).

The semantic shape — three tables (`dim_policyholder`, `dim_vehicle`, `fact_claims`) plus an intent → query mapping — is the architectural commitment. The storage backend is a v0 implementation choice.

## Schema

```sql
CREATE TABLE dim_policyholder (
    policyholder_id NVARCHAR(32) PRIMARY KEY,
    first_name, last_name, policy_number, state, city
);

CREATE TABLE dim_vehicle (
    vin NVARCHAR(32) PRIMARY KEY,
    plate, year INT, make, model
);

CREATE TABLE fact_claims (
    claim_number NVARCHAR(32) PRIMARY KEY,
    policyholder_id NVARCHAR(32) FK,
    vin NVARCHAR(32) FK,
    incident_date, incident_type, severity_hint, state, channel, fnol_received_at
);

CREATE INDEX IX_fact_claims_incidentType_state ON fact_claims(incident_type, state);
CREATE INDEX IX_fact_claims_policyholder      ON fact_claims(policyholder_id);
```

Populated via `adpc semantic-load --corpus usecases/.../claims-1k.json`. Idempotent via MERGE.

## Intent → query mapping (v0)

| Intent (from package's `contextBindings`) | Query | Returns |
|---|---|---|
| `verify_coverage` | Policyholder history (prior claims for the policyholder of this claim) | `POLICYHOLDER_HISTORY/{id}` fragment with per-claim summary, or `POLICYHOLDER_HISTORY_EMPTY` |
| `triage_decision` | Similar claims (same incident type + state) + severity distribution | `SIMILAR_CLAIMS/{claimNumber}` fragment with top-10 prior claims + distribution |
| `assign_adjuster` | Policyholder history (same as verify_coverage) | as above |

Other intents bypass the SQL source. The `IContextRouter` fans out queries in parallel to `AzureSearchFoundryIQSource` (procedural docs) + `SqlSemanticLayerSource` (entity facts) + stubs.

## Consequences

- New Azure resource: `sql-adp-v1` server + `adp-semantic` database (Basic SKU). 20th resource in `rg-adp-v1`. Idle cost +$5/mo.
- New Function app setting: `AZURE_SQL_CONNECTION` (SQL admin password embedded; rotate per ADR-0008 timeline).
- `SqlSemanticLayerSource` implements `IContextSource` and is registered in `TracesApi/Program.cs` DI in place of `StubFabricIqSource`.
- New CLI subcommand `adpc semantic-load` populates the database from the synthetic corpus.
- Console doesn't change — citations from this source appear with `[FabricIQ]` source label and docIds prefixed by `POLICYHOLDER_HISTORY` or `SIMILAR_CLAIMS`.

## Trade-offs accepted

- **SQL admin password in connection string.** v0 reality. Migration to AAD-only auth + private endpoint deferred (ADR-0008's v1 hardening).
- **Public network access enabled** on the SQL server (with broad firewall rule). v0 demo-friendliness over production hardening; private endpoints in v1.
- **Schema is hand-coded T-SQL** in `SqlSemanticLayerSource.EnsureSchemaAsync`. No EF migrations or Liquibase. Acceptable for 3 tables; revisit if the semantic model grows beyond ~10 entities.
- **Source label says "FabricIQ"** even though storage is SQL. Intentional: the *layer* is Fabric IQ per ADR-0009; storage is implementation detail. v1 migration changes no consumer code.

## Migration plan (v1 — Fabric Lakehouse) — IMPLEMENTED 2026-05-27 (D11)

All five steps below were completed in D11. Both v0 (SQL) and v1 (Fabric) are now production-ready; activation is one env-var flip.

1. **Provisioned** Fabric workspace `adp-v1` (id `2da1224a-5142-4752-aebf-844736b503e6`) + Lakehouse `adp` (id `c210bb9f-3225-43cb-b15c-05e2e7e9c0da`) on capacity `offeringsfabric001`. Idempotent via `scripts/provision-fabric.ps1` (Fabric REST API; not Bicep-native).
2. **Loaded** the three semantic tables by uploading CSV files to OneLake Files area via the DFS API, then triggering the Lakehouse `tables/{name}/load` REST endpoint with `mode=Overwrite`, `format=Csv`. Idempotent via `scripts/load-fabric-lakehouse.ps1`. 1000 rows per table, matches the v0 SQL load exactly. Triggered an explicit `sqlEndpoints/.../refreshMetadata` after load to populate the SQL analytics endpoint immediately (otherwise auto-syncs in 1–5 minutes).
3. **`FabricLakehouseSource : IContextSource`** in `platform/src/ContextLayer/FabricLakehouseSource.cs`. Implementation deltas vs `SqlSemanticLayerSource`: AAD-only auth (`DefaultAzureCredential` + `https://database.windows.net/.default` scope, token attached to `SqlConnection.AccessToken`); no `EnsureSchemaAsync` (Lakehouse SQL endpoint is read-only); intent dispatch split into multiple round-trips instead of `DECLARE @var; SELECT ...` batches. Returns the same `ContextFragment` shape (same `SourceId="FabricIQ"`, same `POLICYHOLDER_HISTORY/{id}` and `SIMILAR_CLAIMS/{claim}` docIds).
4. **DI updated** in `TracesApi/Program.cs` + `PackageCompiler/Program.cs` with `SEMANTIC_BACKEND` env-var selector: `fabric` → FabricLakehouseSource, `sql` → SqlSemanticLayerSource, unset → SQL-if-configured-else-stub. **The migration is one env-var change**, no code redeploy required after the D11 deployment.
5. **`sql-adp-v1` decommissioning** — DEFERRED. Both backends coexist for v0→v1 cutover de-risking. Decommission once v1 has soaked in production for 1+ week. v0 stays "warm" as fallback at $5/mo for that period.

## Activation

```powershell
$connStr = 'Server=tcp:vlbqw5fplx3efe42wliapjqney-jirkclkckfjeplv7qrdtnnid4y.datawarehouse.fabric.microsoft.com,1433;Database=adp;Encrypt=true;TrustServerCertificate=false;Connection Timeout=60;'
az functionapp config appsettings set -g rg-adp-v1 -n func-adp-v1-fnol --settings SEMANTIC_BACKEND=fabric FABRIC_LAKEHOUSE_CONNECTION=$connStr
```

Set `SEMANTIC_BACKEND=sql` (or unset) to revert. No code redeploy needed either direction.

## v1 validation (D11)

- ✅ FNOL run `trc-19e6959f5b1` on `CLM-2026-10007` completed all 4 steps against the Fabric Lakehouse.
- ✅ Step 2 (coverage-verify) cited `SIMILAR_CLAIMS/CLM-2026-10007` — direct from Fabric.
- ✅ Step 3 (initial-triage) cited `POLICYHOLDER_HISTORY/PH-791226` — direct from Fabric.
- ✅ Function system-MI (`a4318002-a996-4000-aea0-31aa4e70aabe`) granted `Viewer` on workspace `adp-v1`; AAD token flow works end-to-end through the deployed Function.
- ✅ Local smoke (`dotnet run` + `FabricLakehouseSource.FromEnvironment()`) returns identical fragment shape to the v0 SQL source on the same claim.

## Permissions model

The Fabric workspace `adp-v1` has one role assignment beyond the deployer:

| Principal | Type | Role |
|---|---|---|
| `func-adp-v1-fnol` system MI (`a4318002-…aabe`) | ServicePrincipal | Viewer |

Viewer is sufficient — the read-side Lakehouse SQL endpoint only requires read access. The data-load path runs from the user's az CLI session (which has admin), not from the workload identity.

## Operational footprint of v1

| Resource | Cost (idle) | Notes |
|---|---|---|
| Fabric workspace `adp-v1` | $0 (per-workspace) | Bound to `offeringsfabric001` capacity; capacity cost is borne by the tenant, not this RG |
| Lakehouse `adp` | $0 | Storage = OneLake (~220KB for 3K rows of CSV + Delta logs) |
| OneLake transactions | negligible | Per-query: ~100KB read, sub-second |

Net: the v1 path adds **zero new line-item billing** to `rg-adp-v1` while v0 (`sql-adp-v1` Basic SKU at $5/mo) is retained.

## Validation

- ✅ `adpc semantic-load --corpus claims-1k.json`: 1000 policyholders + 1000 vehicles + 1000 claims inserted via MERGE.
- ✅ Function `RunStepActivity` queries the SQL source for `verify_coverage`, `triage_decision`, `assign_adjuster` intents.
- ✅ End-to-end smoke test on `CLM-2026-10006`: trace `trc-19e69151340` cites `POLICYHOLDER_HISTORY_EMPTY` (claim-intake) and `SIMILAR_CLAIMS/CLM-2026-10006` (coverage-verification) alongside AI Search docs.
- ✅ Model integrates SQL + AI Search context honestly (drops confidence on coverage-verify when SQL returns ambiguous similar-claims data).
