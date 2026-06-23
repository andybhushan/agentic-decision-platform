# adp-v1 — Spec (v0)

**Date:** 2026-05-26 (revised — drops PDF/IBM-IQ anchoring; full stack re-optimised)
**Author:** Anand Bhushan (Anand-track, local-only)
**Status:** v0 draft, pre-code

## Thesis (one sentence)

A robust, modern, Azure-native agentic application platform — Microsoft-first where Microsoft has genuinely best-in-class tools (IQ series, Foundry, Agent 365, Aspire, Entra Agent ID, Defender for AI, Purview), IBM / Red Hat / HashiCorp where they are genuinely best (Terraform, Ansible, Confluent), every choice defensible on technical merit. The Meridian P&C Auto Claims use case is the first test package, not the platform's purpose.

## Why this exists

The fastest way to know whether an architecture survives contact with code is to build it. v0 stands the platform up end-to-end with one real use case running on it. ADRs are written *before* code, not as backfill — every substantive decision is reasoned out in [`docs/adr/`](docs/adr/) with options weighed and trade-offs named. Won't be pushed to `github.com/IBM-Project-Adp`. Local-only until it runs end-to-end.

## Reference inputs

- **Ten-layer reference architecture** — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) View 1.
- **Six pinned tech decisions** — [`docs/adr/`](docs/adr/) (ADR-0001 boundary, ADR-0002 package format, ADR-0003 compile pipeline, ADR-0004 state/bus/trace, ADR-0005 Bicep+Terraform, ADR-0006 console).
- **Four new pinned tech decisions** — ADR-0007 agent runtime, ADR-0008 identity/governance/security, ADR-0009 context layer, ADR-0010 compute/edge hosting.
- **Test use case** — Meridian P&C Auto Claims, FNOL Handler DW only, single happy path on synthetic data ([`usecases/meridian-pnc-auto-claims/`](usecases/meridian-pnc-auto-claims/)).

## MVP scope (what v0 must do)

1. **Accept** an agent package (typed C# DSL → JSON, validated against `agent-package.v1.schema.json`) declaring the FNOL Handler DW — 4 agents, 9 skills, 5 tools.
2. **Compile** the package through 4 stages (validate · semantic-check · plan · sign) into Foundry agent definitions + Durable Function code + MCP tool registrations.
3. **Execute** one P&C Auto claim end-to-end on synthetic Meridian-shaped data.
4. **Emit** a decision journal tagged GROUNDED/DERIVED into Event Hubs → Fabric RTI (live) → Fabric Bronze (cold).
5. **Render** a generic operator console showing trace + confidences + one HITL hook.

**Out of v0:** Damage/Fraud/Settlement DWs, multi-claim concurrency, Duck Creek/Guidewire integration, real Meridian data, Engineering/Operations IQ, Agent 365 lifecycle UI, Sentinel SIEM, Foundry Local edge agents, Confluent streaming.

## Pinned stack (every layer; see ADRs for *why*)

| L | Layer | Choice | ADR |
|---|---|---|---|
| L1 | Identity & Governance | Entra ID + Entra Agent ID + Defender for AI + Purview; Sentinel deferred | 0008 |
| L2 | Experience | Vite + React 19 + Fluent UI v9 (Operator Console); Teams + M365 deferred | 0006 |
| L3 | Agent Runtime | Microsoft Agent Framework + Foundry Agent Service + Agent 365 + MCP + A2A; Foundry Local door-open for v1 | 0007 |
| L4 | Orchestration | .NET Aspire (dev-time) + Azure Durable Functions (inter-DW); Logic Apps deferred | 0003 |
| L5 | Context Layer | Fabric IQ + Foundry IQ + Work IQ (stub) + AI Search; Cosmos Gremlin deferred to v1 | 0009 |
| L6 | State & Events | Cosmos DB (state) + Event Hubs Kafka API (decision bus) + Event Grid (fan-out) + SignalR (D9 stretch) | 0004 |
| L7 | Data Substrate | Fabric Bronze + Silver + Gold + RTI (KQL eventhouse); Databricks deferred; Azure OpenAI gpt-4o reused | 0004 + 0009 |
| L8 | Compute & Hosting | Container Apps (Aspire services) + Functions (Durable) + Static Web Apps (console); AKS deferred; Foundry Local v1+ | 0010 |
| L9 | IaC & Automation | Bicep (resources) + Terraform (D9 ring module — HashiCorp/IBM); Ansible deferred | 0005 |
| L10 | Optional Integration | Confluent Kafka / HashiCorp Vault / ARO / watsonx.data — all door-open, none in v0 | — |
| — | Package authoring | Typed C# DSL → JSON Schema-validated artifact | 0002 |
| — | Use case | Meridian P&C Auto Claims (FNOL Handler DW); first test package | — |

**Explicitly NOT in v0:** Neo (Neudesic framework), LangChain, LangGraph, watsonx, Bob, Orchestrate, Copilot Studio drag-drop. (Door open for LangGraph in v1 if the Fraud DW's cyclic-graph need beats Agent Framework's expressiveness — see ADR-0007.)

## Success criteria (measurable, binary)

- [ ] One synthetic claim flows FNOL → triage decision in ≤ 60s end-to-end.
- [ ] Package authoring: C# fluent API produces JSON that validates against `agent-package.v1.schema.json`.
- [ ] Compile pipeline: 4 stages run from CLI; outputs registered (stub) in Agent 365.
- [ ] Decision journal: per-event GROUNDED/DERIVED tag, lands in Event Hubs → RTI within 5s, Bronze within 24h, with `decisionId`-based idempotency.
- [ ] Operator console renders the trace from a live source (REST on D8, SignalR on D9 if stretch lands).
- [ ] Reproducible: `azd up` + `dotnet run` brings the whole thing up in ≤ 10 minutes on a fresh checkout.
- [ ] Boundary check (`node scripts/check-boundary.mjs`) passes on every commit.

## Stubbed vs real (honest list)

| Element | v0 state |
|---|---|
| Agent package format | Real (`platform/schemas/agent-package.v1.schema.json`). Designed by us; not waiting on external dependencies |
| Meridian data | Synthetic ~1K corpus, Duck-Creek-shaped (public docs) |
| Fabric IQ entity graph | Real Fabric workspace + minimal P&C ontology (~10 entities) |
| Foundry IQ | Real Foundry knowledge base, 5–10 seed policy/regulatory docs, AI Search backing |
| Work IQ | Stubbed — returns empty collaboration context |
| Cosmos Gremlin entity graph | Deferred to v1 (Fabric SQL queries suffice at v0 scale) |
| Foundry Local edge agents | Deferred to v1 (door open via package schema's `deploymentTarget`) |
| Fraud / Damage / Settlement DWs | Out of v0 |
| Duck Creek / Guidewire integration | Out of v0 (synthetic only) |
| Agent 365 registry | Stub (writes to local JSON); real Agent 365 hook on D9+ |
| Sentinel SIEM | Deferred to v1 (Log Analytics in v0) |
| Confluent / HashiCorp Vault / ARO / watsonx.data | All door-open, none in v0 |

## Build cadence (Anand-track, ~10 working days)

- **D1–D2 [DONE]:** Repo skeleton, schemas, synthetic corpus, console scaffold, **6 ADRs reset** (this turn), 4 new ADRs added.
- **D3–D5:** .NET Aspire solution, C# package model + fluent DSL, `adpc` CLI (4 compile stages), Bicep modules for the 11 v0 resources, 2 of 4 agents registered with Foundry.
- **D6–D7:** Remaining 2 agents, Durable Function FNOL orchestrator, MCP servers (5), Decision-Ingest service to Event Hubs + RTI.
- **D8–D9:** REST endpoint for trace fetch, console fetches live, Purview labels on Bronze, D9 Terraform ring module, Defender for AI enabled on Foundry resource.
- **D10:** End-to-end demo recording + retro on ADRs (do any need superseding?).

Per [`feedback_adp_portal_local_first`]: build + verify locally first. No deploy to shared Azure subscription until full run-through works against the Aspire dashboard.

## Risks (named, not hidden)

1. **Stack breadth.** Ten layers, ten ADRs. Real coverage cost. Mitigation: ruthless v0 scope on each layer; door-opens documented for v1.
2. **Foundry rough edges.** Agent 365 GA was 2026-05-01; Foundry Agent Service is brand new. Mitigation: isolate behind a thin adapter (ADR-0007).
3. **RTI learning curve.** KQL is unfamiliar muscle. Mitigation: canned query helpers in `platform/src/Tools/RtiQueryHelpers/`; basic KQL skill investment.
4. **Synthetic data oversimplifies.** Fine for v0 demo; must be replaced before any external showcase.
5. **Cost.** 11+ Azure resources is real. Mitigation: scale-to-zero for Container Apps; cost dashboard alerts when daily idle > $50.
6. **Lock-in.** Microsoft-first at L1/L3/L5/L7 is deep lock-in. Acceptable because the mission is Azure-only by design. Lever for portability: the agent package format is vendor-neutral (ADR-0002), so the runtime is replaceable in principle.

## What I share, and when

- v0 is not announced. No status email, no Slack, no formal recap (per [`feedback_adp_no_formal_recaps`]).
- When v0 runs end-to-end → 1:1 demo to Satish first, before team.
- ADRs are front-loaded reasoning, not backfilled justification. If the build deviates, the deviating ADR gets superseded explicitly.
