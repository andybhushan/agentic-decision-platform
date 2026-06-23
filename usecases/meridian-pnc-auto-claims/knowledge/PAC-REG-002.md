---
docId: PAC-REG-002
title: State-Specific Coverage Rules — Rideshare and TNC Drivers
dimensions: [regulatory, procedural]
domain: insurance/auto/coverage
ontologyBindings: [acl:Coverage, acl:PolicyTerm, acl:Endorsement]
regulatoryBasis: ["CA Insurance Code §11580.24 (TNC liability-coverage requirements)", "Per-state TNC coverage statutes"]
---

# State-Specific Coverage Rules — Rideshare and TNC Drivers

Transportation Network Company (TNC) drivers — Uber, Lyft, DoorDash, etc. — operate in three distinct phases. Personal auto policy coverage differs by phase, and state regulations vary.

## The three TNC phases

**Phase 0** — App off. Driver is using vehicle for personal purposes. Personal auto policy fully applies.

**Phase 1** — App on, no rider matched yet. Driver is logged into the TNC app and available for ride requests but has not accepted one. Personal auto policy typically excludes coverage during this phase unless a rideshare endorsement is in force. TNC contingent liability may apply at state-mandated minimums.

**Phase 2/3** — Rider matched or rider in vehicle. TNC commercial policy is primary up to state-mandated limits ($1M in most states). Personal auto is generally excluded.

## State-mandated rideshare endorsement requirements

| State | Rideshare endorsement required? | Notes |
|---|---|---|
| California | Yes | AB 2293 |
| New York | Yes | Article 44-B |
| Texas | Yes | HB 100 |
| Florida | Yes | HB 221 |
| Illinois | Yes | Ride-Sharing Arrangements Act |
| Most other states | Recommended; some require | Check current state insurance code |

## Impact on coverage verification

When verifying coverage for a claim where the narrative mentions Uber, Lyft, DoorDash, food delivery, or "driving for an app":

1. Check policy for active `rideshare-endorsement`.
2. Determine the TNC phase from the narrative (off / available / driving-rider).
3. If Phase 1 or higher with no endorsement: coverage is generally denied at the personal-auto level.
4. If Phase 2/3: refer to TNC's commercial carrier for primary; personal-auto may apply as excess only.
5. Mark `coverageDecision` ambiguous when the TNC phase cannot be determined from the narrative alone.

## What to look for in the narrative

Phrases that signal TNC operation: "between rides", "waiting for a pickup", "on the way to pick up", "had just dropped off", "delivering for", "I drive for".

Phrases that signal personal use even with rideshare endorsement: "errands", "commute", "driving home", "weekend trip", "family in the car".
