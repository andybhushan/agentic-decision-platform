---
docId: PAC-TRI-001
title: Initial Triage — Severity Classification Framework
dimensions: [procedural, historical]
domain: insurance/auto/triage
ontologyBindings: [acl:Claim, acl:Exposure]
---

# Initial Triage — Severity Classification Framework

Triage assigns a tier to each claim immediately after coverage verification. The tier drives routing, reserves, and SLA expectations.

## Severity tiers

**Low** — Single vehicle, drivable, repair estimate under $3,500, no injuries, no third party involved. Examples: minor parking-lot bump, single-side cosmetic damage, broken side mirror, isolated comprehensive (small hail, broken windshield).

**Medium** — Drivable but damage spans multiple panels or includes structural elements; repair estimate $3,500–$15,000; minor reported injuries (no hospitalization); third party involved but no disputed liability.

**High** — Not drivable, repair estimate exceeds $15,000 but below total-loss threshold; reported injuries requiring medical attention; disputed liability; multiple parties; potential subrogation or recovery.

**Total-Loss Suspect** — Repair estimate exceeds 75% of vehicle ACV (actual cash value). Submerged, fire, severe rollover, multi-airbag deployment, or odometer flagged. Total-loss specialist required.

## Triage outputs

The triage step produces:

- `severity` — one of the four tiers.
- `complexityScore` — 1–5 estimate of investigative effort.
- `fraudIndicators` — count and list (see [[PAC-FRD-001]]).
- `recommendedTier` — adjuster pool (`standard` / `senior` / `total-loss`).
- `notes` — narrative summary.

## Ambiguous triage signals

The triage agent should report low confidence (< 0.6) and surface to the HITL gate when:

- Severity could reasonably be classified two tiers apart given the evidence (e.g., "medium" vs "high" because the repair estimate is missing or contested).
- The narrative and the photo count disagree (e.g., narrative says minor damage but 8+ photos suggest extensive damage).
- A fraud indicator is present but the evidence is one-sided.

In these cases, the triage step's `status` is `needs-human-review` and the operator console's HITL gate opens with the package's configured options.
