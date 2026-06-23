---
docId: PAC-SET-001
title: Settlement Amount Calculation - ACV, Repair-Based, Deductibles
dimensions: [procedural, regulatory]
domain: insurance/auto/settlement
ontologyBindings: [acl:Payment, acl:Exposure, acl:Coverage, acl:Claim]
regulatoryBasis: ["NAIC Model UCSP Act §902(c) (prompt-settlement standards)", "10 CCR §2695.7(g) (CA settlement-offer standards)"]
---

# Settlement Amount Calculation — ACV, Repair-Based, Deductibles

The Settlement Handler computes the payable amount for a claim. Inputs come from the upstream DWs: coverage decision from FNOL Handler, damage category + repair-estimate band from Damage Handler, fraud finding (if any) from Fraud Handler.

This document codifies the math. Disclosure language is in [[PAC-SET-002]]. Payment channel routing is in [[PAC-SET-003]].

## Five settlement paths

| Damage path | Settlement basis | Cap |
|---|---|---|
| **Cosmetic / Functional / Structural** repair | Sum of approved repair-shop estimates (post supplementals) | Coverage sub-limit for the applicable Part (Collision / Comprehensive) |
| **Total-loss** (categorical or threshold) | Vehicle ACV less deductible less salvage retention if elected | Comprehensive or Collision limit (per coverage) |
| **Diminished value** (claimable in 14 states) | Pre-loss ACV minus post-repair market value | State-specific cap, typically $5,000 |
| **Rental reimbursement** | Daily rate × days, up to per-policy cap | Rental reimbursement sub-limit |
| **Full denial** | $0 | n/a — but unfair-claims-practices windows still apply ([[PAC-REG-001]]) |

A claim can have **multiple paths** — e.g., a structural repair claim that also reimburses rental days. Each path is calculated separately and summed.

## Deductible application order

Apply deductibles to the **repair-based path first**, then to ACV path if any remains. Never apply a deductible twice to the same claim (one deductible per loss occurrence under most personal auto forms).

```
gross_repair_settlement      = approved_estimate_sum
gross_acv_settlement         = vehicle_acv (if total-loss)
applied_to_repair            = min(deductible, gross_repair_settlement)
remaining_deductible         = deductible - applied_to_repair
net_repair_settlement        = gross_repair_settlement - applied_to_repair
net_acv_settlement           = gross_acv_settlement - remaining_deductible
```

## ACV determination

ACV (Actual Cash Value) for total-loss claims is derived from:

- Mitchell IntelliWriter or J.D. Power valuation tool — primary source, retrieved by the `tool.vehicle-lookup` MCP tool.
- Adjustments for verified options, low-mileage, and unrecorded damage (factor in pre-existing damage flagged in PAC-FRD-001).
- Floor: state-mandated minimums for vehicles under 5 years old (varies; 17 states).

The ACV value used in the calculation is recorded in the settlement event for audit. **Never** use list price, MSRP, or insured-declared values as substitutes for the valuation tool's output.

## Sub-limits and exclusions

For each coverage part triggered, apply its sub-limit *before* deductible:

- **Comprehensive (Part D)** — Glass, theft, vandalism, weather. Per-occurrence sub-limit varies by policy form.
- **Collision (Part D)** — At-fault collisions, single-vehicle collisions. Same sub-limit pool as Comp on most forms.
- **Rental reimbursement** — daily-rate × days × policy-cap. Cap is per-occurrence, not annual.
- **Personal injury** — out of v0 scope; this DW only handles property components.

Exclusions zero out specific paths but do not deny the whole claim unless every path is excluded. Example: a rideshare-active-period exclusion on Personal Auto (see [[PAC-REG-002]]) zeros the at-fault collision path but doesn't void the comprehensive component if the policyholder also has hail damage on the same claim.

## Outputs

The settlement-calculation step emits:

- `settlementAmount` — final payable in dollars (after deductible, after sub-limit cap).
- `settlementBasis` — one of `repair-based` | `acv-based` | `combined` | `denial` | `partial`.
- `calculationBreakdown` — narrative naming each path, the gross amount, and the adjustments.
- `appliedDeductible` — dollars applied.
- `coveragePartsTriggered` — list (e.g., ["collision", "rental"]).
- `acvValueUsed` — the ACV figure used (null if not total-loss).
- `highValueSettlement` — **boolean, true if settlementAmount >= $25,000**. Used by the package's HITL gate.
- `fullDenial` — **boolean, true if settlementAmount == $0 because every path was denied/excluded**. Used by the package's full-denial HITL gate.

## Settlement floor for total-loss

Carrier policy: for total-loss claims, the carrier offers the policyholder a choice between:

- **Pure ACV settlement** — the policyholder surrenders the vehicle.
- **ACV less salvage retention value** — the policyholder keeps the vehicle for parts; carrier deducts the auctioned salvage value from the payout.

The settlement-calculation agent should produce both numbers when the path is total-loss; the policyholder choice is captured at disbursement time, not by the agent.

## Round-trip validation invariants

Two invariants the package's `digitalWorker.orchestration.invariants` block enforces:

1. `settlementAmount` must never be negative. (Deductible-exceeds-gross cases settle at $0, not negative.)
2. `settlementAmount` must never exceed the sum of triggered sub-limits.

Violations are platform-detected and route to senior-adjuster review, not auto-corrected.
