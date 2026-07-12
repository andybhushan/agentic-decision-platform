---
id: SOP-008
title: Adjuster Availability, Leave & Reassignment
version: 1.0.0
effectiveDate: 2026-07-01
owner: Claims Operations
category: staffing
appliesTo: Claims operations, team leads, adjusters, and the Digital Steward
summary: >
  Governs adjuster availability states, capacity limits, planned and unplanned
  leave, and how claims are reassigned so no claim is left unattended. Claims are
  never routed to an away adjuster, never routed beyond an adjuster's authority
  limit, and are rebalanced when an adjuster reaches capacity or goes on leave.
---

# SOP-008 — Adjuster Availability, Leave & Reassignment

## 1. Purpose
This procedure ensures claims are always owned by an available, appropriately
skilled, and suitably authorised adjuster. It defines availability states,
capacity limits, and the reassignment rules that apply when an adjuster is at
capacity, on planned leave, or unexpectedly unavailable — so no claim stalls and
SLAs (SOP-009) are protected.

## 2. Availability States
Each adjuster carries an availability state:

- **Available** — current workload is below maximum capacity; eligible to receive
  new claims.
- **At capacity** — current workload has reached the adjuster's maximum capacity;
  eligible to *retain* their claims but not to receive new ones.
- **Away** — on planned or unplanned leave; **not eligible** to receive or retain
  active claims. Their in-flight claims must be reassigned (see §5).

Capacity is defined per adjuster (a maximum concurrent open-claim count), sized to
their role and complexity mix (e.g. a high-volume fast-track junior adjuster has a
larger capacity than a principal handling complex major-loss claims). Closed
claims do not count toward workload.

## 3. Routing Rules
When assigning or re-routing a claim, the system and any human router MUST respect:

1. **Availability** — route only to `available` adjusters. Never route a new claim
   to an `away` adjuster; avoid routing to `at-capacity` adjusters.
2. **Skill / specialisation match** — fraud → SIU specialist, injury/medical →
   injury specialist, complex/major-loss → principal, high-volume low-complexity →
   fast-track junior.
3. **Authority match** — the claim's expected settlement/exposure must be within
   the receiving adjuster's delegated authority limit (see SOP-002). A claim must
   not be routed to an adjuster who could not authorise it.
4. **Load balancing** — prefer the eligible adjuster with the most free capacity
   (lowest workload-to-capacity ratio).

## 4. Capacity Management
When an adjuster reaches capacity:

- No further claims are routed to them until workload falls below capacity.
- Existing claims remain with them unless SLA risk (SOP-009) or leave requires
  reassignment.
- If the whole eligible pool is at capacity, the queue escalates to a team lead to
  authorise overflow, temporary capacity increase, or reprioritisation.

## 5. Planned & Unplanned Leave
When an adjuster is set to **away**:

1. Their open claims are identified and flagged for reassignment.
2. Each claim is re-routed under the §3 rules to an available, skill-matched,
   suitably authorised adjuster with capacity.
3. Any claim that cannot be immediately reassigned (e.g. no authorised specialist
   available) is escalated to a team lead, who may temporarily raise capacity,
   re-prioritise, or hold with a documented reason.
4. Time-critical claims (urgent priority, or near SLA breach) are reassigned
   first.
5. The reassignment — from, to, reason, timestamp — is recorded on each claim's
   audit trail (see SOP-012).

Planned leave should be entered ahead of time so reassignment can be staged; the
same routing rules apply for unplanned absence, executed as soon as the absence is
known.

## 6. Continuity of Specialist Work
Where a claim under specialist review (SIU, Legal, Medical) must move because its
owner is away, it is reassigned **to another specialist of the same discipline**,
never downgraded to a generalist. If none is available, it is held with a
documented reason and escalated to a lead rather than progressed by an unqualified
handler.

## 7. Digital Steward Guidance
When advising on "who should take this" or "what to work next", the Digital Steward
must respect availability, specialisation, and authority. It must not recommend
routing a claim to an away adjuster, nor to an adjuster whose authority limit is
below the claim's exposure. It remains advisory (see SOP-013).

## 8. Related SOPs
- SOP-002 — Delegated Settlement Authority
- SOP-001 — Claims Escalation & Referral Matrix
- SOP-009 — Queue Prioritisation, SLA & Service-Tier Handling
- SOP-012 — Audit Trail, Record Integrity & Retention
