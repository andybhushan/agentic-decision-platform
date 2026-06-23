# ADP v1.0 — Live Demo Script

**Length:** ~7 minutes spoken, ~10 minutes full session. **Audience:** Microsoft co-build conversation, IBM Consulting practice leaders, customer pilots.

Live URL: **https://witty-sea-0d12a380f.7.azurestaticapps.net** (operator console) + **/docs** (system documentation portal).

---

## Setup (do once, before the meeting)

1. Open the operator console in the primary browser window. Confirm "Today's outcomes" panel renders.
2. Open the `/docs` route in a second browser tab as a parallel visual reference.
3. Have the Fabric portal (https://app.fabric.microsoft.com/) open in a third tab — workspace `adp-v1` → Lakehouse `adp` → SQL endpoint. Useful if anyone asks "is this real data?"
4. (Optional but powerful) Run **Run FNOL** ahead of time to populate the outcomes panel with a non-zero claim count.

## Act 1 — Opening (60 seconds)

> **"Project ADP is the Microsoft-practice answer to 'what would an ICA-like agentic platform look like if it ran on Azure end-to-end and shipped as a turnkey operational layer for a frontier insurance firm?'"**

Open `/docs` Mission section.

> "Mission: agentic-AI claim operations, end-to-end. Vision: the platform behind any Microsoft frontier-firm's vertical workload, starting with Meridian P&C Auto. Goal: every claim from FNOL to settlement decided by named agents with auditable grounded reasoning, humans gate the consequential moments."

Switch to `/docs` Live Status block — point at the live Azure resource count, deployed packages, indexed knowledge docs, agent runs in the last 24h.

> "Everything you're about to see is running RIGHT NOW in `rg-adp-v1` in our Microsoft alliance subscription. The platform code is at `Project ADP/adp-v1`. 8 .NET projects, 5 packages, 21 knowledge docs, 4 ADRs added today bringing the total to 16."

## Act 2 — The platform shape (90 seconds)

Open `/docs` System Architecture section.

> "Three intentional layers. **Platform** (left): industry-agnostic. **Use cases** (right): everything Meridian-specific. **Contract** (middle): the agent package — a JSON manifest that declares agents, skills, tools, orchestration rules, HITL gates, and source bindings. The platform compiles, signs, registers, and executes the package. The use case owns the package."

Point at the L1-L10 layered diagram.

> "Layer 5 — Context — is where the real Microsoft IQ story lives. Three sources federated through one router. **Foundry IQ** = Azure AI Search with 21 knowledge docs, industry-filtered. **Fabric IQ** = a Lakehouse with 4 Delta tables and 4 aggregation primitives. **Work IQ** = synthetic-deterministic today, real Microsoft Graph wired in code, activates when the demo tenant is seeded."

Switch to `/docs` Deployment Architecture.

> "20-something Azure resources in one resource group. Foundry account, Fabric workspace, AI Search, Cosmos, Event Hubs, SignalR, Functions, Static Web App. Everything provisioned by Bicep. The whole thing is `git clone` + `./scripts/provision-*.ps1` and it stands up."

## Act 3 — One claim, end-to-end (4 minutes)

Switch to the operator console. Pick a known-good test claim or pick a fresh one.

### Step 1 — Run FNOL (~75 seconds)
1. Click **Run FNOL**. SignalR live-tail starts.
2. Step 1 (claim-intake) lands — narrate: "Extracts structured claim data. Cites Foundry IQ knowledge doc PAC-INTAKE-001 and Fabric IQ `POLICYHOLDER_HISTORY/PH-...`. The model writes its own confidence."
3. Step 2 (coverage-verification) lands — "Reads the policy clauses from AI Search, joins to Fabric. Decision is grounded, not derived."
4. Step 3 (initial-triage) lands. Point at the citation list — Fabric `SIMILAR_CLAIMS` + Foundry `PAC-TRI-001` + Work IQ `TEAMS_THREAD/.../triage-support`. **"Three different L5 sources contributed to ONE decision."**
5. Step 4 (assignment-routing) — adjuster picked + rationale.

### Step 2 — Run Damage with HITL (~90 seconds)
1. Click **Damage with HITL** on a fresh claim. Watch the steps stream.
2. Step 2 (damage-categorization) categorizes the damage; the LLM detects total-loss-suspect from the narrative; status flips to `needs-human-review`. Orchestrator pauses.
3. Point at the Approve/Escalate buttons. "This is the gate the package declared in its JSON. Trigger expression `step.damage_categorization.totalLossSuspect == true` matched the agent output. Real HITL — the orchestrator is paused on a Durable Function `WaitForExternalEvent` waiting for the operator to resolve."
4. Click **Approve**. Watch the remaining steps stream.

### Step 3 — Run Fraud (~45 seconds)
1. Click **Run Fraud** on a fresh claim.
2. Step 2 (fraud-pattern-scan) cites THREE Fabric primitives at once: `SIMILAR_CLAIMS` + `HOUR_OF_DAY/...` + `INCIDENT_MIX/...`. "This is real aggregation against the Lakehouse — not synthetic, not mocked. The agent reasons across them and writes a composite fraud score."
3. Run completes in the clear band → no SIU referral.

### Step 4 — Run Settlement (~45 seconds)
1. Click **Run Settlement**.
2. Step 3 (settlement-disclosure) — narrate: "The agent reads the policyholder's state from `dim_policyholder`, picks the California-specific template per PAC-SET-002, computes the 30-day delivery window from CA Fair Claims Settlement Practices Regulations."
3. Step 4 (settlement-disbursement) — ACH direct deposit, no lienholder, full L5 federation again (Fabric + WorkIQ + Foundry).

## Act 4 — The agnostic story (60 seconds)

Click **Run Banking**.

> "Different industry. Same platform. Banking package authored under `usecases/banking-loan-origination/`. Two agents, two knowledge docs, its own MCP tools (`borrower-profile`, `credit-bureau-lookup`), its own Fabric tables (`dim_borrower`, `fact_loan_applications`)."

Watch the eligibility agent run. Point at the trace.

> "Cites `BANK-001` and `BANK-002` — only banking docs. No cross-industry Meridian bleed; the AI Search index filters by `industry='banking'`. Cites `ENTITY_HISTORY/BOR-...` — that's the templated Fabric query reading the package's declared schema."

Open the `/docs` ADR section, point at ADR-0001 v0.6 + ADR-0016.

> "The platform boundary is mechanical: 8 platform projects, zero Meridian intent names, zero banking intent names. Adding a third use case (healthcare? public sector?) is `mkdir usecases/<x>/`. The boundary check script enforces it."

## Act 5 — Honesty + close (45 seconds)

Open `/docs` ADR list.

> "Sixteen ADRs documenting every architectural decision. Three of those — 0013, 0015, 0016 — were added today. Each says what's implemented, what's deferred, and why. The honest gaps live there: real Foundry Agent Service activation is one Azure role assignment away; Microsoft Graph Work IQ is code-complete but needs a seeded tenant; Power BI semantic model with named DAX measures is a v1.5 enhancement on top of today's Fabric Lakehouse aggregation primitives."

> "What's NOT honest: synthetic data is synthetic. We don't have a real Meridian tenant. The architecture is real; the data is illustrative."

Click around the docs portal once more for visual closure.

> "From here, the natural next moves are: (1) Foundry RBAC granted → instantly activates real Foundry Agent Service with Entra Agent IDs per agent; (2) the v1.5 Fabric semantic model with measures; (3) Microsoft co-build conversation about Foundry IQ knowledge tier."

> "Q&A?"

---

## Backup talking points if asked

- **"Why .NET on Functions instead of Python?"** — Durable Functions for HITL pause/resume is mature on .NET; Azure SDK surface is .NET-first for Cosmos/Fabric SQL endpoint; Microsoft Practice has strong .NET expertise. The architecture is language-agnostic at the contract layer (agent-package JSON Schema).
- **"What about Defender for AI / Sentinel?"** — ADR-0008 + ADR-0013 list this as v1.1 hardening. Foundry Agent Service unlocks Entra Agent ID propagation through traces; that's the precondition for Defender for AI correlation.
- **"How does this compare to ICA?"** — ICA is the inspiration; the shape (platform/usecase split, package contract, decision journal, HITL gates) is borrowed. ADP is Microsoft-native, single-industry-deep, end-customer-facing, vs. ICA's IBM-cloud-anchored, multi-domain-broad, consulting-team-facing.
- **"What if the demo claim doesn't trip the HITL gate?"** — Use the **Damage with HITL** button (forces low confidence at categorize) or pick claim ID `CLM-2026-10016` (categorical total-loss-suspect per its severityHint).
