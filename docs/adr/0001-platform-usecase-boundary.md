# ADR-0001 — Platform vs use case boundary

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

The Project ADP mission, per Miha's kickoff on 2026-05-13, is to build *a platform that can faithfully execute Enterprise Advantage packages — exactly like ICA does today, but Microsoft-native.* The MVP byproduct is P&C Auto Claims for Meridian.

A platform that can only run one use case is not a platform — it is a vertical application dressed as a platform. ICA's own claim to being a platform rests on the fact that its core code does not know whether it is running claims, fraud, loan origination, or stock-out: the **EA package** carries that knowledge.

The initial v0 layout (single `schemas/`, `synthetic/`, `console/` at root, with FNOL Handler vocabulary inside the console component) failed this test. The console hardcoded the word "FNOL", referenced `CLM-2026-10042`, and would not have rendered any other package's trace without code changes. The same applied to file naming: `schemas/fnol-handler.example.json` lived inside what was supposed to be a platform contract folder.

## Options considered

### Option A — Keep the flat layout; treat use-case bleed as cosmetic

- Pros: zero refactor cost; faster path to D3.
- Cons: every subsequent feature in the console / compiler will need a parallel "is this generic?" judgment call. Drift is guaranteed under deadline pressure. Refactor cost compounds.

### Option B — Two-folder split: `platform/` (use-case agnostic) + `usecases/<name>/` (use-case specific)

- Pros: boundary is enforceable physically (folder-level), grep-able, and CI-checkable. Adding a second use case (e.g. NYPD per kickoff notes) becomes a pure copy of the `usecases/` shape with no platform code changes. Matches how ICA, Foundry, and other multi-tenant agentic platforms organise themselves.
- Cons: more folders to navigate; demo fixtures inside `platform/console/` create a soft edge that must be marked explicitly.

### Option C — Monorepo with separate packages (`@adp/platform`, `@adp/meridian-fnol`) under `npm workspaces` or `dotnet sln`

- Pros: ideal long-term shape; package boundaries become language-enforced.
- Cons: premature for v0. The platform isn't yet a package; it's a sketch. Workspaces add tooling complexity (lockfile dance, build orchestration) before there's anything to enforce.

## Decision

**Option B.** Two top-level folders: `platform/` and `usecases/<usecase-id>/`. Enforced by [`scripts/check-boundary.mjs`](../../scripts/check-boundary.mjs), which fails if any file under `platform/` imports from `usecases/`.

Soft edge: demo fixtures (`platform/console/src/demo-trace.json`) are allowed inside `platform/` for v0 dev velocity, marked clearly as use-case-shaped data, and scheduled to be removed on D8 when the console fetches from `/api/traces/:id`.

## Consequences

- All Meridian-specific artifacts move under `usecases/meridian-pnc-auto-claims/`: the EA package, synthetic claims, generator script.
- The console's types and component code switch to a generic `Trace` shape with no insurance vocabulary.
- The EA package JSON schema becomes the contract between the two halves of the repo.
- CI will block any PR that introduces a `platform/ → usecases/` import.
- Future use cases (NYPD public services, etc.) add a sibling folder under `usecases/` with zero platform code change required.

## Trade-offs accepted

- Slightly more folder navigation in editor.
- A use case must be added before the platform can be *demonstrated*. Acceptable: a platform that can run a "hello world" use case is not interesting; a platform that can run a real use case is.

## Validation

- `node scripts/check-boundary.mjs` passes.
- Grep for `FNOL|Meridian|claim|insurance` inside `platform/console/src/*.tsx` returns no domain vocabulary in code.
- The console renders demo trace without referencing any Meridian-specific terms outside `demo-trace.json`.

## v0.5 factor-out (2026-05-28) — stress-test-driven tightening

A 2-agent banking package authored under `usecases/banking-loan-origination/` (see [FINDINGS.md](../../usecases/banking-loan-origination/FINDINGS.md)) empirically stress-tested this ADR. It revealed five real leakage points where Meridian-shaped logic had crept into `platform/`:

1. Intent-name switch arms in `FabricLakehouseSource` + `SqlSemanticLayerSource` (Meridian intents hardcoded).
2. Intent-name switch arms in `WorkIqSource`.
3. P&C-shaped MCP tools in `V0ToolRegistry`.
4. `PlanExecutor.LoadClaim` hardcoded `claims[].claimNumber` keys.
5. Foundry IQ had no industry filter → cross-industry vector retrieval contamination.

Four of the five were closed in the v0.5 factor-out:

- **Leak #1 + #2 closed.** Sources now dispatch off `request.SourceBindings[SourceId]` and look up named primitives (`policyholder-history`, `similar-claims`, `vehicle-history`, `triage-supervisor-thread`, etc.). The Meridian intent names live in each package's `contextBindings[].sourceBindings` block instead. **Zero Meridian intent strings in `platform/src/`.**
- **Leak #4 closed.** `DigitalWorker.CorpusBinding` declares `arrayKey` + `subjectIdField`; the banking corpus now uses `applications` + `applicationId`. Defaults preserve backward compat for the 4 Meridian packages.
- **Leak #5 closed.** AI Search index gained an `industry` field (derived from doc frontmatter's `domain` prefix); `AzureSearchFoundryIQSource` filters by `industry eq '<value>'` when `ContextRequest.Industry` is set. Banking agents now cite only banking docs; Meridian agents cite only insurance docs.

**Leak #3 (V0ToolRegistry P&C tools) is deferred to v1.** A banking package that needs tools would either reuse claim-store awkwardly or require a tool-discovery mechanism that loads from `usecases/<x>/tools/`. The boundary improvement here is mechanically larger than the others; postponed deliberately.

Schema additions in this round: `digitalWorker.corpusBinding` and `contextBindings[].sourceBindings`. Both are optional with sensible defaults — every pre-v0.5 package continues to compile.

Empirical validation post-factor-out: banking-stress trace `trc-19e6c44877c` cites only `BANK-001` + `BANK-002` (zero Meridian bleed); Meridian damage-handler regression `f1dd41de-…56e8c3` on `CLM-2026-10013` completes all 4 steps grounded in insurance-domain citations with `SIMILAR_CLAIMS`, `VEHICLE_HISTORY`, `POLICYHOLDER_HISTORY`, `TEAMS_THREAD/...` named primitives firing as expected.

## v0.6 amendment — Track 4 tool-kit exception (2026-05-28)

Leak #3 from the banking stress test (V0ToolRegistry shipped 4 P&C-shaped tools in `platform/src/ToolRuntime/`) closed. Per-industry tool kits now live under `usecases/<industry>/tools/` as separate .csproj projects:

- `usecases/meridian-pnc-auto-claims/tools/MeridianTools.csproj` — claim-store, vehicle-lookup, policy-store, adjuster-roster (relocated from `platform/src/ToolRuntime/V0Tools.cs`).
- `usecases/banking-loan-origination/tools/BankingTools.csproj` — borrower-profile, credit-bureau-lookup (new).

Platform retains only the contracts (`IMcpTool`, `IToolRegistry`, `ToolRegistry`, `ToolInvocationContext`, `ToolResult`) plus a new composer (`IndustryAwareToolRegistry`) that holds per-industry sub-registries keyed off the package's `Package.Industry` string.

### Acknowledged exception

`TracesApi.csproj` and `PackageCompiler.csproj` now contain two **`<ProjectReference Include="../../../usecases/<x>/tools/<x>Tools.csproj" />`** entries each. This is a direct violation of the strict platform→usecase import ban, but it's the architecturally correct exception: tool kits ARE the use case's contribution to the platform runtime. Without this exception, the alternatives are:

- Reflection-based dynamic loading of tool assemblies at runtime (more complex; same effective coupling)
- A plugin system with manifest discovery (substantial v2+ infra)
- Hardcoding tools in `platform/` forever (which is what we just got rid of)

The exception is **narrowly scoped**: TracesApi + PackageCompiler are the only platform projects allowed to reference `usecases/*/tools/*.csproj`. No other platform project (Agents, ContextLayer, etc.) may import use-case code. The boundary check script (`scripts/check-boundary.mjs`) enforces this with a small allowlist for the exception.

### Updated validation steps

- ✅ `node scripts/check-boundary.mjs` passes with the new allowlist; any csproj ProjectReference into `usecases/` from a non-allowlisted platform project still fails the build.
- ✅ Grep for `using Adp.UseCases` in `platform/src/` returns only the allowed DI registrations in `TracesApi/Program.cs` + `PackageCompiler/Program.cs`.
- ✅ Meridian regression: damage-handler still resolves `tool.claim-store` etc. — same tool IDs, same behavior, just from the relocated assembly.
- ✅ Banking package now declares 2 tools (`tool.borrower-profile`, `tool.credit-bureau-lookup`). Banking-side agents that opt into tools can call them.
