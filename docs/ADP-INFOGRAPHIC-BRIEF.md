# Agentic Decision Platform (ADP) — Full Brief for Infographic Generation

*Prepared 2026-07-15. Source of truth: `apps/console/public/docs/ADP-SOLUTION.md` (2026-07-13), live resource group `rg-adp-v1`. All facts below are current and verified against the live system — nothing here is aspirational.*

**How to use this document:** paste the whole thing into ChatGPT (or hand it section by section) with an instruction like *"Using the facts in this brief only, design an infographic on [section name]. Use the exact numbers, names, and structure given — do not invent data."* A ready-made list of suggested infographics with their source sections is at the very end.

---

## 1. WHAT — the one-sentence definition

> **ADP is a governed decision platform: one engine that runs any regulated operational decision, grounded in the organisation's own data, gated by confidence, and journaled immutably for the regulator.**

It is not a chatbot, not a single-use-case AI pilot, and not a rules engine. It is infrastructure for regulated decision-making, built entirely on the Microsoft agentic stack, by IBM Consulting.

**Elevator pitch (memorized, used to open every demo):**
> "This is a decision platform, not a chatbot. Any regulated decision, grounded in the client's own data, gated by confidence, journaled for the regulator. The use case is a package the platform runs, not a product the platform becomes: zero domain code in the engine. I will prove it by running two industries through identical machinery, live."

---

## 2. WHY — the problem and the thesis

### 2.1 The problem it solves

Regulated industries (insurance, banking, healthcare) run on high-volume operational decisions: claim triage, damage estimation, fraud screening, settlement, loan origination. Today these decisions are one of three broken patterns:

| Pattern | Failure mode |
|---|---|
| **Manual** | Slow, expensive, inconsistent, opaque under audit |
| **Rule-engine automation** | Brittle, can't reason over unstructured evidence (photos, documents), blind to context |
| **"AI pilots"** | A single chatbot bolted onto one process — no governance story, no grounding story, no reuse for the next use case |

Enterprises don't need another AI pilot. They need **one governed engine** that can run *any* regulated decision.

### 2.2 The core thesis (the sentence that explains everything else)

> **"The use case is a package the platform runs, not a product the platform becomes."**

The platform ships with **zero domain logic**. A use case — P&C auto claims, consumer loan origination, or the next one — arrives as a **signed agent package**: a declarative bundle of digital workers, agents, skills, tools, prompts, human-in-the-loop (HITL) gate policy, service-level objectives (SLOs), and a data-corpus binding. The same console, same runtime, same journal, same governance surfaces execute it. **Adding a use case means adding a package — not forking a codebase.**

### 2.3 Proof, live: two industries, one machine

| Use case | Industry | Client (synthetic) | Digital workers | Lifecycle stages |
|---|---|---|---|---|
| `p-and-c-auto-claims` | Insurance | Meridian Mutual | FNOL Handler, Damage Handler, Fraud Handler, Settlement Handler (4 agents each) | Intake & Routing → Damage & Estimation → Fraud Screen → Settlement & Payment |
| `consumer-loan-origination` | Banking | Northwind Bank | Consumer Loan Handler (3 agents) | Origination Decision |

### 2.4 The five pillars of credibility

1. **Grounded** — every agent step retrieves context through the Microsoft IQ federation (Foundry IQ vector search, Fabric IQ semantic layer + a published Fabric Data Agent, Work IQ collaboration signals); citations are stored per step, per source, with relevance scores.
2. **Governed** — confidence below the package's declared threshold automatically opens a human-in-the-loop gate. Operator judgments, overrides, and governed actions are first-class journal events.
3. **Explainable** — the immutable decision journal reconstructs into a print-ready **Decision Record** (the regulator artifact) for any subject, on demand.
4. **Multimodal** — members upload damage photos at intake; GPT-4o vision produces an objective description that travels inside the record to every downstream agent.
5. **Portable** — the runtime is adapter-based. Identical decision semantics run on three interchangeable backends without touching the package.

---

## 3. HOW — the end-to-end process (the claims journey, member's phone to regulator's desk)

| Step | What happens |
|---|---|
| **0. Sign in** | Member portal derives identity, policy, vehicles, and claim history live from the platform's own records API — nothing hardcoded |
| **1. File a claim (FNOL wizard)** | Pre-filled policy/vehicle/contact details; member describes the incident, flags injuries/third parties/police report, **uploads up to 6 damage photos** (client-side resized, 1024px JPEG) |
| **2. Intake — vision runs once, here** | System assigns the next claim number by learning the corpus's own id pattern; GPT-4o vision produces an **objective evidence description** (damage areas, severity, readable text, inconsistencies); the assessment is embedded into the claim record permanently |
| **3. Decision queue** | The claim appears immediately in the operator console, lifecycle progress shown per subject |
| **4. Stage runs** | Each lifecycle stage = one digital worker (FNOL → Damage → Fraud → Settlement). Every agent step is grounded, scored, and journaled with citations, ontology bindings, and regulatory references |
| **5. Human-in-the-loop, organically** | When a step's confidence falls below the package's threshold, the run pauses; the console's "Your judgment" panel shows the agent's reasoning and evidence; the operator approves/overrides/redirects; the judgment is journaled; the run resumes |
| **6. The member sees everything** | Member tracker mirrors the same journey in plain language: stage progress, "a specialist is reviewing," the photos submitted, **what the AI saw in the photos**, and the estimated repair cost |
| **7. Decision Record & Outcomes** | Print-ready regulator artifact reconstructed entirely from the journal; an aggregate Outcomes dashboard (grounding rate, calibrated confidence, oversight rate, per-worker cycle time) |

**The banking flow is the identical platform, verbatim** — a borrower applies at a separate portal, the Consumer Loan Handler decides the origination stage, the same journal/gates/record/outcomes machinery applies with zero code fork.

---

## 4. SOLUTION ARCHITECTURE — five planes, top to bottom

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EXPERIENCE PLANE  (React SPA on Azure Static Web Apps)    │
│    Platform console │ Member portal │ Borrower portal        │
├─────────────────────────────────────────────────────────────┤
│ 2. DECISION PLANE  (.NET 10 isolated Azure Functions          │
│    in a Container App — Durable Functions orchestration)     │
│    Prepare run → Step execution → HITL gates → Journaling    │
├─────────────────────────────────────────────────────────────┤
│ 3. AGENT RUNTIME  (adapter pattern — 3 backends, 1 contract) │
│    Microsoft Agent Framework │ Legacy Azure OpenAI │ Foundry │
├─────────────────────────────────────────────────────────────┤
│ 4. CONTEXT PLANE  (the Microsoft IQ federation)              │
│    Foundry IQ │ Fabric IQ │ Fabric Data Agent │ Work IQ      │
├─────────────────────────────────────────────────────────────┤
│ 5. DATA PLANE                                                │
│    Cosmos DB │ Event Hubs │ SignalR │ Blob │ Fabric │ AI Search│
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Experience plane
One React application, three faces:
- **Platform console** (`/`, `/decisions`, `/outcomes`, `/agents`, `/lab`, `/docs`) — the operator/leadership view. IBM Carbon v11 design system + Microsoft Fluent 2 iconography.
- **Meridian Mutual member portal** (`/member`) — client-branded insurance experience.
- **Northwind Bank borrower portal** (`/bank`) — parallel banking experience, separate branding.

### 4.2 Decision plane
`ca-tracesapi` (Azure Container App) hosts the whole backend — HTTP API + Durable Functions orchestration. A decision run is a Durable orchestration:
1. **PrepareRunActivity** resolves the subject's record and loads the signed package.
2. **Step execution** walks the package's agent plan — route context, run the agent, execute tool calls, score confidence, journal the step.
3. **HITL gates** suspend the orchestration below the confidence threshold; resumed via API with the operator's judgment.
4. **Journaling** — every step lands in Cosmos DB and fans out to Event Hubs + Azure SignalR for the live console tail.

### 4.3 Agent runtime — three backends, one contract
`IAgentAdapter` + a shared `PromptContract` guarantee identical decision semantics across:
- **Microsoft Agent Framework** (ACTIVE) — `ChatClientAgent` over Azure OpenAI, MCP tools bridged as journaled functions.
- **Legacy** — direct Azure OpenAI chat completions, same contract.
- **Azure AI Foundry Agent Service** (LIVE, switchable per run) — persistent agents visible in the Foundry portal.

Model: `gpt-4o` for both reasoning and evidence vision, plus embeddings for vector retrieval.

### 4.4 Context plane — the Microsoft IQ federation
| Source | System | Contributes |
|---|---|---|
| **Foundry IQ** | Azure AI Search (vector + semantic) | Policy documents, guidelines, regulatory text with relevance scores |
| **Fabric IQ** | Microsoft Fabric Lakehouse SQL endpoint | Gold semantic layer (dimensional model of policyholders, vehicles, claims, loans) |
| **Fabric IQ Data Agent** | Published Fabric Data Agent | Natural-language answers over the ontology + semantic model |
| **Work IQ** | Microsoft Graph (synthetic today, Graph-ready) | Collaboration context — adjuster threads, discussion signals |

Every citation flows: retrieved fragment → step `citedSources` → Cosmos journal → console evidence chips → Decision Record.

### 4.5 Data plane
- **Cosmos DB** (`cdb-adp-v1`) — immutable decision journal + runtime intake.
- **Event Hubs** (`evh-adp-v1`) — decision event fan-out.
- **Azure SignalR** (`sigr-adp-v1`, serverless) — live step tail.
- **Blob storage** (`stadpv1`) — damage-photo evidence.
- **Microsoft Fabric** — lakehouse gold layer (24 tables) + ontology + published Data Agent.
- **Azure AI Search** (`srch-adp-v1`) — the Foundry IQ vector index.

---

## 5. THE DIGITAL WORKER MODEL — agents, skills, tools

A **digital worker** is one lifecycle stage, shipped as a signed package. Clean three-part anatomy:

| Layer | Answers | Example |
|---|---|---|
| **Agents** | *Who decides* | Each agent has its own instructions, confidence calibration (low/high thresholds), gate policy, ontology bindings. Settlement Handler runs 4: `settlement-intake`, `settlement-calculation`, `settlement-disclosure`, `settlement-disbursement` |
| **Skills** | *What they know* | A named, versioned unit of domain method attached to specific agents, compiled into the artifact. No side effects — pure reasoning shaping. Settlement Handler carries **11 skills** across its 4 agents |
| **Tools** | *What they can do* | Executable MCP capabilities called at runtime via function calling; every call journaled with arguments, result, duration, success. Settlement Handler declares **4**: `claim-store`, `policy-store`, `vehicle-lookup`, `decision-journal` |

**Why the counts matter (e.g. "4 agents · 11 skills · 4 tools"): provenance.** A decision is permanently attributable to the exact signed version of the worker that made it. Change any skill or tool → the version changes → old decisions keep pointing at the version that produced them.

**Humans in the loop are a first-class concept, not an afterthought.** Ids like `ADJ-1204` (adjusters) or `SIU-INV-436` (fraud investigators) are the carrier's real human workforce, living in Fabric lakehouse rosters (state, certification tier, tenure, workload). Routing agents select among them under declared policy (certification match, state match, lowest workload, hard exclusions) — the AI's output is very often *a decision about which human should act*, and that routing reasoning is journaled like every other step.

### The package model
`agent-package.v1.schema.json` declares: package identity + version, industry + use case, lifecycle stage + order, the digital worker (name, Entra Agent ID, corpus binding), agents (model, instructions, skills, calibration), tools, HITL gate policy, SLOs. Packages are compiled and cryptographically signed by a purpose-built compiler (`adpc`), then validated at load.

---

## 6. GOVERNANCE, AUDIT & HONESTY

- **Immutable journal** — every step of every run in Cosmos DB, never updated in place.
- **Decision Record** — print-ready reconstruction per subject; what an auditor/regulator actually receives.
- **Agent registry** — the declared estate (workers, agents, models, skills, calibration, SLOs, Entra Agent ID) joined with journal-observed reality (runs, per-agent confidence, gates fired, operator judgments).
- **Guardrails** — carrier-agnostic naming, no client names, no client data (all synthetic), local-only repository.
- **Stated honesty on stage**, always: all subject data is synthetic; Work IQ is deterministic-synthetic pending tenant Graph consent; agent reasoning is real GPT-4o inference, never scripted.

---

## 7. CONVERSATIONAL AI — two chat surfaces, one honesty rule

| | Member Assistant | Operator Copilot |
|---|---|---|
| **Where** | Floating dock, both branded member portals | Every page of the platform console |
| **Grounded in** | *This member's* records + journey only, assembled server-side | Three governed tools the model chooses between: decision journal, subject records, Fabric Data Agent |
| **Entitlement** | Fraud detail is invisible by construction — never in context, can't leak even under prompt injection | Fraud/operational detail IS visible — ops team is entitled to it |
| **Runtime** | GPT-4o via direct Azure OpenAI REST | Real Microsoft Agent Framework agent (same runtime as the digital workers) |
| **Transparency** | — | Every reply shows `toolsUsed` as source chips; subject ids deep-link into the console |

Both return one structured response per turn (`reply` + `followUps`), so contextual next-question chips cost zero extra model calls. Positioned next: exposing the operator copilot as a **Microsoft 365 Copilot declarative agent**.

---

## 8. TECHNOLOGY STACK

### Azure resources (all in `rg-adp-v1`, East US 2)
Container Apps · Static Web Apps · Container Registry · Cosmos DB · Event Hubs · SignalR Service · Storage · AI Search · AI Foundry · Azure OpenAI (`gpt-4o`) · Key Vault · App Insights / Log Analytics · Event Grid · 6 managed identities · Microsoft Fabric workspace + published Data Agent.

### Backend
.NET 10, C#, isolated-worker Azure Functions + Durable Functions, Microsoft Agent Framework 1.13, Azure OpenAI SDK, Azure Storage Blobs. Modular projects: API layer, agent adapters, context/IQ sources, decision journal, orchestration, package model, tool runtime, package compiler.

### Frontend
React 18 + TypeScript + Vite + React Router. IBM Carbon v11 as the structural design system; Microsoft Fluent 2 iconography on Microsoft-stack surfaces — a deliberate dual-brand convention. Playwright screenshot verification as part of the definition of done.

---

## 9. KEY NUMBERS & METRICS (for stat callouts / big-number infographic tiles)

| Metric | Value |
|---|---|
| Industries proven live, side by side | **2** (insurance, banking) |
| Digital workers, insurance use case | **4** (FNOL, Damage, Fraud, Settlement) |
| Agents per digital worker (example: Settlement) | **4** |
| Skills on Settlement Handler | **11** |
| Tools on Settlement Handler | **4** |
| Agent runtime backends (interchangeable) | **3** (Agent Framework, Legacy, Foundry) |
| Context/IQ federation sources | **4** (Foundry IQ, Fabric IQ, Fabric Data Agent, Work IQ) |
| Max damage photos per claim | **6** |
| Decision cycle time, p50 (intake) | **~8 seconds** |
| Decision cycle time, p90 (intake) | **~12 seconds** |
| Loan decision p90 (human-thinking-at-a-gate, by design) | **~363 seconds** |
| Estimated idle infra cost | **~USD 3-5/day** |
| Backend image versions shipped | **22+** |
| Fabric lakehouse tables | **24** (gold semantic layer) |
| API surface | **~20 REST endpoints** |
| Architecture "planes" | **5** (Experience, Decision, Agent Runtime, Context, Data) |
| Credibility pillars | **5** (Grounded, Governed, Explainable, Multimodal, Portable) |

---

## 10. ROADMAP (what shipped vs. what's blocked on external approval)

**Recently shipped (all verified live end to end):**
- Vision-informed damage estimation
- Fraud evidence cross-check (photo-vs-narrative consistency scoring)
- Document evidence (police-report PDFs)
- Banking evidence parity (payslip/statement vision verification)
- Fabric write-back of runtime intake (lakehouse always reflects the latest filed claims)
- **Azure AI Foundry Agent Service backend** — now switchable per run, validated live

**Pending external action (not a platform limitation — a permissions/licensing wait):**
- Real Work IQ via Microsoft Graph — needs tenant admin consent
- Microsoft 365 Copilot surface for the operator copilot — needs tenant licensing + admin consent

---

## 11. SUGGESTED INFOGRAPHICS (ready-made prompts for ChatGPT)

Copy any one of these into ChatGPT along with this brief:

1. **"The Thesis" one-pager** — Source: §2. A single powerful visual contrasting "manual / rules / AI pilot" (the three broken patterns) against "ADP: one governed engine" with the "package, not a product" tagline as the hero statement.
2. **Five-Plane Architecture Diagram** — Source: §4. A vertical stack diagram of the five planes with 2-3 bullet labels per plane; use Azure-blue gradient bands.
3. **The Digital Worker Anatomy** — Source: §5. Three concentric or stacked layers: Agents (who decides) → Skills (what they know) → Tools (what they can do), with the Settlement Handler numbers (4 agents · 11 skills · 4 tools) as the running example.
4. **End-to-End Claim Journey** — Source: §3. A horizontal 8-step timeline/flow from "member signs in" to "Decision Record," icon per step.
5. **The Five Pillars of Trust** — Source: §2.4. Five icon-badge callouts: Grounded, Governed, Explainable, Multimodal, Portable.
6. **Runtime Portability Diagram** — Source: §4.3. One package/contract at the top, three interchangeable adapter boxes underneath (Agent Framework / Legacy / Foundry), each swappable via one parameter.
7. **The IQ Federation Map** — Source: §4.4. A hub-and-spoke diagram: agent step in the center, four IQ sources feeding in with what each contributes.
8. **Two Chat Surfaces Comparison** — Source: §7. Side-by-side comparison card: Member Assistant vs. Operator Copilot (grounding, entitlement, runtime).
9. **By the Numbers** — Source: §9. A stat-tile grid infographic (6-10 big numbers with short labels) — good as a single shareable summary card.
10. **Roadmap: Shipped vs. Blocked** — Source: §10. Two-column checklist infographic — green checks for shipped, amber locks for pending-external-approval items with the specific unlock listed.

---

*IBM Consulting — Data Transformation on Microsoft Cloud. Demonstration asset; all data synthetic, no client data. Carrier-agnostic by design; do not attach real client or carrier names to this material.*
