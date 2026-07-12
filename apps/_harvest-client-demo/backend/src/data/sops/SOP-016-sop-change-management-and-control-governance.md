---
id: SOP-016
title: SOP Change Management & Control Governance
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Governance Office
category: governance
appliesTo: SOP owners, the Claims Governance Office, and the Digital Steward platform
summary: >
  Governs how the SOPs themselves — which act as agent controls — are authored,
  versioned, changed, reviewed, and re-indexed. When an SOP changes it is detected
  by checksum, re-indexed into the retrieval store, recorded, and (for material
  control changes) reviewed before it takes effect, so the agents' governance stays
  current and auditable.
---

# SOP-016 — SOP Change Management & Control Governance

## 1. Purpose
The SOPs in this set are not just documentation — they are **agent controls** that
shape how the Digital Steward and the digital workforce behave. This procedure
governs how those controls are changed safely: how an SOP is versioned, how a
change is detected and propagated to the agents, and how material changes are
reviewed before they take effect.

## 2. SOP Structure Standard
Every SOP must have:

- **Front-matter** — `id`, `title`, `version` (semantic, e.g. 1.2.0),
  `effectiveDate`, `owner`, `category`, `appliesTo`, and a `summary`.
- **Sectioned body** — `##` headings, each a self-contained control point, so the
  document can be chunked and retrieved section-by-section.

The `id` is stable for the life of the control; the `version` increments on every
change.

## 3. Versioning Rules
- **Patch** (x.y.**z**) — clarifications and wording that do not change a control's
  meaning.
- **Minor** (x.**y**.0) — a new control point or an additive change.
- **Major** (**x**.0.0) — a change that alters, loosens, or removes an existing
  control (e.g. changing an authority limit, a confidence threshold, or an
  escalation rule).

Every change updates `version` and, where the control takes effect on a date,
`effectiveDate`.

## 4. Change Detection & Propagation
The platform tracks each SOP's integrity with a **SHA-256 checksum** recorded in a
manifest. On each synchronisation run the current file checksum is compared with
the manifest to classify every SOP as **unchanged**, **added**, **changed**, or
**removed**. For each added or changed SOP the platform:

1. Re-parses the document and re-chunks it by section.
2. Re-embeds and re-indexes the chunks into the SOP retrieval index.
3. Updates the manifest (new checksum, version, chunk count, timestamp).

A removed SOP is de-indexed and its removal recorded. The run returns a change
report (counts plus per-SOP status) for the audit record. This keeps the controls
the agents actually retrieve in lock-step with the source documents.

## 5. Deterministic Control Block
Beyond retrieval, the most safety-critical rules (escalation matrix, delegated
authority limits, direct SIU/Legal/Medical referral) are also injected into the
agent as a **deterministic control block** on every interaction, so they apply even
if retrieval returns nothing. Any change to these rules is therefore a **major**
change under §3 and must be reflected in the control block, not only in the
retrievable text.

## 6. Review & Approval of Changes
- **Patch** changes may be made by the SOP owner and take effect on sync.
- **Minor** changes are reviewed by the SOP owner and the Claims Governance Office.
- **Major** changes — anything that alters, loosens, or removes a control — require
  Claims Governance Office sign-off **before** the change is synced live, and must
  record who approved it and why. Where an agent's governance profile depends on the
  control (SOP-014), that agent is re-validated in the simulator before the change
  takes effect.

## 7. Effect on Agents
When a control changes and is synced, the change applies to all agents that consume
that control from the next interaction. Adjusters and reviewers should be made aware
of material control changes (e.g. a revised authority limit or escalation trigger)
so downstream behaviour is understood.

## 8. Audit & Records
Every sync run, checksum change, version bump, and approval is recorded, giving a
complete history of how the controls evolved and when each version was in force.
This history is retained under the applicable class in SOP-012.

## 9. Related SOPs
- SOP-002 — Delegated Settlement Authority
- SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing
- SOP-012 — Audit Trail, Record Integrity & Retention
- SOP-014 — Agent Lifecycle & Governance Controls
