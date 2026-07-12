---
id: SOP-007
title: Evidence Management & Missing-Evidence Handling
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Governance Office
category: evidence
appliesTo: All claims adjusters, evidence-review agents, and the Digital Steward
summary: >
  Governs how claim evidence is captured, categorised, verified, and completed.
  Defines the required evidence per claim type, the verification standard, and the
  "request more information" procedure when evidence is missing or unverified. A
  claim with unverified or missing required evidence cannot be auto-approved.
---

# SOP-007 — Evidence Management & Missing-Evidence Handling

## 1. Purpose
This procedure standardises how evidence is collected, catalogued, and verified,
and how an adjuster handles missing or incomplete evidence. Reliable evidence is
the foundation of a defensible claim decision; this SOP ensures gaps are surfaced,
requested, and tracked rather than assumed away.

## 2. Evidence Types & Categories
Each evidence item carries a **type** and a **category**:

- **Types:** photo, document, police reference, dashcam (video).
- **Categories:** own vehicle, third party, scene, medical record, witness
  statement, police report, other.

Every uploaded item must record its type, category, and original filename.

## 3. Intake Validation
Uploads are validated at capture:

- **Accepted formats:** images (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`),
  documents (`.pdf`, `.doc`, `.docx`, `.txt`), video (`.mp4`, `.mov`, `.avi`).
- **Size limits:** 50 MB per file; 500 MB total per claim.

Items failing validation are rejected at upload and must not be attached to the
file.

## 4. Verification Standard
Each evidence item has a verification status. An item is only **verified** once its
provenance and integrity have been confirmed (e.g. metadata consistent, source
identified, no signs of tampering). Until then it is treated as unverified and
carries reduced weight in any decision.

**Control:** if *any* required evidence item is not `verified`, the claim is **not
eligible for straight-through / auto-approval** and must receive human review
(see SOP-010). Unverified evidence also reduces the claim's resolution-readiness
score and may lower AI confidence.

## 5. Required Evidence by Claim Profile
As a minimum standard, the following are expected before a settlement decision:

| Claim profile | Minimum evidence |
|---|---|
| Motor damage (own vehicle) | Own-vehicle photos; repair estimate/quote |
| Third-party involvement | Third-party details; scene photos; police reference where applicable |
| Injury indicated | Medical record(s) and, where relevant, medico-legal report (see SOP-005) |
| Suspected fraud / staged loss | Preserve all items; do not close gaps by assumption — refer to SIU (see SOP-003) |
| Glass-only / total-loss-obvious | Damage photos sufficient to confirm the loss profile |

Absence of a minimum item is a **missing-evidence** condition and must be handled
under §6.

## 6. Missing or Incomplete Evidence — Request-Info Procedure
When required evidence is missing or unverified, the adjuster (or Digital Steward,
advisorily) must:

1. Identify precisely which item(s) are missing or unverified and why they are
   required for this claim.
2. Raise a **"more information needed"** decision (`request-info`) rather than
   approving or denying on incomplete evidence.
3. Issue an evidence request to the claimant via their preferred channel
   (see SOP-015), stating exactly what is needed and the deadline.
4. Hold the claim at its current stage; do not advance to settlement.
5. Record the request, the items sought, and the due date on the claim file.

A claim must **never** be approved to close an evidence gap by assumption, and must
never be denied solely because the claimant has not yet been given a fair
opportunity to supply the missing item.

## 7. Evidence in Fraud-Flagged Claims
Where anomaly signals or SIU review are in play, evidence must be **preserved
exactly as received** and not edited, re-categorised to obscure a concern, or
discarded. Chain-of-handling is recorded. See SOP-003 and SOP-011.

## 8. Digital Steward Guidance
When advising, the Digital Steward must state which evidence is missing or
unverified, recommend a `request-info` action where appropriate, and never imply a
claim is decision-ready when a required item is absent or unverified. It remains
advisory (see SOP-013).

## 9. Audit & Records
Every evidence item, its verification status, each request-info action, and the
claimant's response are logged on the claim's audit trail (see SOP-012).

## 10. Related SOPs
- SOP-006 — FNOL Intake & Claim Registration
- SOP-003 — SIU / Fraud Referral Procedure
- SOP-005 — Injury & Medical Review
- SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing
- SOP-011 — Anomaly Signals & Duplicate-Claim Handling
- SOP-015 — Claimant Communication & Notifications
