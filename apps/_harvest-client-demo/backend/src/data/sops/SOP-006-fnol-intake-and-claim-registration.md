---
id: SOP-006
title: FNOL Intake & Claim Registration
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Governance Office
category: intake
appliesTo: FNOL intake agents, web/mobile intake assistants, and claims adjusters
summary: >
  Governs First Notice of Loss (FNOL) capture and claim registration. A claim
  may only be registered once all intake gates pass — vehicle, date, coverage,
  injury, third party, evidence offer, consent, and summary confirmation — and
  the policy is validated. Low-confidence or unverifiable intake escalates to a
  human before a claim ID is issued.
---

# SOP-006 — FNOL Intake & Claim Registration

## 1. Purpose
This procedure standardises how a First Notice of Loss (FNOL) is captured,
validated, and converted into a registered claim. It ensures every claim enters
the portfolio with a verified policy link, a complete set of confirmed facts, and
a documented consent trail, so downstream governance and settlement decisions rest
on sound intake data.

It aligns with Chubb's claims-handling principles: fair, prompt, and transparent
resolution, beginning at the very first contact with the claimant.

## 2. Scope
Applies to all intake channels — conversational FNOL, web intake, and mobile
intake — and to the AI intake assistants that operate them. It covers the point
from initial claimant contact up to issuance of a claim ID and hand-off into the
`intake` claim stage.

## 3. Intake Gates — All Must Pass Before Submission
A claim must not be submitted until every intake gate is satisfied. The gates are:

| Gate | Meaning | Required |
|---|---|---|
| Vehicle confirmed | Asset verified against the policy | Always |
| Date confirmed | Incident date established and agreed | Always |
| Coverage explained | Coverage scope reviewed with the claimant | Always |
| Injury assessed | Injury status determined (yes/no + detail) | Always |
| Third party recorded | Third-party details captured | If a third party is involved |
| Evidence offered | Claimant given the opportunity to upload evidence | Always |
| Consent given | Data-processing and special-category consents granted | Always |
| Summary confirmed | Claimant has reviewed and agreed the claim summary | Always |

A gate may only be intentionally skipped (e.g. third party not applicable) with an
explicit reason recorded. Skipped-but-required gates block submission.

## 4. Policy Validation
Before a claim ID is issued the intake agent MUST confirm that:

1. The quoted policy reference matches a valid policy record.
2. The policy is active / in-force (not expired or cancelled).
3. The coverage type matches the incident type (e.g. a motor policy for a motor
   loss).

If policy validation fails, the intake is **escalated to a human agent** and no
claim ID is issued until the discrepancy is resolved.

## 5. Confidence & Human Review at Intake
Intake assistants operate under a confidence control:

- **Below 0.70 confidence** — the assistant must seek clarification or route the
  intake for human review; it must not silently proceed.
- **0.70–0.85 confidence** — proceed with caution; human review is required where
  the uncertainty affects claim completion or routing.
- **Above 0.85 confidence** — the assistant may proceed.

Confidence never overrides the gates in §3 or the policy validation in §4.

## 6. Claim Registration
On successful submission the system issues a claim ID in the format
`CLM-{YYYY}-{TYPE}-{SEQUENCE}` (e.g. `CLM-2026-AUTO-103`), where `TYPE` reflects
the incident type (e.g. AUTO, PROP, MED). The claim enters the `intake` stage and
the handling mode is set from the client service tier (see SOP-009). All captured
facts, the consent record, and any offered evidence are attached to the file.

## 7. Resilience & Idempotency
FNOL sessions persist locally and queue operations when offline. Each queued
operation carries an idempotency key so that reconnection and replay never create
duplicate claims or duplicate side effects. Adjusters and agents must rely on the
idempotency key rather than re-submitting an intake.

## 8. Audit & Records
Every intake records the confirmed gates, the policy-validation result, the
consent artefacts, the confidence score and rationale, and any escalation. This
forms the first entries in the claim's audit trail (see SOP-012).

## 9. Related SOPs
- SOP-007 — Evidence Management & Missing-Evidence Handling
- SOP-004 — Coverage Dispute & Legal Referral
- SOP-005 — Injury & Medical Review
- SOP-009 — Queue Prioritisation, SLA & Service-Tier Handling
- SOP-015 — Claimant Communication & Notifications
