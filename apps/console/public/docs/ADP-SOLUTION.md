# Agentic Decision Platform (ADP): Solution Documentation

**An IBM Consulting engineering build on the Microsoft agentic stack.**
Status: live demonstration environment, all data synthetic. Last updated 2026-07-13.

- Live console: https://lemon-water-065e3e40f.7.azurestaticapps.net/?key=meridian-adp-2026
- Member portal (insurance): `/member` · Borrower portal (banking): `/bank`
- Backend API: Azure Container Apps (`ca-tracesapi`), resource group `rg-adp-v1`

---

## 1. What ADP is, and why it exists

### 1.1 The problem

Regulated industries (insurance, banking, healthcare) run on high-volume operational decisions: claim triage, damage estimation, fraud screens, settlement, loan origination. Today these decisions are either:

- **Manual**: slow, expensive, inconsistent, and opaque under audit; or
- **Rule-engine automated**: brittle, unable to reason over unstructured evidence, and blind to context; or
- **"AI pilots"**: single chatbots bolted onto one process, with no governance story, no grounding story, and no reuse across the next use case.

Enterprises do not need another AI pilot. They need a **decision platform**: one governed engine that can run *any* regulated decision, where every decision is grounded in the organisation's own data, gated by confidence, escalated to humans when uncertain, and journaled immutably for the regulator.

### 1.2 The thesis

ADP's core architectural bet, and the sentence that explains everything else in this document:

> **The use case is a package the platform runs, not a product the platform becomes.**

The platform ships zero domain logic. A use case (P&C auto claims, consumer loan origination, anything) arrives as a **signed agent package**: a declarative bundle of digital workers, agents, skills, tools, prompts, HITL gate policy, SLOs, and a corpus binding. The same console, the same runtime, the same journal, the same governance surfaces then execute it. Adding a use case is adding a package, not forking a codebase.

Two industries run side by side on the live instance today to prove the point:

| Use case | Industry | Digital workers | Lifecycle stages |
|---|---|---|---|
| `p-and-c-auto-claims` (Meridian Mutual) | insurance | FNOL Handler, Damage Handler, Fraud Handler, Settlement Handler (4 agents each) | Intake & Routing → Damage & Estimation → Fraud Screen → Settlement & Payment |
| `consumer-loan-origination` (Northwind Bank) | banking | Consumer Loan Handler (3 agents) | Origination Decision |

### 1.3 What makes it credible (the five pillars)

1. **Grounded**: every agent step retrieves context through the Microsoft IQ federation (Foundry IQ vector search, Fabric IQ semantic layer + published Fabric Data Agent, Work IQ collaboration signals) and the citations are stored per step, per source, with relevance scores.
2. **Governed**: confidence below the package's declared threshold opens a human-in-the-loop gate organically. Operator judgments, overrides, and governed actions are first-class journal events.
3. **Explainable**: the immutable decision journal reconstructs into a print-ready Decision Record (the regulator artifact) for any subject on demand.
4. **Multimodal**: members upload damage photos at FNOL; GPT-4o vision describes them objectively at intake and the assessment travels inside the claim record to every downstream agent.
5. **Portable**: the runtime is adapter-based. The same decision semantics run on the legacy Azure OpenAI adapter, the Microsoft Agent Framework adapter (active today), or Azure AI Foundry Agent Service (prepared, one env-var flip) without touching a package.

---

## 2. Overall architecture

Five planes, top to bottom. (See `adp-architecture.svg`.)

### 2.1 Experience plane (React SPA on Azure Static Web Apps)

One application, three faces:

- **Platform console** (`/`, `/decisions`, `/outcomes`, `/agents`, `/lab`, `/docs`): the operator and leadership view. IBM Carbon v11 design system with Microsoft Fluent 2 iconography on Microsoft-stack surfaces.
- **Meridian Mutual member portal** (`/member`): client-branded insurance experience. Members sign in, see their policy, vehicles, and claims, file a new claim (FNOL) with damage photos, and track every stage in member language.
- **Northwind Bank borrower portal** (`/bank`): the parallel banking experience for loan applicants, entirely separate flow and branding.

The SPA is deployed to Azure Static Web Apps; `/api/*` is proxied to the backend Container App so the browser sees one origin.

### 2.2 Decision plane (.NET 10 isolated Azure Functions in a Container App)

`ca-tracesapi` hosts the whole backend: HTTP API + Durable Functions orchestration. A decision run is a Durable orchestration:

1. **PrepareRunActivity** resolves the subject's record (runtime intake store first, bundled corpus fallback) and loads the signed package.
2. **Step execution** walks the package's agent plan. Each step: route context through the IQ federation, run the agent via the active adapter, execute tool calls through the industry-aware tool registry, score confidence, journal the step.
3. **HITL gates** suspend the orchestration when confidence drops below the package threshold (or a gate is forced for demo purposes); `POST /api/runs/{runId}/resolve-hitl` resumes it with the operator's judgment.
4. **Journaling**: every step lands in the Cosmos DB decision journal (`dw-state`) and fans out to Event Hubs and Azure SignalR for the live console tail.

### 2.3 Agent runtime (adapter pattern, three backends, one contract)

`IAgentAdapter` + a shared `PromptContract` guarantee identical decision semantics across backends:

- **`AGENT_BACKEND=agent-framework` (ACTIVE)**: Microsoft Agent Framework 1.13 (`Microsoft.Agents.AI.OpenAI`), `ChatClientAgent` over the Azure OpenAI client, MCP tools bridged as `AIFunction`s that journal every call.
- **`AGENT_BACKEND=legacy`**: direct Azure OpenAI chat completions, same contract.
- **`AGENT_BACKEND=foundry` (LIVE, switchable)**: Azure AI Foundry Agent Service, project `adp-v1` on `aif-adp-v1`. RBAC granted 2026-07-13; validated live with a full grounded run and persistent agents visible in the Foundry portal. Any run may select it via the `backend` parameter; the console offers the choice next to the run button.

Model: `gpt-4o` for both agent reasoning and evidence vision, plus embeddings for vector retrieval.

### 2.4 Context plane: the Microsoft IQ federation

The `ContextRouter` fans every step's retrieval across registered `IContextSource`s and merges cited fragments:

| Source | System | What it contributes |
|---|---|---|
| Foundry IQ | Azure AI Search (vector + semantic) | Policy documents, guidelines, regulatory text with relevance scores |
| Fabric IQ | Microsoft Fabric Lakehouse SQL endpoint | The gold semantic layer (dimensional model of policyholders, vehicles, claims, loans) |
| Fabric IQ Data Agent | Published Fabric Data Agent (`claims_data_agent`) | Natural-language answers over the ontology + semantic model, consulted per subject and cited |
| Work IQ | Microsoft Graph (synthetic today, Graph-ready) | Collaboration context: adjuster threads, prior discussion signals |

Citations flow end to end: retrieved fragment → step `citedSources` (source system, doc id, title, score) → Cosmos journal (`citedSourcesFull`) → console evidence chips → Decision Record.

### 2.5 Data plane

- **Cosmos DB (`cdb-adp-v1`)**: `dw-state` (immutable decision journal, every step of every run) and `intake` (runtime-filed subjects).
- **Event Hubs (`evh-adp-v1`)**: decision event fan-out.
- **Azure SignalR (`sigr-adp-v1`, serverless)**: live step tail to the console.
- **Blob storage (`stadpv1`)**: `evidence` container: damage photos in `{groupId}/photo-N.jpg`, plus alias blobs `subjects/{subjectId}` linking a subject to its photo group.
- **Microsoft Fabric**: lakehouse gold layer (24 tables) + ontology + published Data Agent.
- **Azure AI Search (`srch-adp-v1`)**: the Foundry IQ vector index.

---

## 3. End-to-end process flow (what actually happens)

The claims lifecycle, from a member's phone to the regulator's desk. (See `adp-process-flow.svg`.)

### Step 0: Sign in (member portal)

Members are real identities derived from the platform's own records API: the portal calls `GET /api/records?industry=insurance` and derives each policyholder's profile, policy, vehicles, and claim history. Nothing is hardcoded in the frontend.

### Step 1: File a claim (FNOL wizard, 3 steps)

Policy, vehicle, and contact details are pre-filled from the member's records. The member describes the incident, flags injuries / third parties / police report, and **uploads up to 6 damage photos**. Photos are resized client-side (canvas, 1024px JPEG) and uploaded to `POST /api/evidence`, which stores them in blob and returns a `groupId` that rides on the claim record.

### Step 2: Intake (vision runs once, here)

`POST /api/intake` assigns the next claim number by learning the corpus's own id pattern (`CLM-2026-*`), then, if the record carries an `evidenceGroupId`:

1. writes the subject alias blob (subject → photo group),
2. downloads the photos and calls GPT-4o vision for an **objective evidence description** (what is depicted, damage areas, severity, readable text, inconsistencies),
3. embeds the description into the stored record as `evidenceAssessment` (+ `evidencePhotoCount`).

Because the assessment lives inside the claim record, **every downstream stage's agents see the photo evidence at zero additional per-run cost**, and the fraud screen can compare what the photos show against what the narrative claims. Vision failure degrades gracefully: the claim still files.

### Step 3: The decision queue

The claim appears in the operator console queue immediately (runtime intake merges with the corpus). The queue shows lifecycle progress per subject across the use case's declared stages.

### Step 4: Stage runs (the lifecycle)

Each stage is a digital worker from the package: FNOL Handler → Damage Handler → Fraud Handler → Settlement Handler. Within a run, each agent step is grounded (IQ federation), scored, and journaled with citations, ontology bindings, and regulatory references. The Damage & Estimation stage produces the repair estimate the member sees.

### Step 5: Human-in-the-loop, organically

When a step's confidence falls below the package's declared threshold, the orchestration suspends and the console's "Your judgment" panel presents the gate with the agent's reasoning and evidence attached. The operator approves, overrides, or redirects; the judgment is journaled and the run resumes. Governed actions (e.g. request documents, schedule inspection) execute through `POST /api/actions` with a rationale, also journaled.

### Step 6: The member sees everything

The member tracker mirrors the same journey in member language: stage progress, "a specialist is reviewing" moments, the photos they submitted, **what our AI saw in your photos**, and the **estimated repair cost** lifted from the estimation step's output.

### Step 7: Decision Record and Outcomes

- `/decisions/{id}/record`: the print-ready regulator artifact reconstructed entirely from the journal: every step, confidence, citation, gate, and judgment.
- `/outcomes`: the aggregate story: decision runs, grounding rate, calibrated confidence, oversight rate, lifecycle depth, per-worker table with p50/p90 decision cycle time, filterable per use case, plus an exportable weekly Outcomes Report.

The banking flow is the same platform verbatim: borrower applies at `/bank`, the Consumer Loan Handler decides the origination stage, the same journal, gates, record, and outcomes apply.

---

## 4. Technology stack

### 4.1 Azure (resource group `rg-adp-v1`, East US 2)

| Resource | Name | Role |
|---|---|---|
| Container Apps | `ca-tracesapi` (env `cae-adp-v1`) | The entire backend: API + Durable orchestration (image `tracesapi:v13-evidence-3`) |
| Static Web Apps | `swa-adp-v1-console` | The SPA (console + both portals + docs) |
| Container Registry | `acradpv1` | Backend images, built in-cloud via `az acr build` |
| Cosmos DB | `cdb-adp-v1` | Decision journal (`dw-state`) + runtime intake |
| Event Hubs | `evh-adp-v1` | Decision event fan-out |
| SignalR Service | `sigr-adp-v1` | Live step tail (serverless mode) |
| Storage | `stadpv1` | Functions runtime + `evidence` blob container |
| AI Search | `srch-adp-v1` | Foundry IQ vector index |
| AI Foundry | `aif-adp-v1` / project `adp-v1` | Foundry Agent Service (prepared path) |
| Azure OpenAI | `dt-navigator-openai` (shared) | `gpt-4o` reasoning + vision, embeddings |
| Key Vault | `kv-adp-v1` | Secrets |
| App Insights / Log Analytics | `appi-adp-v1` / `log-adp-v1` | Telemetry |
| Event Grid | `egt-adp-v1-fanout` | Event fan-out (provisioned) |
| Managed identities | `id-adp-v1-*` (6) | Per-workload identities |
| Microsoft Fabric | workspace + `claims_data_agent` | Gold semantic layer + published Data Agent |

### 4.2 Backend

- .NET 10, C#, isolated-worker Azure Functions + Durable Functions
- Microsoft Agent Framework 1.13 (`Microsoft.Agents.AI.OpenAI`), Azure OpenAI, `Azure.Storage.Blobs`
- Central package management (`Directory.Packages.props`), `TreatWarningsAsErrors`
- Projects: `TracesApi` (functions), `Agents` (adapters + PromptContract), `ContextLayer` (IQ sources, EvidenceStore, EvidenceVision), `DecisionIngest` (journal read/write, intake), `Orchestration` (plan executor, step runner), `PackageModel`, `ToolRuntime`, per-use-case `Tools` projects, `adpc` (package compiler)

### 4.3 Frontend

- React 18 + TypeScript + Vite, React Router
- IBM Carbon v11 (`@carbon/react`, `@carbon/charts-react`, IBM Plex) as the structural design system
- Microsoft Fluent 2 (`@fluentui/react-icons`) + official product marks on Microsoft-stack surfaces
- Dual-brand convention shared with the DT offering website and collateral
- Playwright screenshot verification loop (`scripts/shot.mjs`) as part of the definition of done

### 4.4 Digital workers: agents, skills, and tools

A digital worker is one lifecycle stage, shipped as a signed package. Its anatomy follows one clean distinction:

- **Agents are who decides.** Each agent has its own instructions, confidence calibration (low/high thresholds), gate policy, and ontology bindings. Example: Settlement Handler runs `settlement-intake`, `settlement-calculation`, `settlement-disclosure`, `settlement-disbursement`.
- **Skills are what they know.** A skill is a named, versioned unit of domain method (`skills/<name>/SKILL.md`) attached to specific agents via `skillRefs` and compiled into the artifact. Skills shape reasoning and have no side effects: `deductible-application` is the carrier's deductible procedure as a governed asset, not prose buried in a prompt. Settlement Handler carries 11 skills across its 4 agents.
- **Tools are what they can do.** A tool is an executable MCP capability the agent calls at runtime via function calling; every invocation is journaled with arguments, result, duration, and success. Settlement Handler declares 4: `claim-store` (Cosmos), `policy-store` and `vehicle-lookup` (core-system stubs: the seam where a real Guidewire/Duck Creek connects), and `decision-journal`.

Why the counts appear on every trace ("4 agents · 11 skills · 4 tools"): **provenance**. A decision is permanently attributable to the exact signed version of the worker that made it; changing any skill or tool changes the version, and old decisions keep pointing at the version that produced them. The live, always-current reference for every worker (agents, skills, gates, tools, SLOs, observed behavior) renders on the console's Docs page and the Agents page from the registry itself.

### 4.5 The package model (how a use case ships)

`agent-package.v1.schema.json` declares: package identity + version, industry + use case, lifecycle `stage` + `stageOrder`, the digital worker (name, Entra Agent ID declaration, corpus binding), agents (model, instructions, skills, calibration), tools, HITL gate policy, SLOs. Packages are compiled and signed by `adpc` into `platform/src/TracesApi/Resources/*.zip` and validated at load.

---

## 5. API surface (all under `/api`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/decisions` | Queue: subjects × packages × latest traces, lifecycle progress |
| POST | `/runs` | Start a decision run `{subjectId, packageId, forceHitlAtAgentId?}` |
| GET | `/runs/{runId}/status` | Durable orchestration status |
| POST | `/runs/{runId}/resolve-hitl` | Resume a gated run with the operator judgment |
| GET | `/traces/{subjectId}` | Full trace (steps, citations, tool calls, gates) |
| GET | `/journey/{subjectId}` | Every trace ever journaled for a subject |
| GET | `/records?industry=` | Subject records (corpus + runtime intake merged) |
| POST | `/intake` | File a new subject (assigns id, runs evidence vision) |
| POST | `/evidence` | Upload damage photos (base64, max 6 × 2.5MB) |
| GET | `/evidence/subject/{subjectId}` | Resolve a subject's photo group |
| GET | `/evidence/file/{groupId}/{name}` | Serve a photo |
| POST | `/actions` | Execute a governed operator action with rationale |
| POST | `/assist` | Member assistant: chat grounded server-side in the signed-in member's own records and journey (fraud details never surfaced) |
| POST | `/copilot` | Operator copilot: a Microsoft Agent Framework agent with three governed tools (decision journal, subject records, Fabric IQ Data Agent); returns the reply plus which tools grounded it |
| GET | `/agents` | Governance registry: declared workers joined with observed behavior |
| GET | `/aggregate/outcomes?packages=` | KPI aggregates, filterable per use case |
| GET | `/aggregate/timeline?packages=` | Time-bucketed run/confidence series |
| GET | `/aggregate/cycletime` | Decision cycle time percentiles per worker |
| POST | `/generate/infographic` | Outcomes report support |

---

## 6. Governance, audit, and honesty

- **Immutable journal**: every step of every run in Cosmos, never updated in place.
- **Decision Record**: print-ready reconstruction per subject; what an auditor receives.
- **Agent registry** (`/agents`): the declared estate (workers, agents, models, skills, calibration, SLOs, Entra Agent ID declarations) joined with journal-observed reality (runs, per-agent confidence, gates fired, operator judgments).
- **Honesty notes, stated on stage**: all subject data is synthetic; Work IQ is a deterministic synthetic source until tenant Graph consent lands; the access key on the SWA is demo hygiene, not security; agent reasoning is real gpt-4o inference, never scripted.
- **Guardrails**: local-only repository, carrier-agnostic naming, DT Offering subscription only, no client names.

---

## 7. Conversational AI: the member assistant and the operator copilot

Two chat surfaces, two entitlements, one honesty rule. (See `adp-conversational.svg`.)

### 7.1 Member assistant (both branded portals)

A floating dock in the Meridian member portal and the Northwind borrower portal. The browser sends only the conversation and the signed-in member's id to `POST /api/assist`; **all grounding is assembled server-side**, so cross-member data can never reach the client:

- This member's records only (corpus + runtime intake), compacted: the incident or loan ask, vehicle, the photo/document `evidenceAssessment`, attached documents.
- A stage-by-stage journey summary from the decision journal, with member-relevant outputs surfaced (repair estimates, loan decisions).
- **Guardrail by construction**: fraud stages appear in the context only as "routine review" and their outputs are never included, so fraud detail cannot leak even under prompt injection. Off-account questions redirect to the care line.

Runtime: gpt-4o via the direct Azure OpenAI REST API (the platform's rule for plain completions), JSON response format, temperature 0.3. Verified live: exact journal figures for estimates and photo assessments, a refused fraud probe, verbatim payslip figures on the banking side, and honest "queued" answers for unstarted claims.

### 7.2 Operator copilot (platform console)

The company-level question surface, available on every console page. `POST /api/copilot` runs a **real Microsoft Agent Framework agent** (ChatClientAgent on the same 1.13 runtime that powers the digital workers) with three governed AIFunction tools the model chooses between per question:

| Tool | Grounds |
|---|---|
| `query_journal` | Operational state: open gates, latest stage per subject, runs per worker, average confidence |
| `query_records` | Subject digests across both use cases with text filtering, including evidence assessments and documents |
| `ask_fabric_data_agent` | Portfolio analytics delegated to the published Fabric IQ Data Agent (inline answers enforced) |

The response carries `toolsUsed`, rendered as source chips under each answer; subject ids in replies deep-link into Decision Mode. The entitlement inverts here: the operations team is entitled to fraud detail. Verified live: gated subjects matching the queue's own KPIs, evidence lists with vision assessments, and real portfolio counts by incident type from the 1000-row semantic layer.

### 7.3 Shared foundation

- One structured response per turn: `{"reply", "followUps"}`, so contextual next-question chips cost zero extra calls.
- SDK routing per the platform rule: raw REST for plain completions (assist, vision), Agent Framework for tool-calling agents (copilot, workers).
- Graceful degradation: unavailable means an honest error, never a fabricated answer.
- Positioned next: exposing the `/copilot` contract as a Microsoft 365 Copilot declarative agent (Copilot Studio / M365 Agents SDK) once tenant licensing and consent land.

## 8. Deployment and operations

### 7.1 Deploy paths

- **Backend**: `dotnet publish` (exit-code gated, warnings as errors) → `az acr build` (`tracesapi:vN-tag`) → `az containerapp update`. Never pipe publish output through filters that mask the exit code; verify behavior after every deploy.
- **Frontend**: `npm run build` → `npx @azure/static-web-apps-cli deploy ./dist --env production` → verify the live bundle hash matches `dist` → Playwright screenshot of the live routes.
- **Fabric**: gold-layer generator + loader scripts under `usecases/*/data`; Data Agent published from the workspace.

### 7.2 Configuration (env vars on `ca-tracesapi`)

`AGENT_BACKEND` (agent-framework | legacy | foundry), `AZURE_OPENAI_*`, `AZURE_SEARCH_*`, `AZURE_COSMOS_CONNECTION`, `AZURE_EVENTHUBS_CONNECTION`, `AZURE_SIGNALR_CONNECTION`, `AzureWebJobsStorage` (also the evidence store), `SEMANTIC_BACKEND` + `FABRIC_LAKEHOUSE_CONNECTION`, `FABRIC_DATA_AGENT_URL`, `FOUNDRY_PROJECT_ENDPOINT` (staged).

### 7.3 Engineering lessons worth keeping (paid for in deploys)

1. **Gate on the publish exit code.** Grep-filtered `dotnet publish` output masked a `TreatWarningsAsErrors` failure and shipped a stale image once. Exit code first, behavior verification after.
2. **`Azure.AI.OpenAI` 2.1 chat is binary-incompatible with the `OpenAI` 2.10 assembly** that Agent Framework resolves (`MissingMethodException` in `PostfixSwapMaxTokens`). New direct chat-completions code must call the Azure OpenAI REST API over HttpClient (`api-version=2024-10-21`); the evidence vision service does exactly that.
3. **Fabric Data Agent protocol**: every call needs `?api-version=2024-05-01-preview`, and the serving assistant must be minted via `POST /assistants {"model":"gpt-4o"}`; the artifact id is not an assistant id.
4. **Cosmos writes**: the SDK's Newtonsoft default serializes C# records PascalCase, which drops `id`; write lowercase anonymous objects.
5. **Screenshot verification before claiming a UI fix.** Carbon grid gutters (container padding, per-column `margin-inline`, nested subgrids) required empirical fixes verified by Playwright screenshots, not reasoning from source.
6. **Re-publishing the Fabric Data Agent requires a backend restart.** `FabricDataAgentSource` mints and caches its serving assistant for the process lifetime, and that assistant snapshots the agent's published config; after any re-publish (e.g. adding tables), restart the `ca-tracesapi` revision so a fresh assistant picks up the new sources. Symptom otherwise: SQL "no candidates pass validation" on the newly added tables while a locally minted assistant works fine.

---

## 9. Roadmap

Shipped 2026-07-13 (each verified live end to end):

| Item | How it landed |
|---|---|
| Vision-informed estimation | damage-handler v0.2.0 (image v14): intake summarizes the photo assessment, categorization grounds primarily in what the photos show (unclear or possibly non-genuine images gate to HITL), estimation positions the figure inside the band by visible damage and states how the photos moved it |
| Fraud evidence cross-check | fraud-handler v0.2.0 (v15): FraudIntakeReport gains evidenceConsistency (consistent / minor-discrepancy / contradiction / no-photos); contradiction gates to HITL regardless of score; ambiguity alone is never an indicator |
| Document evidence | Evidence store accepts police-report PDFs (v16); stored, served, listed on the record as `documentEvidence`, surfaced as chips on tracker and Decision Mode |
| Banking evidence parity | Borrower wizard uploads payslip photos + statement PDFs (v17); vision reads the actual figures; loan-handler v0.3.0 verifies stated income against them |
| Fabric write-back of intake | `scripts/sync-intake-to-fabric.ps1`: rebuilds the lakehouse tables as the full synthetic universe overlaid with runtime intake (runtime truth replaces colliding ids), then refreshes the SQL endpoint metadata; the Data Agent answers about subjects filed minutes ago |

Still pending external action:

| Item | Status | Unlock |
|---|---|---|
| Foundry Agent Service backend | SHIPPED 2026-07-13 | RBAC granted ("Cognitive Services User" on `aif-adp-v1`; the tenant lacks the newer "Azure AI User" role). Validated live on the first run: 4/4 steps GROUNDED, four persistent agents visible in the Foundry portal. Now switchable per run: `POST /api/runs` takes optional `backend` (agent-framework, foundry, legacy) with `AGENT_BACKEND` as default, and the console offers the choice in Decision Mode and the Lab |
| Real Work IQ (Microsoft Graph) | Synthetic today | Tenant admin consent for Graph application permissions |
| Banking tables in the Data Agent | SHIPPED 2026-07-13 | `fact_loan_applications` + `dim_borrower` ticked and re-published; verified end to end including the operator copilot (portfolio by purpose + runtime-filed application rows) |
| Microsoft 365 Copilot surface | Positioned | The operator copilot's contract (POST /copilot) is the natural declarative-agent action; exposing it inside M365 Copilot via Copilot Studio or the M365 Agents SDK needs tenant licensing + admin consent (same approval channel as Work IQ) |

---

*IBM Consulting: Data Transformation on Microsoft Cloud. Demonstration asset, all data synthetic, no client data.*
