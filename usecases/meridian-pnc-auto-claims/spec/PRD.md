# PRD — UC4: Agentic Claims Processing (P&C Personal Auto)

**Status:** draft (own-track, spec-driven) · **Owner:** Anand Bhushan · **Date:** 2026-06-19
**Product:** Agentic Decision Platform (ADP) · use case `meridian-pnc-auto-claims`
**Positioning:** a DT live-demo use case (UC4). A **superset, carrier-agnostic** reference implementation of end-to-end auto-claims processing on a governed agentic data foundation — built so any P&C carrier (Chubb, Progressive, GEICO, Travelers…) instantly relates and can pursue a deal. Doubles as a disaster-recovery showcase if other timelines slip.
**Evidence base:** `RESEARCH-NOTES.md` (figures indicative, verification pending).

---

## 1. Thesis
Insurers lose **7–14% of claims spend to leakage** and carry long cycle times and heavy LAE, while regulators (NAIC AI bulletin, state DOI fair-claims rules) demand explainable, auditable, human-supervised decisions. ADP shows how an **agentic claims operation on a governed data + semantic foundation** compresses cycle time and leakage **while staying compliant** — agents do the work, humans stay in the loop where it legally matters, every decision is journaled and explainable.

## 2. Customer brief — *Meridian Mutual* (fictitious carrier)
- **Profile:** mid-size US P&C carrier, ~$3B personal-auto DWP, multi-state (CA-led), ~1,500 adjusters.
- **Stakeholders:** **Maya** (claimant), **Derek** (auto adjuster — adoption gatekeeper), **Patricia** (Claims COO — economic buyer), **Renee** (compliance / ex-DOI examiner — veto), **Sam** (SIU lead).
- **AS-IS systems / stack:** Guidewire ClaimCenter (claims admin), Duck Creek (policy), CCC/Mitchell (estimatics), a payments hub, a legacy fraud rules engine, telematics partner feed, email/portal/IVR intake. Data siloed across these; no shared semantic layer; decisions live in adjusters' heads and free-text notes.
- **Pain points:** leakage from inconsistent coverage/estimate decisions; slow cycle time (rental/litigation cost accrues daily); ~half of subrogation lost to incomplete documentation; NIGO/rework on FNOL; no auditable decision trail for the DOI; adjusters buried in low-complexity claims.
- **Why not solved already:** point AI tools bolt onto silos without a shared ontology or an immutable decision record, so they can't be trusted for decisioning or proven to a regulator.
- **Solution (ADP):** agentic claims pipeline on a Fabric data foundation + domain ontology + data agents, with HITL gates on binding decisions and an immutable, explainable decision journal.
- **Outcome:** faster, more consistent, fully auditable claims; adjusters reallocated to complex/high-value work.
- **Hero moment:** a total-loss claim flows FNOL → estimate, the **total-loss gate trips**, a human approves with full context + citations in one screen, and the **decision journal shows the regulator-ready trail** — live, on synthetic data, reskinnable to the carrier's brand in minutes.

## 3. The standard claims lifecycle (the superset reference)
| # | Stage | Purpose | HITL |
|---|---|---|---|
| 1 | **FNOL / intake** | capture loss (voice/web/app/IVL), extract structured FNOL, dedupe | soft |
| 2 | **Triage & segmentation** | simple/moderate/complex routing, STP eligibility, injury/fraud signal | soft |
| 3 | **Coverage verification** | policy in-force, applicable coverages, limits, deductibles, exclusions | **hard on denial** |
| 4 | **Assignment / routing** | match to queue/adjuster by complexity + licensing | soft |
| 5 | **Investigation** | gather evidence (photos, telematics, police report, statements) | soft |
| 6 | **Damage appraisal / estimation** | line-item estimate, ACV, **total-loss evaluation** | **hard at total-loss** |
| 7 | **Fraud detection / SIU** | risk score, indicators, SIU referral | **hard on high-risk** |
| 8 | **Reserves** | set/adjust reserves by exposure | soft/audit |
| 9 | **Negotiation & settlement** | offer, dispute handling, agreement | **hard above authority** |
| 10 | **Payment / indemnity** | issue indemnity, deductible handling | audit |
| 11 | **Subrogation & recovery** | identify + document recovery, track | soft |
| 12 | **Closure** | final docs, claimant comms, compliance pack | audit |
| 13 | **Reporting / analytics** | KPIs, leakage, RAI/fairness, decision audit | — |

## 4. MVP scope (superset coverage, pragmatic build)
**Build fully (the spine that wins trust):** 1 FNOL, 2 Triage, 3 Coverage, 6 Estimation + total-loss, 7 Fraud score, 9 Settlement (offer), 12 Closure, 13 Reporting/decision-journal. **HITL gates G-coverage-denial, G-total-loss, G-fraud, G-settlement-authority** are architectural (code-enforced), not scripted.
**Simulate / stub (credible but not the demo's point):** 4 assignment, 5 investigation evidence (use synthetic multimodal evidence + consent we already built), 8 reserves, 10 payment, 11 subrogation — present with realistic data + a "this would integrate with ClaimCenter/CCC" seam.
**Foundation (already live capability, migrated in):** event-driven data foundation + immutable decision journal; Fabric domain **ontology (23 entities incl. multimodal evidence/consent)**; **data agents** over the gold data product; explainability records; synthetic generator.

## 5. Runtime agents + HITL (product architecture — deliberately minimal)
- **Agents:** Intake, Triage, Coverage, Estimation, Fraud, Settlement, Comms — orchestrated by a deterministic state machine (the ADP package compiler / orchestration). Decisioning agents use the LLM + tools; the ontology/data-agent **grounds** them (it does not decide).
- **HITL gates (hard, code-enforced):** coverage denial, total-loss, high-risk fraud, settlement above adjuster authority. Each gate emits a journaled event, shows the human full context + citations, and blocks STP until resolved. (Compliance bar, not over-engineering.)

## 6. Acceptance criteria
- [ ] A synthetic auto claim flows end-to-end FNOL→closure on ADP, emitting a complete, immutable **decision journal** (GROUNDED/DERIVED tagged).
- [ ] The **total-loss gate** trips architecturally on the anchor claim and requires human approval with citations.
- [ ] Coverage **denial** and **high-risk fraud** route to HITL; nothing binding is auto-finalized.
- [ ] Every agent decision produces an **explainability record** (inputs, reasoning, tools, confidence, ontology/rule versions) mapped to NAIC / fair-claims references.
- [ ] The **operator console** renders the queue, a decision detail with confidences, and the HITL approval flow.
- [ ] KPIs (cycle time, STP rate, leakage proxy, override rate, total-loss %) compute from the journal.
- [ ] **Reskin** to a new carrier brand + data is a config change (carrier-agnostic).
- [ ] Runs on the **DT subscription**, on synthetic data, no real PII.

## 7. Hero moments (demo)
1. **The gate that proves trust:** total-loss trips, human approves with full context + citations in one screen.
2. **The regulator's view:** open the decision journal — immutable, explainable, NAIC/fair-claims mapped.
3. **The reskin:** swap `meridian` → any carrier brand + their synthetic data live.
4. **The adjuster's day:** queue shows AI-handled simple claims auto-progressing, humans focused on the complex few.

## 8. KPI / value framing (key figures verified 2026-06-19)
Headline value (verified): **leakage ≈ 7–14% of claims spend** (EY) is the prize; **claims-handling expense down up to ~30%** and **CSAT +10–15 points** from claims digitization (McKinsey, "Claims in the digital age" — note: *not* the "20% CSAT" a blog claimed). Demo KPIs computed from the decision journal: cycle time, STP rate on simple claims, leakage proxy, override rate (trust calibration), total-loss cycle. Frame value as **leakage + cycle-time + auditability** — the three a Claims COO and a compliance lead both care about. Provenance + verification status in `RESEARCH-NOTES.md`.

## 9. Regulatory / compliance bar (must-haves, not nice-to-haves)
- **HITL on binding decisions** (coverage denial, high settlements) — legally required.
- **Immutable, auditable decision journal** + explainability per decision (NAIC AIS Program; controls scaled to consumer harm).
- **Model/data governance**: lineage/provenance, versioned rules + ontology, no real PII (synthetic only), consent modelled as first-class (evidence/consent entities).
- **Fair-claims alignment**: prompt handling, documented rationale, no opaque denials.

## 10. Non-functional
- **Security:** managed identity, no secrets, PII minimization, prompt-injection validation (see `guardrails/security.md`).
- **Deployment:** Azure on the **DT subscription** (`Project-IBMMSOFFERINGSPOC`), own GitHub (offering account), Fabric workspace + event backbone provisioned fresh for ADP (not the IMAGINE infra).
- **Carrier-agnostic:** brand, data, coverages, rules all config-driven per use-case package; a second package (`banking-loan-origination`) proves the platform is domain-general.

## 10a. Platform positioning — ICA 2.0 alignment
ADP is a **Microsoft-native industry asset that aligns to ICA 2.0** (IBM Consulting Advantage) at the pattern level and is **deliverable through it** — not a competitor. ICA 2.0 is multi-cloud and natively integrates **Azure AI Foundry, Azure OpenAI, and BYO MCP servers**, so Microsoft-native is *consistent* with ICA. Mapping (detail in `adr/ADR-set.md` ADR-U7):
- ADP agents/orchestration → ICA **Agentic App Studio / Agentic AI Core**
- ADP Fabric IQ ontology + data agents → ICA **Context Studio** (ADP is deeper: true graph vs Postgres+AGE)
- ADP HITL gates + decision journal + explainability → ICA **Control Tower**
- ADP MCP tools → ICA **Context Forge MCP Gateway**
- ADP use-case packages (claims, loans) → ICA **Advantage Marketplace** templates

**Differentiator (preserved):** ADP is deeply native on the Microsoft Frontier stack (Fabric IQ, Foundry, Agent 365, Entra Agent ID, Purview) where ICA is multi-cloud/bolted-on. **Design constraint:** keep ADP agents/tools exposable as **MCP/A2A** so ICA 2.0 can orchestrate them.

## 11. Out of scope (MVP)
Real carrier-system integration (ClaimCenter/CCC live), commercial/non-auto lines, multi-claim concurrency at scale, third-party/BI litigation workflow depth, production hardening/SLA, real claimant data.

## 12. Open questions
1. Final carrier persona name + brand kit for the reskin demo (Meridian Mutual placeholder).
2. Which 1–2 KPIs to headline for the COO buyer (recommend cycle-time + leakage-proxy).
3. Re-run verified research for the figure set before any external deck.
4. Confirm clean-room: no IMAGINE-confidential design carried into ADP docs (branding already zeroed).
