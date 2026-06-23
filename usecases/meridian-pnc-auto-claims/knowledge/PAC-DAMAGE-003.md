---
docId: PAC-DAMAGE-003
title: Safety Re-inspection Triggers
dimensions: [procedural, regulatory]
domain: insurance/auto/damage
ontologyBindings: [acl:VehicleDamage, acl:Vehicle]
regulatoryBasis: ["49 CFR Part 571 (Federal Motor Vehicle Safety Standards)", "State motor-vehicle safety inspection statutes (e.g. CA Vehicle Code §27353)"]
---

# Safety Re-inspection Triggers

A safety re-inspection is a post-repair certification step that confirms the vehicle is roadworthy. It is paid by the carrier and added to the repair authorization. The damage assessment must flag the need for re-inspection so the assigned shop can schedule it before returning the vehicle to the policyholder.

## Mandatory re-inspection cases

These cases **always** require re-inspection regardless of damage category:

1. Any deployed airbag module (front, side, curtain, knee, or thoracic).
2. Any structural repair touching the unibody, frame, A/B/C pillars, suspension cradle, or floor pan.
3. Any battery-pack disturbance on an EV — even if the pack itself was not damaged, if the repair sequence involved disconnecting or shifting the pack housing.
4. Steering column replacement.
5. Seatbelt pretensioner deployment (forms the basis for the "anchor-replaced" certification).
6. Submerged or fire-damaged vehicles that the carrier is electing to repair (rare, but covered when ACV is so high that repair stays under the 75% threshold).

## Conditional re-inspection cases

These require re-inspection if any one of the following supplementary conditions also holds:

- Functional category + the repair touches any ADAS sensor mounting point (cameras, radar, lidar housings). Recalibration is part of the re-inspection.
- Cosmetic category + the vehicle is leased and the lessor's policy requires post-repair certification (this is a vehicle-attribute lookup on the policy file).
- Any category for vehicles still under OEM warranty where the OEM's body-shop network requires its own certification (Tesla, Rivian, BMW are notable examples).

## Discretionary re-inspection

The damage agent may flag re-inspection at its discretion when:

- The narrative mentions injuries even if no airbag deployed.
- Two prior claims for the same VIN show repair-and-resubmit patterns within 90 days (signals the prior repair was inadequate; pull the prior-claims pattern from the Fabric IQ semantic layer using the VIN as the join key).

## Output

The damage-assessment step's `safetyRecheckRequired` flag is set when any of the above triggers fires. The notes field cites which trigger(s) applied.
