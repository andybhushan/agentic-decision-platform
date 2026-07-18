# ADP — Spec

**Date:** 2026-07-18 (current state — supersedes the 2026-05-26 pre-code v0 draft this file originally held)
**Author:** Anand Bhushan, with Vibhaanshu and Pinaki
**Status:** Live. Both use cases fully functional. All data synthetic.

## Thesis (one sentence)

A robust, modern, Azure-native agentic decision platform — the use case is a package the platform runs, not a product the platform becomes. The engine ships with zero domain logic; P&C Auto Claims (Meridian Mutual) and Consumer Loan Origination (Northwind Bank) are the first two test packages, not the platform's purpose.

## Why this exists

Regulated industries run high-volume operational decisions — claim triage, damage estimation, fraud screening, settlement, loan origination — on manual process, brittle rule engines, or single-purpose AI pilots with no governance story. ADP proves a different model: one governed engine, grounded in the organization's own data, that can run *any* regulated decision. The fastest way to know whether an architecture survives contact with reality is to build it end to end on more than one industry — that's what this repo does.

## Methodology: spec-driven development

ADP was built spec-first at every layer: write the PRD/ADR, get it approved, then build against it — never code first and document after.

- **Platform layer** — 16 ADRs in `docs/adr/` (`0001`–`0016`), each in the same format: Context → Options → Decision → Consequences → Trade-offs accepted → Validation. Per `docs/adr/README.md`: *"ADRs are written before the corresponding code lands, not as backfill. If a future change violates an ADR, write a new ADR that supersedes it — never silently drift."* These cover the decisions that shape the whole platform: package format (ADR-0002), compile pipeline (ADR-0003), state/bus/trace stores (ADR-0004), agent runtime stack (ADR-0007), identity/governance (ADR-0008), context layer (ADR-0009), semantic layer (ADR-0011, ADR-0014), Work IQ (ADR-0012, ADR-0015).
- **Use-case layer** — every use case follows the standard flow documented in `docs/USECASE-STRUCTURE.md`: *"Write `spec/PRD.md` + ADRs; get the PRD approved (spec-driven gate)"* — only then define ontology, generate data, and author agent packages/tools. `meridian-pnc-auto-claims/spec/PRD.md` sets the thesis, customer brief, the full 13-stage standard claims lifecycle, and MVP scope; `meridian-pnc-auto-claims/spec/adr/ADR-set.md` layers use-case-specific decisions (e.g. standalone infra, no shared dependencies) on top of the platform ADRs.
- **This file** is the third tier — the platform's current-state spec, kept honest against the ADRs and the PRD as the build actually progressed, not a fixed-in-time wishlist (see the date note at the top: this supersedes an earlier pre-code draft).

The result: every major architectural choice in this repo traces back to a written decision record with the alternatives it rejected, not a retrofitted explanation.

## What's built (current, not planned)

| Use case | Industry | Digital workers | Lifecycle |
|---|---|---|---|
| `p-and-c-auto-claims` (Meridian Mutual) | Insurance | FNOL Handler, Damage Handler, Fraud Handler, Settlement Handler (4 agents each) | Intake & Routing → Damage & Estimation → Fraud Screen → Settlement & Payment |
| `consumer-loan-origination` (Northwind Bank) | Banking | Consumer Loan Handler (3 agents) | Origination Decision |

Both run on the same runtime, same immutable decision journal (Cosmos DB), same governance surfaces, zero code forked between them. Full operator console, member portal, and borrower portal are live and functional (see root `README.md`).

## Pinned stack (current)

| Layer | Choice | Status |
|---|---|---|
| Identity & Governance | Entra ID + Entra Agent ID; Purview/Sentinel/Defender for AI referenced in the governance model | Entra Agent ID declared per package; broader governance surfaces documented, not all wired live |
| Experience | React 19 + Carbon v11 + Fluent 2, Azure Static Web Apps | **Live** — console, member portal, borrower portal, docs |
| Agent Runtime | Microsoft Agent Framework 1.13 (active), Azure AI Foundry Agent Service (live, switchable per run), direct Azure OpenAI (legacy fallback) — one shared contract, `IAgentAdapter` + `PromptContract` | **Live**, all three backends working |
| Orchestration | .NET 10 isolated Azure Functions + Durable Functions, hosted on Azure Container Apps | **Live** |
| Context Layer | Fabric IQ (Lakehouse SQL + published Data Agent) + Foundry IQ (Azure AI Search) + Work IQ | **Live** except Work IQ, which is synthetic-but-deterministic pending Microsoft Graph tenant admin consent |
| State & Events | Cosmos DB (immutable decision journal + runtime intake) + Event Hubs + Azure SignalR (live console tail) | **Live** |
| Data Substrate | Microsoft Fabric — Lakehouse (24 gold tables), Ontology, GraphModel, published Data Agent; Azure OpenAI GPT-4o for reasoning + vision | **Live** |
| Package model | `agent-package.v1.schema.json`, compiled and signed by `adpc` | **Live** |

## Honest stubbed vs real

| Element | State |
|---|---|
| Agent package format | Real — `platform/schemas/agent-package.v1.schema.json` |
| Corpus data | Synthetic (~1,000 claims + 30 borrowers), Duck-Creek-shaped patterns |
| Fabric Lakehouse + Ontology + GraphModel + Data Agent | Real, published, live-queried |
| Foundry IQ (Azure AI Search) | Real, vector + semantic index over policy/regulatory documents |
| Work IQ | Synthetic-but-deterministic — real Microsoft Graph integration is built and ready, pending tenant admin consent |
| Agent runtime (3 backends) | All real — Agent Framework active, Foundry Agent Service live and switchable, legacy Azure OpenAI as fallback |
| `policy-store` / `vehicle-lookup` tools | Deliberate stubs — the exact seam where a real Guidewire or Duck Creek connector plugs in; the platform doesn't change when that happens, only the tool implementation does |
| `claim-store` / `decision-journal` tools | Real, backed by Cosmos DB |
| Evidence vision (GPT-4o) | Real — reads damage photos and documents at intake |
| Production hardening (private networking, Key Vault everywhere, Entra on the API) | Not yet done — demo posture is deliberately open (cosmetic access key), production-shaped where it matters (immutable journal, managed identity, signed packages) |
| M365 Copilot surface for the operator copilot | Positioned, not built — the `/api/copilot` contract is the natural declarative-agent action once tenant licensing/consent land |

## Success criteria — status

- [x] Full claim lifecycle (4 stages) runs end to end on live Azure infrastructure.
- [x] Package authoring produces artifacts that validate against `agent-package.v1.schema.json`, compiled and signed by `adpc`.
- [x] Decision journal: every step lands in Cosmos DB immutably, fans out to Event Hubs + SignalR for live console tail.
- [x] Operator console renders live traces via REST + SignalR, not a static fixture.
- [x] A second, unrelated industry (banking) runs on the identical platform with zero platform code changes.
- [x] Runtime is portable across three agent backends, switchable per run.
- [x] Decision Record (print-ready regulator artifact) reconstructs entirely from the journal.
- [ ] Production hardening (private networking, Entra on the API, Key Vault everywhere) — not yet done, documented as the known gap.
- [ ] Real Work IQ via Microsoft Graph — pending tenant admin consent.
- [ ] Real core-system connectors (Guidewire/Duck Creek) at the `policy-store`/`vehicle-lookup` seam — stubbed by design until a real integration target exists.

## Risks (named, not hidden)

1. **Demo-scale data.** Fine for proving the architecture; a real client's data volume and messiness haven't been tested against it yet.
2. **Work IQ is synthetic.** Honest gap, not a hidden one — blocked on tenant admin consent for Graph, not a platform limitation.
3. **No real core-system connector yet.** The seam is designed and stubbed cleanly; a production engagement needs a real Guidewire/Duck Creek/policy-admin integration built at that point.
4. **Production hardening is not yet done.** Immutable journal, managed identity, and signed packages are production-shaped; network isolation, full Key Vault usage, and API-level Entra auth are not yet in place. There is a written migration runbook (`docs/MIGRATION.md`) that covers what a hardened deployment requires.
5. **Cost.** Estimated ~USD 3-5/day idle on current serverless SKUs at demo scale.

## Sharing status (current, replaces the earlier "not announced" note)

This repository is shared with the Project IMAGINE working team (Chad Thomas, Richard Hogan, Josh Scriven, Miha Kralj) for review, alongside a live, explorable demo. See root `README.md` for links. Full detail on the platform, the two use cases, and the API surface is in `apps/console/public/docs/ADP-SOLUTION.md`.
