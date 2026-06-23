---
docId: PAC-DAMAGE-001
title: Damage Categorization Framework
dimensions: [procedural, historical]
domain: insurance/auto/damage
ontologyBindings: [acl:VehicleDamage, acl:Vehicle, acl:DamagePart]
---

# Damage Categorization Framework

Damage assessment runs after FNOL triage and a damage report (photos, descriptions, optionally a shop estimate) is attached to the claim. The damage agent assigns one of four categories. The category drives the repair-or-total-loss decision, shop tier, and reserves.

## Damage categories

**Cosmetic** — Surface-only damage that doesn't affect drivability, safety, or structural integrity. Examples: door dings, paint scuffs, broken trim, cracked tail-light lens, faded clear-coat. Typical repair $400–$1,800. No safety re-inspection required.

**Functional** — A drivable vehicle with one or more impaired but non-structural systems. Examples: broken side mirror with electronics, cracked windshield, damaged bumper cover with sensor housing, deployed minor airbag (one curtain), hail spotter. Typical repair $1,800–$6,500. Safety re-inspection only if airbag-adjacent.

**Structural** — Damage that compromises the unibody, frame, A/B/C pillars, suspension geometry, or floor pan. Examples: T-bone with door intrusion, head-on impact with frame buckle, rollover (minor), submerged (water line below dashboard). Typical repair $6,500–$22,000. **Mandatory** post-repair frame measurement + alignment certification. Cannot route to non-OEM-certified shops.

**Total-Loss-Suspect** — Repair cost exceeds 75% of vehicle ACV (Actual Cash Value), OR the vehicle exhibits one of the categorical total-loss signals: submerged above dashboard, fire damage to passenger compartment, multi-airbag deployment (≥3 modules), severe rollover, theft-recovered with substantial stripping. Refer to [[PAC-TOTAL-LOSS-001]] for the threshold rules.

## Inputs the agent should ground on

- `incident.incidentType` from the FNOL (collision / parking-lot / comprehensive / theft-recovered / water / fire).
- `expected.severityHint` from the FNOL Handler's initial triage (low / medium / high / total-loss-suspect).
- Vehicle `year/make/model` from `dim_vehicle`.
- Prior similar claims with the same incident-type + state from the Fabric IQ semantic layer (see [[PAC-TRI-001]] for how similar-claims signals are interpreted).
- Damage description text + photo count (a photo count > 6 with a "minor" narrative is a known divergence signal — see [[PAC-FRD-001]]).

## Outputs

The damage-assessment step emits:

- `damageCategory` — cosmetic | functional | structural | total-loss-suspect.
- `categoryConfidence` — float in [0,1]. Calibrated against the prior-claims population.
- `safetyRecheckRequired` — bool (true for all structural and any functional with airbag-adjacent damage).
- `notes` — narrative summary with the evidence the category was derived from.

## Ambiguous categorization

The damage agent should report low confidence (< 0.6) and route to HITL when:

- The photo count and description disagree by more than one severity tier.
- Cost estimate (if attached) puts the claim within ±10% of the total-loss threshold.
- Structural signals are present but only on one panel (the boundary between functional-with-bracket-damage and structural-with-pillar-damage).
