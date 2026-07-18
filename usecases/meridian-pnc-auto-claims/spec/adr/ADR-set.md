# UC4 ADR set — Agentic Claims (use-case decisions)

> Use-case-level decisions for `meridian-pnc-auto-claims`. Platform-level ADRs live in `docs/adr/` (inherited from ADP). Status: **proposed** (own-track; accept before building each).

## ADR-U1 — Superset scope, pragmatic build
**Decision:** Represent the **full** claims lifecycle (13 stages) as the reference, but **build fully** only the trust-winning spine (FNOL, triage, coverage, estimation+total-loss, fraud, settlement-offer, closure, reporting/journal) and **simulate** the rest (assignment, investigation, reserves, payment, subrogation) with realistic synthetic data + integration seams.
**Why:** a carrier must see the *whole* process to relate, but the demo wins on a few deep, trustworthy moments — not 13 shallow ones. Alternatives: narrow wedge (doesn't sell the platform) / build-all (too slow, dilutes hero moments).
**Consequence:** + relatable & credible, fast to a demo; − simulated stages need clear "integration seam" labelling so it's not oversold.

## ADR-U2 — Reuse the event-driven data foundation + immutable decision journal
**Decision:** Claims state changes flow as **append-only domain events**; every agent decision is journaled (GROUNDED/DERIVED) — reuse the foundation already built (event-store/contracts) rather than CRUD.
**Why:** auditability is a compliance must-have (NAIC AIS, fair-claims); the journal *is* the regulator view. Alternatives: DB-CRUD (no audit spine).
**Consequence:** + auditable/replayable/explainable; − event modelling overhead (acceptable, it's the value).

## ADR-U3 — Semantic layer grounds, agents decide
**Decision:** The **domain ontology + data agents** (over the gold data product) provide grounding/analytics/typed facts; **decisioning stays in the orchestrated agents**. The ontology supplies rules as config (e.g. total-loss threshold) and traversal/evidence; it does not enforce decisions.
**Why:** keeps the analytics/decisioning boundary clean (and mirrors the constitution's Article-III separation); ontology-as-decision-engine would blur grounding vs decisioning.
**Consequence:** + clean separation, reusable semantic layer; − gate *enforcement* must live in the orchestrator (by design).

## ADR-U4 — HITL gates are code-enforced architectural interrupts
**Decision:** Coverage-denial, total-loss, high-risk-fraud, and above-authority-settlement are **hard gates** in the state machine — block STP, emit a journaled gate event, present full context + citations, resume only on human decision.
**Why:** legally required HITL on binding decisions; gates must be *architectural*, not prompt-scripted, to be defensible. Alternatives: soft/advisory gates (fail the compliance bar).
**Consequence:** + defensible to a DOI/compliance lead; − adds orchestration complexity (justified).

## ADR-U5 — Carrier-agnostic, config-driven packaging
**Decision:** Brand, data, coverages, rules, and personas are **config per use-case package**; reskinning to a new carrier (or the banking use case) is configuration, not code.
**Why:** the asset's value is being instantly reskinnable for any prospect; one platform, many use cases. Alternatives: hard-coded carrier (single-use demo).
**Consequence:** + one platform → many deals; − requires disciplined config/data separation.

## ADR-U6 — Deploy clean to the DT subscription
**Decision:** Provision **fresh** Azure (Fabric workspace, event backbone, console) on `Project-IBMMSOFFERINGSPOC`, under the offering GitHub account. No infrastructure, branding, or design carried over from any other engagement.
**Why:** this is a DT asset that may be shown widely; it must be unambiguously clean, standalone, and carrier-agnostic. Alternatives considered: reusing existing infrastructure (rejected — confidentiality and independence risk).
**Consequence:** + freely demoable, no exposure; − a fresh provisioning pass (one-time).

## ADR-U7 — Align to ICA 2.0 at the pattern level; differentiate on Microsoft-native depth
**Decision:** ADP is architected to **map onto ICA 2.0's pillars** and to be **deliverable/orchestrated through ICA 2.0**, while differentiating on deep Microsoft-native capability. Concretely:
| ADP (Microsoft-native) | ICA 2.0 pillar it aligns to |
|---|---|
| Package compiler + orchestration + agents | **Agentic App Studio / Agentic AI Core** (build/run, multi-agent orchestration, data contracts/memory) |
| Fabric IQ ontology + data agents (true graph) | **Context Studio** (semantic/context layer) — ADP is *stronger* here (Fabric IQ graph vs Postgres+AGE, SDLC-centric) |
| HITL gates + immutable decision journal + explainability | **Control Tower** (HITL, guardrails, output validation, logging, drift, FinOps) |
| MCP tools (ontology-mcp pattern) | **Context Forge MCP Gateway** (ICA is MCP-first + BYO MCP servers) |
| Use-case packages (claims, loans) | **Advantage Marketplace** industry templates (e.g. DocuFlow) |

**Why:** ICA 2.0 narrowed the *concept* gap (both are agentic, MCP/A2A, governed context). ICA 2.0 is **multi-cloud and natively integrates Azure AI Foundry + Azure OpenAI + BYO MCP**, so a Microsoft-native asset is *consistent* with it, not competing. ADP's edge is being **deeply native on the Microsoft Frontier stack** (Fabric IQ, Foundry, Agent 365, Entra Agent ID, Purview), where ICA is multi-cloud/bolted-on. Alternatives: ignore ICA (misaligned to IBM delivery) / build on ICA directly (loses the Microsoft-native depth that is the differentiator).
**Consequence:** + ADP is positionable as an **ICA-aligned, Microsoft-native industry asset** that ICA 2.0 can orchestrate (ADP agents as MCP/A2A endpoints; ADP as a Marketplace-style template); + clean story for both IBM-delivery and Microsoft-native audiences; − must keep ADP agents/tools exposable as MCP/A2A so ICA can consume them (a design constraint, not a cost). Source: `Data Transformation/ICA_2.0_Deep_Analysis.md`.
