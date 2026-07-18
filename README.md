# Agentic Decision Platform (ADP)

**A governed decision platform: one engine that runs any regulated operational decision, grounded in an organization's own data, gated by confidence, and journaled immutably for the regulator.**

Not a chatbot. Not a single-use-case AI pilot. The core bet: **a use case is a package the platform runs, not a product the platform becomes** — the engine ships with zero domain logic; a use case arrives as a signed package (digital workers, agents, skills, tools, HITL policy, data binding) and the same runtime, console, and journal execute it.

**Status:** live, working, both use cases fully functional. All data synthetic.

- **Live console:** https://lemon-water-065e3e40f.7.azurestaticapps.net/?key=meridian-adp-2026
- **Member portal (insurance):** `/member` · **Borrower portal (banking):** `/bank`
- **Backend API:** `https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io`

---

## Read this first

- **[`docs/ADP-SOLUTION.md`](apps/console/public/docs/ADP-SOLUTION.md)** (also rendered live on the console's `/docs` page) — the full solution document: what/why/how, architecture, tech stack, API surface, governance, roadmap. Start here for the complete picture.
- **[`SPEC.md`](SPEC.md)** — current scope, pinned stack, honest stubbed-vs-real list, success criteria.
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — platform / use-case / integration views.
- **[`docs/CTO-DEMO-PLAYBOOK.md`](docs/CTO-DEMO-PLAYBOOK.md)** — the live-demo script and thesis.
- **[`docs/MIGRATION.md`](docs/MIGRATION.md)** — recreate-from-zero runbook (every Azure resource, every config).

## What's actually built

| Use case | Industry | Digital workers | Lifecycle |
|---|---|---|---|
| `p-and-c-auto-claims` (Meridian Mutual) | Insurance | FNOL Handler, Damage Handler, Fraud Handler, Settlement Handler | Intake & Routing → Damage & Estimation → Fraud Screen → Settlement & Payment |
| `consumer-loan-origination` (Northwind Bank) | Banking | Consumer Loan Handler | Origination Decision |

Both run on the same runtime, same immutable Cosmos DB decision journal, same governance surfaces — zero code forked between them.

**Five architectural pillars:** grounded (every step cites its source with a relevance score, via a federation of Foundry IQ, Fabric IQ, a published Fabric Data Agent, and Work IQ), governed (confidence-gated human-in-the-loop), explainable (immutable journal reconstructs into a print-ready Decision Record), multimodal (GPT-4o vision reads evidence at intake), and portable (the agent runtime is adapter-based — Microsoft Agent Framework, Azure AI Foundry Agent Service, or direct Azure OpenAI, switchable per run behind one shared contract).

## Repo layout

```
agentic-decision-platform/
├── apps/
│   └── console/                 React 19 + TypeScript + Vite + Carbon v11 — the platform console,
│                                 member portal (/member), borrower portal (/bank), docs (/docs)
├── platform/
│   ├── src/
│   │   ├── TracesApi/            .NET 10 isolated Azure Functions + Durable Functions — the whole backend API
│   │   │   └── Functions/        one file per REST endpoint (RunFnol, ResolveHitl, GetTrace, GetAgents, ...)
│   │   ├── Agents/                the adapter pattern — IAgentAdapter, PromptContract, and the 3 backends
│   │   │   (AgentFrameworkAdapter, FoundryAdapter, LegacyOpenAIAdapter) + AdapterRegistry (the runtime switch)
│   │   ├── ContextLayer/          the IQ federation — ContextRouter + one IContextSource per source
│   │   │   (Foundry IQ, Fabric IQ x2 tiers, Work IQ) + EvidenceStore/EvidenceVision (GPT-4o vision)
│   │   ├── Orchestration/         PlanExecutor, StepRunner, HitlGateEvaluator — the step-execution loop
│   │   ├── DecisionIngest/        journal read/write, runtime intake
│   │   ├── PackageModel/          the agent-package schema + serializer
│   │   ├── PackageCompiler/       `adpc` — compiles + signs a package into a deployable artifact
│   │   └── ToolRuntime/           IMcpTool contract + the tool registry
│   └── schemas/
│       └── agent-package.v1.schema.json   the package contract
├── usecases/
│   ├── meridian-pnc-auto-claims/    packages, synthetic data corpus + Fabric gold-layer generator, ontology
│   └── banking-loan-origination/    same shape, banking domain
├── scripts/                      demo warm-up, Fabric sync/write-back, deploy helpers
└── docs/                         solution doc, architecture, ADRs, demo playbooks, walkthrough scripts, migration runbook
```

## Running the console locally

```powershell
cd apps/console
npm install
npm run dev    # http://localhost:5173, points at the live backend by default
```

## Technology

.NET 10 · Microsoft Agent Framework 1.13 · Azure AI Foundry Agent Service · Azure OpenAI (GPT-4o) · Microsoft Fabric (Lakehouse, Ontology, GraphModel, Data Agent) · Azure AI Search · Cosmos DB · Event Hubs · Azure SignalR · Azure Container Apps · React 19 + Carbon v11 + Fluent 2.

## Boundary check

```powershell
node scripts/check-boundary.mjs
```

`platform/` must never import from `usecases/` — this is what keeps the engine genuinely use-case-agnostic. Run before any commit that touches `platform/`.

---

*IBM Consulting — Data Transformation on Microsoft Cloud. Demonstration asset, all data synthetic, no client data. Carrier-agnostic by design.*
