---
docId: PAC-ROUTE-001
title: Adjuster Assignment Policy
dimensions: [procedural, collaboration]
domain: insurance/auto/routing
ontologyBindings: [acl:Adjuster, acl:Claim, acl:Exposure]
regulatoryBasis: ["NAIC Model UCSP Act §902 (adjuster qualification + licensed-state requirements)"]
---

# Adjuster Assignment Policy

The assignment-routing step picks one adjuster per claim immediately after triage completes (or after a human resolves a triage HITL gate).

## Selection criteria, in priority order

1. **Skill match.** The adjuster's certified skills must cover the triage tier and the dominant coverage type. Total-loss claims require a total-loss-certified adjuster. SIU-flagged claims require an SIU-licensed adjuster.
2. **Geography.** Same-state preferred for liability matters because of state-specific tort rules. Cross-state acceptable when local capacity is exhausted.
3. **Workload balance.** Among adjusters with matching skill and geography, prefer the one with the lowest active-claim count (`activeClaims`) and the longest time since their last new assignment.
4. **Tenure for high-tier claims.** High and total-loss-suspect tiers should not be routed to adjusters with fewer than 12 months tenure.

## Tie-breaking

When multiple adjusters tie on the criteria above, the policy is round-robin across the tied set, seeded by claim number to keep the assignment reproducible.

## Outputs

The assignment-routing step emits:

- `adjusterId` — chosen adjuster.
- `tierMatched` — the tier the adjuster's skill covers (must equal the triage tier).
- `assignmentReason` — short narrative citing the matching skill, current load, and tenure.
- `escalationPath` — fallback adjuster if the primary becomes unavailable.

## When to mark needs-human-review

- No adjuster matches the required skill set within the operating geography.
- All matching adjusters are at or above their target load (`activeClaims` ≥ `maxActiveClaims`).
- The claim is total-loss-suspect and no total-loss specialist is available.

In these cases, surface to the supervisor surface and pause for human override.
