---
id: SOP-009
title: Queue Prioritisation, SLA & Service-Tier Handling
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Operations
category: queue
appliesTo: Claims adjusters, team leads, and the Digital Steward
summary: >
  Governs how the decision queue is prioritised, how service-level targets are set
  by complexity, and how the client service tier determines whether a claim is
  handled by AI, AI with oversight, or a human adjuster. Ensures urgent and
  high-value work is actioned first and SLA breaches are prevented.
---

# SOP-009 — Queue Prioritisation, SLA & Service-Tier Handling

## 1. Purpose
This procedure standardises how work is prioritised in the decision queue, how
service-level agreement (SLA) targets are derived, and how the client service tier
governs the handling mode. It ensures the most urgent, highest-exposure, and
lowest-confidence claims are surfaced first and resolved within target times.

## 2. Priority Levels
Each claim carries a priority: **urgent**, **high**, **normal**, or **low**.
Indicative assignment:

- **Urgent** — suspected fraud held at investigation/evaluation; imminent SLA
  breach.
- **High** — injury/medico-legal claims; high-value claims.
- **Normal** — standard claims proceeding through the lifecycle.
- **Low** — low-complexity fast-track (e.g. glass, minor backing) and closed
  claims.

## 3. Queue Ordering
The default decision-queue order is:

1. **Priority** (urgent → high → normal → low)
2. **Stage** (evaluation → investigation → intake; closed/settlement de-prioritised)
3. **Complexity** (high → medium → low)
4. **Time in queue** (oldest first)
5. **Confidence** (low → medium → high — low-confidence decisions reviewed sooner)

The "variety rule" applies when the Digital Steward recommends a next-actions list:
at most one fraud/SIU case in the top three, so the adjuster is not presented with
an unworkable block of investigations (see SOP-013).

## 4. SLA Targets by Complexity
Time-to-action targets are set by claim complexity:

| Complexity | SLA target |
|---|---|
| Low | 24 hours |
| Medium | 72 hours |
| High | 168 hours (7 days) |

SLA remaining is tracked as target hours minus time in queue. As a claim
approaches its SLA target it is escalated in the ordering and, if a breach is
imminent and the owner is unavailable, reassigned under SOP-008.

## 5. Service Tier → Handling Mode
The client service tier determines how a claim is handled after intake:

| Service tier | Handling mode |
|---|---|
| Signature / white-glove | Human adjuster (full human handling) |
| Priority | AI with human oversight |
| Standard | AI handling within governance |

Top-tier (signature / white-glove) claims bypass fast-track automation regardless
of value and are handled by a human adjuster. Handling mode never overrides
governance controls — an AI-handled claim still stops at every human-in-the-loop
gate defined in SOP-010.

## 6. Queue Age & Ageing
Time in current stage ("queue age") is tracked per claim and displayed to the
adjuster. Ageing claims are surfaced up the queue so nothing is silently left to
breach. Persistent ageing at a stage should prompt a request-info (SOP-007), a
reassignment (SOP-008), or an escalation (SOP-001) as appropriate.

## 7. Digital Steward Guidance
When asked "what should I work next?" or "why this claim and not that one?", the
Digital Steward applies this ordering plus its comparative ranking rules
(service tier, AI confidence, queue age, exposure) and must cite the specific
signal that breaks the tie. It is advisory (see SOP-013).

## 8. Related SOPs
- SOP-008 — Adjuster Availability, Leave & Reassignment
- SOP-010 — Decision Governance, HITL Approval & Straight-Through Processing
- SOP-013 — Digital Steward Advisory Use & Boundaries
- SOP-015 — Claimant Communication & Notifications
