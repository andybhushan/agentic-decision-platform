---
id: SOP-012
title: Audit Trail, Record Integrity & Retention
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Governance Office
category: audit
appliesTo: All claims adjusters, agents, and the compliance function
summary: >
  Governs the immutable audit trail, the tamper-evident hash chain on governance
  decisions, the governance audit-event catalogue, and record-retention classes.
  Every claim action is logged and traceable; governance records cannot be
  retroactively altered without detection.
---

# SOP-012 — Audit Trail, Record Integrity & Retention

## 1. Purpose
This procedure defines how claim actions are recorded, how the integrity of
governance decisions is protected, and how long records are retained. It provides
a defensible, regulator-ready evidence trail for every claim and every decision.

## 2. Claim Audit Trail
Every material action on a claim is logged as an audit entry capturing: timestamp,
actor (user or agent), action, rationale, and outcome. Logged actions include (non
-exhaustively): intake and registration, evidence upload and verification, fraud
scoring, coverage and policy review, governance evaluation, adjuster decisions
(approve / reject / escalate / request-info), escalations and referrals, and
settlement execution. Agent-performed actions are attributed to the agent.

Audit entries are **append-only**: the timestamp and actor of a recorded action are
not modified after the fact; corrections are made by adding a new entry, not
editing an old one.

## 3. Tamper-Evident Governance Records
Each governance decision persists a record that is chained for integrity:

- **recordHash** — a SHA-256 hash over the canonical decision record combined with
  the previous record's hash.
- **previousHash** — the hash of the prior governance record on the same claim.

This forms a hash chain: altering any historical governance record would break the
chain and be detectable on replay. The chain exists to prevent retroactive
modification of decisions and to support compliance audit.

## 4. Governance Audit-Event Catalogue
System-level governance events are logged with a severity (critical, high, medium):

| Event | Meaning |
|---|---|
| policy_violation | A governance rule was breached |
| governance_override | A human overrode an automated decision |
| human_escalation | A claim was escalated to a human |
| runtime_error | An agent execution failed |
| tool_failure | An API / downstream service failed |

These feed the governance dashboard and compliance sampling. A `governance_override`
must always carry a rationale.

## 5. Retention Classes
Governance decisions are assigned a retention class based on their nature:

| Retention class | Applies to |
|---|---|
| regulatory-hold-10y | Blocked decisions |
| financial-decision-7y | Approved settlements |
| standard-3y | All other decisions |

Records must be retained for at least the period of their class and must remain
retrievable and integrity-verifiable for the full period.

## 6. Compliance Surfaces
Continuous compliance controls operate alongside claim handling: telemetry
(throughput, escalation rate), anomaly detection over decision patterns, random
case sampling, and regulator-ready evidence packs per claim. Evidence packs draw
directly on the audit trail and governance chain defined here.

## 7. Digital Steward & Advisory Records
The Digital Steward's recommendations are advisory and are recorded alongside the
adjuster's action, so the reasoning presented and the decision taken are both
auditable. The Steward never edits or deletes audit records.

## 8. Related SOPs
- SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing
- SOP-011 — Anomaly Signals & Duplicate-Claim Handling
- SOP-013 — Digital Steward Advisory Use & Boundaries
- SOP-014 — Agent Lifecycle & Governance Controls
