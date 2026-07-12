---
id: SOP-014
title: Agent Lifecycle & Governance Controls
version: 1.0.0
effectiveDate: 2026-07-01
owner: Digital Workforce Governance
category: agent-governance
appliesTo: Agent administrators, the compliance function, and the digital workforce
summary: >
  Governs the lifecycle of the AI agents in the digital workforce — creation,
  simulation, deployment, monitoring, and retirement — and the governance profile
  (confidence thresholds, review triggers, boundaries) every agent must carry. No
  agent operates on live claims without a governance profile and validated
  behaviour.
---

# SOP-014 — Agent Lifecycle & Governance Controls

## 1. Purpose
This procedure standardises how AI agents are built, validated, deployed, and
governed. It ensures every agent that touches a claim has defined boundaries,
confidence controls, human-review triggers, and an audit trail — so automation is
safe, testable, and reversible.

## 2. The Digital Workforce
The workforce comprises specialised agents, each with a defined role, for example:

- **Intake:** FNOL Assistant, Web Intake Assistant, Mobile Intake Assistant.
- **Coverage & policy:** Policy Verification Agent, Coverage Verification.
- **Fraud:** SIU Fraud Investigator.
- **Settlement:** Settlement Calculation Agent.
- **Supporting functions:** Sentiment Analysis, Knowledge Base, Ticket Routing,
  and (in adjacent verticals) Patient Intake, Diagnosis Support, and Treatment
  Planning agents.

Each agent is catalogued with its role, inputs, outputs, capabilities, and
governance profile.

## 3. Governance Profile (Mandatory)
Every agent must carry a governance profile before it can be deployed. At minimum:

- **Confidence thresholds** — a minimum confidence to act (e.g. 0.70) and a
  review-required band (e.g. 0.70–0.85) above which output proceeds only with human
  review where it affects completion or routing.
- **Boundaries** — what the agent may and may not do (e.g. advisory-only agents may
  not authorise settlements — see SOP-013).
- **Escalation triggers** — the conditions under which the agent must hand off to a
  human or another agent.
- **Human-in-the-loop points** — where the agent must stop for sign-off (aligned to
  SOP-010).

## 4. Lifecycle Stages
1. **Create / define** — author the agent specification, including its governance
   profile.
2. **Simulate / validate** — exercise the agent in isolation in the simulator to
   confirm behaviour, boundary adherence, and confidence handling **before**
   deployment.
3. **Deploy** — release the agent to operate on live work only after validation.
4. **Monitor** — observe telemetry, escalation rate, overrides, and governance
   audit events (SOP-012) in production.
5. **Revoke / retire** — withdraw an agent that misbehaves, breaches its
   boundaries, or is superseded; record the reason.

## 5. Change Control
Any change to an agent's specification or governance profile must be re-validated
in the simulator before redeployment. Material governance changes (e.g. loosening a
confidence threshold or expanding an agent's authority) require sign-off from
Digital Workforce Governance and are recorded.

## 6. Monitoring & Intervention
Production agents are monitored via the governance dashboard. Recurring
`policy_violation`, `runtime_error`, or `tool_failure` events (SOP-012), or an
elevated override/escalation rate, trigger investigation and, if warranted,
revocation under §4. Agents must fail safe — on error or low confidence they
escalate to a human rather than proceed.

## 7. Boundary With Decision Authority
No agent — however confident — makes an autonomous adverse determination or
authorises a settlement outside the governance gates in SOP-010. Agents surface,
recommend, and route; authorised humans decide.

## 8. Audit & Records
Agent creation, validation results, deployment, configuration changes, and
retirement are recorded. Agent actions on claims are attributed to the agent in the
claim audit trail (SOP-012).

## 9. Related SOPs
- SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing
- SOP-012 — Audit Trail, Record Integrity & Retention
- SOP-013 — Digital Steward Advisory Use & Boundaries
- SOP-016 — SOP Change Management & Control Governance
