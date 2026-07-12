---
id: SOP-010
title: Decision Governance, HITL Approval & Straight-Through Processing
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Governance Office
category: governance
appliesTo: All claims adjusters, approvers, the governance engine, and the Digital Steward
summary: >
  Defines how every claim decision is governed: the four decision outcomes, the
  three governance verdicts, the human-in-the-loop (HITL) approval gates, the
  narrow conditions for straight-through processing (STP), and the hard blocks
  that can never be auto-approved. No adverse or complex decision is ever made
  autonomously.
---

# SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing

## 1. Purpose
This procedure standardises how claim decisions are evaluated and authorised. It
guarantees that decisions are made within delegated authority, that automation is
confined to genuinely low-risk cases, and that every adverse, ambiguous, injury,
or fraud decision is reviewed by a suitably authorised human.

## 2. Decision Outcomes
Every decision resolves to one of four outcomes:

- **Approved** — the decision proceeds (settlement, payment, coverage position).
- **Rejected** — the decision is declined (recorded for human review before any
  denial is communicated).
- **Escalated** — routed to a more senior adjuster or specialist.
- **More information needed** — held pending additional evidence (see SOP-007).

## 3. Governance Verdicts
The governance engine evaluates each proposed decision and returns one verdict:

- **Within authority** — all criteria pass; the adjuster may proceed.
- **Requires senior approval** — a human-in-the-loop gate applies; a suitably
  authorised approver must sign off.
- **Blocked** — the decision cannot be made as proposed and must be reworked,
  denied for human review, or escalated.

Each verdict records the criteria evaluated (authority, confidence, coverage,
injury, anomalies, decision-type routing), plain-language reasons, and is written
to the tamper-evident audit trail (see SOP-012).

## 4. Criteria That Force Senior Approval (HITL Gate)
A human-in-the-loop approval is required when **any** of the following hold:

1. Settlement amount exceeds the adjuster's delegated authority limit (SOP-002).
2. AI confidence is below 0.70 (low confidence).
3. Coverage applicability is **ambiguous** (SOP-004).
4. Injury is indicated (SOP-005) — always human-reviewed regardless of amount.
5. One or more high-severity anomaly signals are present (SOP-011).
6. The pending decision type is senior-routed: **Settlement Approval**, **Policy
   Interpretation**, **Fraud Investigation**, or **Duplicate Claim Review**.

At the gate, the approver's name and role are captured before the action executes.

## 5. Hard Blocks — Never Auto-Approvable
The following can never be auto-approved and must be reworked, escalated, or denied
for human review:

- Coverage applicability is **excluded** — an approval attempt is hard-blocked.
- Decision type is **Fraud Investigation** with one or more high-severity anomaly
  signals — hard-blocked pending SIU (SOP-003).

## 6. Straight-Through Processing (STP) — Narrow Eligibility
A claim may be auto-finalised **only** when **all** of the following are true:

- The incident profile is inherently low-risk — **glass-only** damage, or
  **total-loss-obvious** (damage clearly exceeds the total-loss threshold).
- The claim is marked straight-through eligible.
- The settlement is within the handling adjuster's authority (SOP-002).
- AI confidence is high.
- There are no active blockers, no anomalies, and coverage is **covered**.
- All required evidence is **verified** (SOP-007).

Anything involving injury, liability, coverage ambiguity, fraud, or an unverified
evidence item is **excluded from STP** and requires a human decision even if it is
otherwise within delegated authority. No autonomous adverse determination is ever
permitted — denials always route to a human.

## 7. Decision Categorisation
For routing and telemetry, each governed decision maps to a canonical category:
**approve**, **route-to-adjuster**, **request-info**, or
**recommend-deny-for-human-review**. A "rejected" outcome or a "blocked" verdict
maps to *recommend-deny-for-human-review* — never to an automatic denial.

## 8. Digital Steward Guidance
The Digital Steward is advisory only (see SOP-013). It may explain the governance
verdict, name the gate that applies, and recommend the correct next action, but it
does not approve, deny, or authorise settlements. Only authorised personnel make
the decision.

## 9. Audit & Records
Every governed decision persists a governance record with verdict, criteria,
reasons, approver (where applicable), and a hash-chained link to the prior record
on the claim (see SOP-012).

## 10. Related SOPs
- SOP-002 — Delegated Settlement Authority
- SOP-004 — Coverage Dispute & Legal Referral
- SOP-005 — Injury & Medical Review
- SOP-007 — Evidence Management & Missing-Evidence Handling
- SOP-011 — Anomaly Signals & Duplicate-Claim Handling
- SOP-012 — Audit Trail, Record Integrity & Retention
