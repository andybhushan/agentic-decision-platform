---
docId: PAC-TOTAL-LOSS-001
title: Total-Loss Threshold Rules
dimensions: [procedural, regulatory]
domain: insurance/auto/damage
ontologyBindings: [acl:TotalLossEvaluation, acl:VehicleDamage, acl:Vehicle]
regulatoryBasis: ["10 CCR §2695.8(b)(1) (CA total-loss appraisal standards)", "Per-state Total Loss Threshold statutes (TLT/TLF)"]
---

# Total-Loss Threshold Rules

A vehicle is declared total-loss when the repair cost (including salvage value retention) crosses a threshold tied to the vehicle's Actual Cash Value (ACV). The exact threshold varies by state regulation and policy form. This document codifies the working rules used by the damage agent. It defers the actual declaration to a senior adjuster — the agent flags suspects, it does not declare.

## ACV-based threshold (carrier policy)

The carrier's default total-loss threshold is:

```
repairCost + salvageValue >= 0.75 * ACV
```

A claim that hits this threshold becomes **total-loss-suspect**, never automatically total-loss. The senior adjuster's review pulls in title status, owner intent (keep-and-rebuild requests), and lien information.

## State-mandated overrides

Some states fix the threshold by statute. When a state's statute is *more lenient* than the carrier's 75% default (i.e., it requires a higher repair-to-ACV ratio), the state statute governs:

| State | Statutory total-loss threshold |
|---|---|
| Florida | 80% |
| Indiana | 70% |
| Iowa | 50% |
| Louisiana | 75% |
| Maryland | 75% |
| Minnesota | 80% (or "salvage-significant damage" categorical) |
| Mississippi | 75% |
| Missouri | 80% |
| Nebraska | 75% |
| New York | 75% (or "frame-damaged" categorical) |
| Oklahoma | 60% |
| Texas | 100% (statutory only if titled salvage) |

For states not listed, the carrier 75% rule applies.

The damage agent must apply the **higher** of carrier rule (75%) and state rule (per table), which means in practice the agent uses `max(0.75, stateThreshold)` keyed on the policyholder state.

## Categorical total-loss

Regardless of repair-cost math, the following damage patterns are categorical total-loss-suspect and must escalate:

1. **Submerged above the dashboard** — saltwater above 14 in / freshwater above 22 in interior depth.
2. **Fire in the passenger compartment** (engine-only fires that didn't breach the firewall stay non-categorical).
3. **Multi-airbag deployment of three or more modules** including any of: front-driver, front-passenger, side-curtain (either side), thoracic, knee.
4. **Severe rollover** — vehicle rotated more than 180° around its longitudinal axis, OR landed on its roof.
5. **Theft-recovered with substantial stripping** — driveline removed, dashboard removed, or seats removed.

## Output expectations

When the damage agent flags total-loss-suspect, it must emit:

- `totalLossReason` — one of `acv-threshold` | `submerged` | `fire-cabin` | `multi-airbag` | `rollover-severe` | `theft-stripped`.
- `acvAtIncident` — the ACV value used (or null if categorical).
- `repairToAcvRatio` — float (or null if categorical).
- `stateThresholdApplied` — float (e.g., 0.80 for Florida).
- `recommendedNextStep` — "escalate-to-total-loss-specialist".

The downstream Settlement Handler (not built in v0) consumes these fields to issue ACV-based settlement instead of routing to a repair shop.
