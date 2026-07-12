# ADP Console: build a world-class UI (harvest, don't import)

**For:** a coding assistant picking this up in a fresh ADP session. Read this first, then `SPEC.md`, `DEMO-RUNBOOK.md`, and the harvest sources in section 3.
**Date:** 2026-07-10 · **Owner:** Anand (DT Offering, Microsoft Practice)
**Decision:** Build ADP's **own, world-class console** from scratch. Do NOT adopt `client-demo` or `mvp-demo` wholesale. Harvest their best components and ideas onto a clean, owned, best-in-class UI wired to the existing ADP backend.
**Status:** ADP backend is built and LIVE. `client-demo` copied in as a harvest reference at `apps/_harvest-client-demo/`. The new console is not started. This brief defines what, why, and how.

---

## 1. What we are doing

Build a new, product-grade, best-in-class console for ADP (the **Agentic Decision Platform**), and point it at the existing ADP backend. The new console replaces the current Fluent operator console (`platform/console`) as the demo surface. Goal: a DT Offering live demo that shows a client-agnostic agentic decision platform working end to end on Microsoft frontier tech, with a P&C auto claims use case (Meridian) first and a banking use case second, proving multi use case on one platform.

We are NOT importing `client-demo` or `mvp-demo` as the app. We **harvest** their strongest parts (components, layouts, flows, narration) onto a clean UI we own end to end, with modern, best-in-class UX and no external branding or backend baggage.

## 2. Why

- The ADP backend, 4 agent pipeline, trace, HITL, and dashboard already exist and are LIVE (section 4). The current console already talks to that API. The gap is UX quality, not integration.
- `client-demo` and `mvp-demo` are useful references but each carries baggage: `client-demo` is a full product tied to its own Node/Cosmos backend and "PROJECT IMAGINE" branding, with surfaces we do not want; `mvp-demo` is a scripted storyboard, the wrong shape for showing the platform genuinely run. Building our own gives a clean, owned, aligned result that is better than both.
- Positioning: ADP is a DT Offering asset on separate DT Azure infra. It must look and feel like a modern, professional, best-in-class product that proves IBM Consulting building on the Microsoft AI stack.

## 3. Harvest sources (reference only, do not import wholesale)

- **`apps/_harvest-client-demo/`** (a copy of Richard Hogan's `IBM-Project-Imagine/client-demo`, React + Vite + Carbon). Harvest: the adjuster **Decision Queue** layout, **Decision Mode** decision workspace, **Evidence / Policy** panels, **Action Preview** (governed approval) patterns, and Carbon component usage. Its own docs are useful: `CLAIMS-MODULE-SPECIFICATION.md`, `PRD-ALIGNMENT-ANALYSIS.md`, `api-specification.md`, and `frontend/src/pages/*`, `frontend/src/components/*`. Ignore its Node backend, Cosmos coupling, agent-catalog/governance/steward/voice surfaces, and all "imagine" branding.
- **`../Project IMAGINE/repos/mvp-demo/`** (`image-mvp-demo`, React + Vite + Carbon, a narrated CSR storyboard). Harvest ideas only: the **guided narrative beats** (a narrator/story mode over the live demo), and **magic-link / shared-link access** for easy stakeholder sharing. Do not use its architecture.
- **`platform/console/`** (the existing ADP Fluent console). Reuse the **API client logic** (`src/runClient.ts`, `src/traceClient.ts`, `src/liveTail.ts`, `src/types.ts`) as the proven, framework-agnostic integration layer to the ADP backend. These are the reference for the exact request and response shapes.

## 4. The ADP backend (target, already built and LIVE)

- **Where:** DT sub `Project-IBMMSOFFERINGSPOC`, `rg-adp-v1`, eastus2. Code: this repo (`platform/src`, .NET 10). Repo is local-only; do not push to GitHub.
- **Stack:** .NET platform (Agents, Orchestration, ContextLayer, DecisionIngest, PackageCompiler, PackageModel) to `ca-tracesapi` (Container Apps) to GPT-4o (`aif-adp-v1`) to AI Search RAG (`adp-knowledge`) + Fabric IQ semantic layer (workspace `adp-v1`, lakehouse `adp`, 1000 claims) to immutable trace + HITL + outcomes.
- **4 agents:** FNOL, coverage-verify, triage, routing. HITL gate fires when confidence drops below threshold.
- **API (what the new console calls):**
  - `GET  /api/health`
  - `POST /api/runs` body `{ "subjectId": "CLM-2026-10005", "useCase": "meridian-pnc-auto-claims" }`
  - `GET  /api/runs/{runId}/status`
  - `GET  /api/traces/{subjectId}` (immutable trace: steps, grounding citations, confidence, HITL)
  - `GET  /api/aggregate/outcomes` (dashboard KPIs)
  - SignalR live tail (`fnoltrace`): each `DecisionEvent` pushes a step in real time.
  - Live API base: `https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io`

## 5. Build approach

1. **New app.** Create `apps/console/` as a fresh React + TypeScript + Vite app. Design system: **IBM Carbon v11** (professional, product-grade, and the harvest components are Carbon so they transfer cleanly). Add a small motion layer (Framer Motion or CSS) and a charting layer for the dashboard.
2. **Reuse the ADP API layer.** Port `platform/console/src/{runClient,traceClient,liveTail,types}.ts` into `apps/console/src/services/` as the integration layer. This is the proven, framework-agnostic client to `ca-tracesapi`. No new backend, no Cosmos, no Node BFF.
3. **Compose the experience** (harvest components, rebuild clean on our shell + our API):
   - **Decision Queue** (landing): the adjuster works a prioritized list of decisions, not claims. Confidence, gate status, aging, use-case tag.
   - **Decision Mode** (workspace): the live agent trace (SignalR live tail), grounding citations, confidence, evidence and policy context, and the HITL approve/escalate action with full rationale.
   - **Action Preview**: governed action before execution (approve/deny/route), with the immutable-journal framing.
   - **Outcomes Dashboard**: `GET /api/aggregate/outcomes` rendered as a modern KPI + charts view (handled, grounded-step rate, avg confidence, needs-review).
   - **Platform view**: a short, elegant "how it works" + use-case switcher (claims live, banking next) that proves the platform is client-agnostic.
   - **Optional narrator/story mode** (from `mvp-demo`): a guided overlay that walks the 7 demo beats.
4. **Multi use case.** Drive everything off the use case. `POST /api/runs` passes `useCase`; the console reads the available use cases and renders whatever the API returns. Banking is a later phase: a second EA package + corpus in `usecases/`, same console, no UI rewrite.
5. **Branding.** ADP / Meridian Mutual. Never the "imagine" name. Clean, modern, professional identity we own.

## 6. UI/UX quality bar (this is the point: world-class, best-in-class)

- **Modern and professional:** a considered visual system (spacing scale, type scale, restrained palette with one confident accent, consistent elevation and radius). Product-grade, not a demo skin.
- **Motion with purpose:** smooth transitions, a genuinely live-feeling agent trace (steps stream in), subtle state and loading choreography. Never gratuitous.
- **Data visualization done right:** the dashboard and confidence/grounding indicators use clear, accessible, well-labeled charts. (Use the `dataviz` skill guidance if available.)
- **Decision-centric IA:** the user works decisions. Queue to workspace to governed action is the spine. Every screen answers "what needs my judgment and why."
- **Trust and explainability visible:** grounding citations, confidence, and the immutable journal are first-class UI, not footnotes. This is the governance story.
- **Accessible and responsive:** WCAG-minded (contrast, focus, keyboard, ARIA), works on laptop and large display, light and dark themes.
- **Fast:** instant navigation, optimistic UI where safe, no jank on the live tail.
- **Coherent:** one design language across every surface. It should feel like one best-in-class product.

## 7. Phased plan

- **P0 Scaffold + connect.** Create `apps/console/`, port the ADP API layer, prove a live run renders (health, POST /api/runs, GET /api/traces, SignalR) with a minimal shell.
- **P1 Decision Queue + Decision Mode.** The hero: prioritized decision list to live agent-trace workspace with HITL approve/escalate on real ADP runs. Grounding + confidence visible.
- **P2 Action Preview + Outcomes Dashboard.** Governed action; modern KPI + charts dashboard.
- **P3 Design pass to world-class.** Full visual system, motion, dark/light, accessibility, responsiveness, polish. This is where "best in class" is earned.
- **P4 Platform view + narrator mode + banking use case.** Use-case switcher, guided story mode, second EA package + corpus for banking. Multi use case on one platform.
- **P5 Deploy + runbook.** Deploy the new console to the DT sub (new SWA or replace `swa-adp-v1-console`). Update `DEMO-RUNBOOK.md`.

## 8. Rules and guardrails

- **ADP repo is local-only. Do NOT push to GitHub** (memory `feedback_adp_no_github_pushes`). This folder is canonical (`feedback_adp_folder_canonical`).
- **Never use the "imagine" name** in ADP. Carrier-agnostic DT Offering asset.
- **DT Offering Azure only.** Sub `Project-IBMMSOFFERINGSPOC` (`feedback_azure_sub_routing`). Never create resources on Project IMAGINE subs or instances.
- **Local-first.** Build and verify locally before any DT-sub deploy (`feedback_adp_portal_local_first`).
- Keep the platform/usecase boundary (`scripts/check-boundary.mjs`): the console is a use-case-agnostic shell that renders whatever the API returns.
- No em dashes in written docs (`feedback_no_em_dash`); use colons or commas.

## 9. Pointers

- ADP: `SPEC.md`, `DEMO-RUNBOOK.md` (live URLs, demo script, resources, local run), `docs/ARCHITECTURE.md`, `docs/adr/` (0006 console + state contract, 0007 agent runtime).
- ADP API contract reference: `platform/console/src/{runClient,traceClient,liveTail,types}.ts`.
- Harvest UX: `apps/_harvest-client-demo/frontend/src/{pages,components}/*`, plus its `CLAIMS-MODULE-SPECIFICATION.md` and `api-specification.md`.
- Harvest ideas: `../Project IMAGINE/repos/mvp-demo/` (narrator beats, magic-link sharing).

## 10. Open decisions (resolve early next session)

1. Design system: **Carbon v11** (recommended: professional, harvest transfers) vs a custom modern system. Recommendation: Carbon v11 as the base, themed to ADP so it does not look stock.
2. Dev target: run the new console against the LIVE `ca-tracesapi` (fastest) or a local ADP backend when changing agents. Recommendation: LIVE for UI work.
3. Charting library for the dashboard (Carbon Charts vs a lighter modern lib). Recommendation: pick per the `dataviz` guidance; Carbon Charts if staying fully Carbon.
4. Auth for the deployed demo: magic-link / shared-link (harvest from `mvp-demo`) vs open. Recommendation: shared-link for easy stakeholder access.
