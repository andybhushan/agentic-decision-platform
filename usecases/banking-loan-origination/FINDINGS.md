# Findings — banking-loan-origination stress test of platform boundary

**Run date:** 2026-05-27
**Hypothesis:** the ADP platform should run a non-P&C package end-to-end without modifying `platform/src/`. Quality degradation is OK; hard breaks are leakage.

## Headline

**The platform IS approach #3 (agnostic platform + use case authored separately) — empirically.** A 2-agent banking package, NOT a single line touched in `platform/src/`, ran end-to-end through `adpc compile` + `adpc execute --adapter foundry --search-mode azure` with correct arithmetic (DTI 37.8%, LTV 86.4%, FICO 749) and a grounded `approve-with-conditions` decision per BANK-001's stricter-of rule.

But the boundary is **leakier than I claimed before this test**. Six leakage points observed, four of them new findings.

## Detailed observations

### What worked clean

| Component | Verdict |
|---|---|
| `adpc compile` schema validation against `agent-package.v1.schema.json` | ✓ Banking package compiled clean after one fix (see Leak #6) |
| `adpc compile` semantic validation + plan generation + signing | ✓ All 4 stages green |
| `adpc execute --adapter stub` | ✓ Both agents ran in 1ms each; conf 0.83 / 0.82; trace written |
| `adpc execute --adapter foundry` LLM invocation | ✓ Both agents invoked gpt-4o successfully; conf 0.95 / 0.90; ~7s total wall time |
| Foundry IQ (Azure AI Search) retrieval of banking docs | ✓ BANK-001 + BANK-002 returned for both intents |
| StepRunner per-step orchestration | ✓ Generic — no banking-specific code path needed |
| Reasoning quality | ✓ Correct math: DTI = ($2,355 + $538) / $7,667 = 37.78%; LTV = $28,500 / $33,000 = 86.4%; FICO 749 = approve standard; stricter-of → `approve-with-conditions` (rate +0.5% for DTI band 36-43%, PMI surrogate fee for LTV band 81-90%). Matches BANK-001 exactly. |
| Package with `"tools": []` | ✓ Platform handled zero-tool package without errors |

### Leakage points (what's Meridian-shaped in the platform)

| # | Leak | Observable in this run | Real-world impact |
|---|---|---|---|
| 1 | **Intent dispatches in `FabricLakehouseSource.cs` + `SqlSemanticLayerSource.cs`** are switch arms on Meridian intents (`verify_coverage`, `assess_damage`, ...). Banking intents `parse_loan_application` and `evaluate_eligibility` fall into the default `_ => []` arm. | **Empty Fabric IQ citations** — neither step cites any Fabric fragment. | Banking agents reason without entity-graph context. Decisions are correct because the BANK-001 doc carries the rules, but population-derived signals (e.g., "borrowers with similar profile") are unavailable. **Clean degradation, not a break.** |
| 2 | **Intent dispatches in `WorkIqSource.cs`** same shape — switch arms on Meridian intents. Banking intents return empty. | **Empty Work IQ citations** — neither step cites collaboration signals. | No supervisor/queue/Teams signals for banking. Same clean degradation. |
| 3 | **MCP tools in `V0ToolRegistry`** ships claim-store, vehicle-lookup, policy-store, adjuster-roster — P&C-shaped. Banking would naturally want borrower-profile, credit-bureau, dti-calculator, lien-search. | Banking package declared `"tools": []`, so this wasn't exercised. | **A banking package that needs tools WOULD have a problem.** Either reuse P&C tools awkwardly, or platform has to grow a tool-discovery mechanism that loads from `usecases/<x>/tools/`. |
| 4 | **`PlanExecutor.LoadClaim` is hardcoded** to look for a root `claims` array with per-entry `claimNumber` strings (lines 86-96). Banking corpus had to use those P&C-shaped key names with loan content inside. | **Workaround applied** — `claims` / `claimNumber` keys in `data/applications-3.json` despite the file containing loan applications. | Banking authors would write `applications` / `applicationId` naturally and the platform would fail to find the subject. Fix is a small one (`subjectKey` / `subjectIdField` declared in the package). |
| 5 | **Foundry IQ has no industry filter.** The single `adp-knowledge` index holds all 21 docs (19 Meridian + 2 banking) and AI Search vector search retrieves by semantic similarity across the whole index — no metadata partitioning. | **Banking agents cited Meridian docs** in their grounded context: step 1 cited `PAC-INTAKE-001`, step 2 cited `PAC-REG-001`. | Cross-industry contamination. Banking agent gets unfair-claims-practices regulatory context from auto insurance. It happens not to harm reasoning in this run because the LLM ignored irrelevant Meridian context, but at scale and for adversarial inputs this is real noise. **Easy fix**: add an `industry` or `useCase` filter to AI Search queries (the docs already have those frontmatter fields — they're just not extracted into search metadata yet). |
| 6 | **`orchestration.strategy` and `orchestration.stepFormation` enums** in the schema are locked to platform-architecture-specific values (`hybrid` / `whole-path` / `sense-then-act` etc.). Banking would naturally write `sequential` / `linear`. | **Compile failed** until I changed the package to use `hybrid` / `fully-declared`. | **Not actually a Meridian leak** — this is platform-architecture opinion per ADR-0007/0009 ("hybrid is recommended"). But it IS an opinionation that limits package authoring vocabulary. A v1 evolution could broaden the enums or make them extensible. |

### What was NOT a leak (false alarm before this test)

- Schema's `tools` array can be empty → platform handles it. (I had wondered.)
- StepRunner doesn't make Meridian-shaped assumptions on `result.Output` shape; the field is just an opaque string. (I had wondered if `EvaluateStatus` would care.)
- `HitlGateEvaluator` works fine — the banking package's `gate.refer-to-underwriter` field-value trigger would fire normally if the eligibility agent set `requiresHumanReview == true`. Not exercised in this run (Maria's application landed `approve-with-conditions`).

## Verdict on the user's question

**Approach #3** (agnostic platform + use case authored separately + integration via the package contract) — **provable empirically, with 5 measurable leakage points across L4 (claim-loader) and L5 (intent dispatches across all three sources + no industry filter on AI Search), and one schema-enum opinion that is platform-architectural not Meridian-specific.**

Adding Banking as a real product would require:
- **(High value, ~1-2h)** Add metadata-filter on AI Search queries by `industry` or `useCase` frontmatter → eliminates Meridian-doc contamination (leak #5).
- **(High value, ~2-3h)** Externalize intent → query mapping per package (the package's `contextBindings[]` block already exists in the schema; just teach the sources to dispatch off that instead of hardcoded switch arms) → eliminates leaks #1 and #2.
- **(Medium value, ~1h)** Make `PlanExecutor.LoadClaim` read a `subjectKey` field from the package or fall through more gracefully → eliminates leak #4.
- **(Medium value, deferred)** Tool discovery from `usecases/<x>/tools/` with a manifest → eliminates leak #3.

Total effort to make the platform genuinely agnostic from today's state: **a focused day's work, not a refactor**. The architectural shape is correct; the implementation is one focused day from matching the architecture.

---

## After-state — v0.5 factor-out (2026-05-28)

The fixes named above were implemented. New banking-stress trace `trc-19e6c44877c` on `LOAN-2026-00001`:

| Step | Citations before factor-out | Citations after factor-out |
|---|---|---|
| s1 loan-application-intake | BANK-002, BANK-001, **PAC-INTAKE-001** | BANK-002, BANK-001 |
| s2 loan-eligibility | BANK-001, BANK-002, **PAC-REG-001** | BANK-001, BANK-002 |

**Zero Meridian-doc cross-citation.** Banking agents only see banking knowledge.

### What changed in the platform

| Change | Files | Effect |
|---|---|---|
| `ContextRequest` gained optional `Industry` + `SourceBindings` fields | `platform/src/ContextLayer/Contracts.cs` | Sources can scope retrieval and look up named primitives |
| `AzureSearchFoundryIQSource` adds `industry eq '<value>'` to OData filter when `Industry` is set | `platform/src/ContextLayer/AzureSearchFoundryIQSource.cs` | Eliminated leak #5 (cross-industry retrieval) |
| `AzureSearchIndexer` adds `industry` field to index schema and extracts it from doc frontmatter's domain prefix | `platform/src/ContextLayer/AzureSearchIndexer.cs` | All 21 indexed docs now carry `industry` (re-indexed 2026-05-28) |
| `FabricLakehouseSource` + `SqlSemanticLayerSource` dispatch off `request.SourceBindings[SourceId]` instead of Meridian-intent switch arms; 3 named primitives exposed (`policyholder-history`, `similar-claims`, `vehicle-history`) | `platform/src/ContextLayer/FabricLakehouseSource.cs`, `SqlSemanticLayerSource.cs` | Eliminated leak #1 — zero Meridian intent names in platform code |
| `WorkIqSource` dispatches off `SourceBindings[WorkIQ]`; 10 named fragment-shape primitives exposed | `platform/src/ContextLayer/WorkIqSource.cs` | Eliminated leak #2 — zero Meridian intent names in platform code |
| `DigitalWorker.CorpusBinding` added to schema + record; `PlanExecutor.LoadClaim` honors it (with backward-compat defaults of `claims` / `claimNumber`) | `platform/src/PackageModel/AgentPackage.cs`, `platform/src/Orchestration/PlanExecutor.cs`, `platform/schemas/agent-package.v1.schema.json` | Eliminated leak #4 — banking corpus uses natural `applications` / `applicationId` keys |
| `ContextBinding.SourceBindings` added to schema + record | same schema files + `AgentPackage.cs` | Package declares the intent → primitive map per its domain |
| All 5 packages updated with `sourceBindings`; banking package gains `corpusBinding` | `usecases/meridian-pnc-auto-claims/packages/*.json`, `usecases/banking-loan-origination/packages/loan-handler.json` | Migration of all intent-names from platform code to package data |

### What's still v1 work (deferred from this factor-out)

- **Leak #3 — V0ToolRegistry P&C tools** — banking still has no tools and Meridian's 4 P&C tools still ship in `platform/src/ToolRuntime`. A banking package that needs `borrower-profile` / `credit-bureau-lookup` would either reuse claim-store awkwardly or require a tool-discovery mechanism that loads from `usecases/<x>/tools/`. **Not addressed in v0.5.**
- **Fabric/SQL primitives are still P&C-schema-bound.** `policyholder-history` literally SELECTs from `dim_policyholder` — banking would need a separate semantic source (e.g., `FabricLakehouseBankingSource`) backed by `dim_borrower` / `fact_applications` tables, OR a generic schema-aware source that the package teaches its schema. The factor-out moved intent NAMES out of platform code, not schema bindings.

### Cloud regression

After deploy, ran `damage-handler` on `CLM-2026-10013`. All 4 steps grounded, all citations are insurance-domain:
- s1 → `SIMILAR_CLAIMS/CLM-2026-10013` + PAC-DAMAGE-001/-TRI-001 (Fabric + Foundry)
- s2 → `VEHICLE_HISTORY/...` + PAC-DAMAGE-002/-001 (Fabric + Foundry)
- s3 → `POLICYHOLDER_HISTORY/...` + `TEAMS_THREAD/.../shop-routing` + PAC-SHOP-001 (Fabric + Work IQ + Foundry — full L5 federation)
- s4 → PAC-SHOP-001/-SET-003/-SIU-001 (Foundry only)

Refactor is functionally equivalent to pre-refactor behavior; same trace shape, same agents, same reasoning quality. The only delta is that Meridian-specific intent names now live in package JSONs instead of source-file switch arms.

### Verdict revised

**Approach #3 — agnostic platform + use case authored separately + integration via the package contract — is now provable to a much stricter standard.** The package owns the intent → primitive map; the platform owns the primitives. Banking demonstrates the boundary with zero cross-industry retrieval contamination.

Two remaining leakage points (tools, schema-bound primitives) are the v1 / v1.5 work after this. They're architecturally cleaner to defer because they require either tool-discovery infrastructure or a generic-schema source pattern — both are larger refactors than the v0.5 changes.

## Files for reference

- Package: [`packages/loan-handler.json`](packages/loan-handler.json)
- Knowledge: [`knowledge/BANK-001.md`](knowledge/BANK-001.md), [`knowledge/BANK-002.md`](knowledge/BANK-002.md)
- Corpus: [`data/applications-3.json`](data/applications-3.json)
- Stub trace: `build/loan-handler-stub.trace.json`
- Foundry trace: `build/loan-handler-foundry.trace.json` (trace id `trc-19e6a8d1563`)
