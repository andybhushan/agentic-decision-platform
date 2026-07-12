---
id: SOP-011
title: Anomaly Signals & Duplicate-Claim Handling
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Governance Office
category: anomaly
appliesTo: All claims adjusters, the fraud/SIU function, and the Digital Steward
summary: >
  Governs how anomaly signals are triaged and how duplicate/related claims are
  detected and resolved. High-severity anomalies block auto-approval and, where
  fraud is indicated, trigger a direct SIU referral. Duplicate claims must be
  resolved before settlement, never silently settled in parallel.
---

# SOP-011 — Anomaly Signals & Duplicate-Claim Handling

## 1. Purpose
This procedure standardises how the anomaly signals surfaced on a claim are
assessed and actioned, and how duplicate or related claims are detected and
resolved. It ensures risk indicators are never ignored and that related exposures
are handled coherently rather than settled independently.

## 2. Anomaly Signals
Claims may carry one or more anomaly signals, each with a type and a **severity**
(high, medium, low). Signals are indicators, not verdicts — they direct attention
and constrain automation:

- **High-severity signal present** — the claim is **not** auto-approvable and must
  receive human review (see SOP-010).
- **Fraud / staged-loss indicators** — trigger a **direct SIU referral**
  (see SOP-003); the SIU referral is not gated by supervisor sign-off.
- **Medium / low signals** — logged and weighed in the decision; they lower the
  resolution-readiness score and may reduce AI confidence.

The adjuster must address each active signal explicitly in the decision rationale,
rather than approving over an unexplained signal.

## 3. Duplicate & Related Claims
A duplicate/related-claim condition is flagged when indicators such as the
following coincide:

- The same claimant with a similar incident date (typically within ~90 days).
- Matching loss description or keywords.
- Matching vehicle or property details.

A duplicate flag is treated as a **high-severity** anomaly: it blocks auto-approval
and raises a **Duplicate Claim Review** decision type, which is senior-routed.

## 4. Resolving a Duplicate / Related Claim
Before any settlement proceeds on a flagged claim, the adjuster must resolve the
relationship by one of:

1. **Close one** — if the claims are the same loss, retain the correct claim and
   close the duplicate with a documented reason.
2. **Consolidate** — merge related exposures into a single coherent handling and
   settlement position.
3. **Justify separate handling** — if genuinely distinct losses, document why they
   are handled and settled separately, with links between the related records.

Parallel claims for the same loss must never both settle. The chosen resolution is
recorded on the file.

## 5. Interaction With Fraud Handling
Duplicate or inconsistent-narrative patterns are common fraud indicators. Where a
duplicate flag coincides with other staged-loss indicators, the adjuster refers to
SIU under SOP-003 and preserves all evidence under SOP-007 while the review is open.

## 6. Digital Steward Guidance
When advising on a claim carrying anomaly or duplicate signals, the Digital Steward
must name the signals, state that a high-severity signal blocks auto-approval,
recommend the correct action (SIU referral, Duplicate Claim Review, or request-info),
and cite the specific signals from the claim data. It remains advisory (see
SOP-013).

## 7. Audit & Records
Each anomaly assessment, duplicate resolution, and related-claim link is recorded
on the claim's audit trail (see SOP-012), including which signals were present and
how each was addressed.

## 8. Related SOPs
- SOP-003 — SIU / Fraud Referral Procedure
- SOP-007 — Evidence Management & Missing-Evidence Handling
- SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing
- SOP-012 — Audit Trail, Record Integrity & Retention
