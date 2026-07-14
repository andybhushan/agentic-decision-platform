# ADP Live Demo Playbook: CTO Audience, 60 Minutes

**Audience:** CTO (technical leadership; judges the architecture through the demo, not the demo itself).
**Duration:** 60 minutes (45 content + 15 buffer/Q&A).
**Live environment:** https://lemon-water-065e3e40f.7.azurestaticapps.net/?key=meridian-adp-2026
**Posture statement (say it, do not wait to be asked):** all data synthetic, all reasoning real GPT-4o, live against Azure right now; no slides, no mocks, no scripted answers.

---

## 1. The thesis (memorize, open with it)

> "This is a decision platform, not a chatbot. Any regulated decision, grounded in the client's own data, gated by confidence, journaled for the regulator. The use case is a package the platform runs, not a product the platform becomes: zero domain code in the engine. I will prove it by running two industries through identical machinery, live."

Three acts, every click serves one:
1. **Feel it as a customer** (member portal, photo evidence, vision).
2. **Watch it decide as an operator** (queue, runtime switch, grounding, human gate).
3. **Govern it as an executive** (outcomes, agent registry, decision record, docs).

---

## 2. Preparation

### The night before

- [ ] Save 2 or 3 REAL car-damage photos on the demo laptop (a real photo makes vision corroborate; the abstract test drawing stays in the system as the backup story: claim CLM-2026-10028, where the AI distrusted a fake-looking image and gated. That is a feature; tell it that way if it comes up).
- [ ] Bookmark tabs in this order: platform home (keyed URL) / member portal / decisions / outcomes / agents / docs / **AI Foundry portal open at project `adp-v1` agents list** (the secret-weapon tab for the runtime flip).
- [ ] One full rehearsal using the in-app guided demo (play button, 10 beats). It is the on-screen script; you narrate over it.
- [ ] Decide the single ask for minute 55 (see section 8) and write it on paper.

### T minus 30 minutes

```bash
# 1. Populate the queue with fresh activity; leaves one claim gated "needs review"
cd apps/console && node scripts/demo-warmup.mjs

# 2. Fabric knows the freshest subjects (universe + runtime intake overlay + SQL metadata refresh)
powershell ../../scripts/sync-intake-to-fabric.ps1
```

Then pre-warm the two slow paths (one throwaway each):
- [ ] Ask the Platform copilot one analytics question ("claims by incident type") so the Fabric Data Agent serving assistant is minted (20-30s once, fast afterwards).
- [ ] Run one claim on the **foundry** runtime from the Lab so the persistent agents are warm.
- [ ] Confirm the Lab health line reads `adp-v1-traces-api ok`.
- [ ] Browser: light theme, 100% zoom, notifications off, one window.

---

## 3. Minute-by-minute

| Time | Where | Do | Land this line |
|---|---|---|---|
| 0-4 | Platform home | Thesis + posture statement; point at the two colored use-case cards | "Claims and lending: same machinery. Everything is live." |
| 4-14 | Member portal | Sign in as a member; file a claim LIVE with a real damage photo; open the new claim's tracker | "Uploading, then *analyzing your photos*: GPT-4o vision reads the damage once, at intake. Here is what our AI saw, in the customer's own view." |
| 14-22 | Decisions | Open the new claim; run Intake & Routing on Agent Framework; hover evidence chips while steps stream | "Ground, reason, act, score, journal. Blue is Foundry IQ documents; cyan is the Fabric Data Agent answering over the client's lakehouse, with relevance scores, journaled." |
| 22-27 | Decisions + Foundry tab | Flip runtime dropdown to Foundry Agent Service; run Damage & Estimation; switch to the Foundry portal tab | "Same signed package, now running as persistent agents Microsoft's own control plane can see. One PromptContract, three adapters; the journal proves the semantics held. The swap is a parameter." |
| 27-32 | Decisions | Toggle Force review gate; run; resolve the gate with a written rationale; then flip to the member tracker | "It knows what it does not know. The judgment is journaled next to the agent steps. And the customer just got their repair estimate. Full circle." |
| 32-38 | Copilot dock | Ask: "Which subjects are waiting for a human judgment right now?" then "How many claims by incident type across the portfolio?"; click one follow-up chip | "Source chips: the journal answered the first, the Fabric Data Agent the second. Members have the same experience scoped to their own records only; ask theirs for a fraud score and it refuses, because that data is never in its context." |
| 38-45 | Outcomes | Flip use-case lens to lending; walk the governance insights row | "Evidence mix by IQ system. The confidence distribution that explains the gate policy: the low tail is exactly what goes to humans. And the trust metric: when gates opened, how often people agreed with the agents." |
| 45-50 | Agents + Record | Show declared vs observed per worker; note the assistants are listed too; print one Decision Record and scroll it slowly | "A governance page that misses an agent surface is not a governance page. This record is what a regulator receives: replayed from an append-only journal, no second source of truth." |
| 50-55 | Docs | Architecture diagram + the 13-view diagram library + migration guide | "The platform documents itself, including a recreate-from-zero migration runbook and a roadmap that says what is still pending tenant approvals." |
| 55 | - | **The ask** (section 8) | - |
| 55-60 | - | Buffer + Q&A; never plan content here | - |

---

## 4. CTO calibration (what makes this land with technical leadership)

1. **Show the seams on purpose.** Use the Lab page if he wants to poke: free-form subject, any package, forced gates, the raw API line visible. A smooth happy path impresses buyers; a machine you are happy to have poked impresses CTOs.
2. **Say the honest sentence before he finds it:** "Demo posture deliberately: synthetic data, open API, cosmetic share gate. Production-shaped where it matters: immutable journal, Entra RBAC on the Foundry data plane, managed identity, signed packages, exit-code-gated deploys."
3. **Volunteer the engineering discipline artifacts:** the migration guide, the ops lessons paid for in deploys, the roadmap with pending admin grants. Admitting what is blocked builds more credibility than any feature.
4. **Numbers in your pocket (answer, do not volunteer):** ~USD 3-5/day idle on serverless SKUs; decision latency p50 ~8s, p90 ~12s on intake; the loan p90 of ~363s is a human thinking at a gate, on purpose; 22 backend image versions shipped; one architect on the Microsoft agentic stack.

---

## 5. The five deliberate wow moments

1. "Analyzing your photos" during live claim submission, then the vision text on the tracker.
2. The runtime flip plus the Foundry portal tab showing the persistent agents.
3. Resolving a human gate and immediately showing the customer's estimate arrived.
4. The copilot citing which tool grounded each answer, with subject ids that deep-link.
5. The Decision Record scroll: citations, gates, judgments, verbatim.

---

## 6. Contingencies

| Symptom | Response |
|---|---|
| Data Agent slow (10-30s) | Pre-warmed; if it still stalls: "that is the Fabric agent reasoning over the lakehouse" and continue; return to the answer after |
| Foundry run slow | It polls; keep narrating over the Foundry portal tab. If it errors: flip back to Agent Framework and rerun; "runtime portability means the fallback is one click", the fallback IS the message |
| Vision gives an odd read | "It reports only what it sees; that honesty is exactly what the fraud screen consumes" |
| Anything hard-fails | CLM-2026-10028 is a fully decided claim with photos, assessment, gate history, and estimate; narrate history instead of live |
| Question you cannot answer | "I will verify and send it with the follow-up notes today"; never improvise architecture claims |

---

## 7. Question bank (predicted, with the crisp answer)

- **"Why build this instead of Copilot Studio?"** Copilot Studio is conversational agents on M365. This is a decision engine with a regulator-grade journal in the client's tenant, positioned to surface INTO M365 Copilot as a declarative agent once licensing lands, not to compete with it.
- **"How is this different from our internal platform (ICA)?"** Same ideas at a different altitude: this is what an ICA-shaped platform looks like built Microsoft-native, client-deployable, in the client's tenant, for the client's regulator. They compose: method and IP authored there, executed here.
- **"Real policy documents, 60 pages of wording?"** Curated operating rules are cited today per step. Full policy-form ingestion is a designed next phase: Document Intelligence, state and form-edition metadata filters, citations to a specific form section, document nodes in the Fabric ontology graph. Deliberately not dumped in raw, because unfiltered wording chunks would degrade retrieval quality.
- **"What would production take?"** Hardening posture (private networking, Key Vault everywhere, Entra on the API) plus real core-system connectors at the existing tool seam. The engine, journal, and governance surfaces do not change. There is a written migration runbook.
- **"Does it scale?"** Read-side is demo-scale (documented); the v1 swap to server-side aggregation is designed. The decision plane itself is Container Apps + Durable Functions and scales horizontally.
- **"What is actually real here?"** Everything except the subject data: real GPT-4o reasoning and vision, real Fabric lakehouse and published Data Agent, real Foundry persistent agents under Entra RBAC, real immutable journal. Synthetic: the people, policies, and amounts, by policy.

---

## 8. The ask (pick ONE before the call)

- Sponsorship to make ADP a formal offering asset in the portfolio, or
- A deep-dive engineering review with his architects (invite scrutiny; it is the platform's strength), or
- Nomination for one first client conversation where a Microsoft-committed insurer or bank needs a governed decision platform.

End on it explicitly: "What I would like from you is X."

## 9. Within 2 hours after the call

- Send the keyed URL, the Docs link, and answers to anything parked.
- Note his questions verbatim; they are the roadmap review for the next build session.
