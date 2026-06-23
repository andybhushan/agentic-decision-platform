---
docId: PAC-FRD-003
title: Fraud Score - Composition, Thresholds, and Decision Bands
dimensions: [procedural, regulatory]
domain: insurance/auto/fraud
ontologyBindings: [acl:FraudIndicator, acl:Claim, acl:SIUReferral]
regulatoryBasis: ["NAIC AI Model Bulletin §4.2 (model-output thresholds + adverse-action review)", "R-FRD-001 (acl:fraudScore ≥ 0.75 → SIUReferral within 48h)"]
---

# Fraud Score — Composition, Thresholds, and Decision Bands

The Fraud Score agent (`agent.fraud-score`) produces a single composite score in [0,1] from the per-claim red flags ([[PAC-FRD-001]]) and the cross-claim pattern evidence ([[PAC-FRD-002]]). The score gates the SIU referral decision ([[PAC-SIU-001]]).

## Score composition

```
fraudScore = clamp(0, 1,
    0.40 * per-claim-red-flag-density       (PAC-FRD-001 indicators / 7)
  + 0.35 * cross-claim-pattern-strength     (count of populated pattern families / 3)
  + 0.15 * narrative-divergence              (LLM-judged narrative vs photo vs damage signature)
  + 0.10 * adjuster-historical-prior         (prior fraud findings on same adjuster's claims, last 12mo)
)
```

The four components are independent — a claim with strong per-claim flags but no cross-claim pattern is still scoreable. A claim with weak per-claim flags but strong ring evidence (e.g., 0.35 alone) crosses the SIU threshold.

## Decision bands

Bands govern the downstream action. They are **not** denial bands — the bands gate review, not payment.

| Score range | Band | Action | Justification |
|---|---|---|---|
| 0.00 – 0.29 | **clear** | Continue normal claim workflow. Log scan event for audit. | Score below the SIU referral threshold; no investigative cost justified. |
| 0.30 – 0.59 | **watch** | Adjuster proceeds; flag for periodic re-scan if claim stays open >30 days. No SIU referral yet. | Moderate signal; usually clears with documentation. SIU bandwidth reserved for higher-confidence cases. |
| 0.60 – 0.79 | **siu-refer** | Referral to SIU. Claim status held at "investigation" until SIU finding. | Two or more indicator categories present; warrants dedicated SIU time. |
| 0.80 – 1.00 | **siu-priority** | Priority referral. Senior SIU investigator. Adjuster handoff suspended on this claim until SIU clears or finds. | High signal density across categories; potential ring or organized fraud component. |

The Fraud Score agent emits `fraudBand` (one of the four values) plus `fraudScore` (the raw number) plus `bandRationale` (narrative naming the components that drove the score).

## Confidence calibration

The score is a point estimate; the confidence in the score is separate. Confidence calibration follows the same pattern as other agents:

- Confidence ≥ 0.85: the agent is sure of the band placement (no boundary cases).
- Confidence 0.6 – 0.84: normal range.
- Confidence < 0.6: band placement is ambiguous (score within ±0.05 of a band boundary, or pattern-strength derived from a small N population). Route to HITL per the package's `gate.low-confidence-fraud-score`.

## Mandatory HITL for siu-priority

Any score that places the claim in the **siu-priority** band triggers `gate.priority-fraud-review` regardless of confidence. The carrier policy is that priority-band placements always get a second human pair of eyes before SIU is paged — false-positive priority referrals create operational drag on SIU and damage the relationship between Claims and SIU. The HITL gate exists to enforce this discipline.

## What the score must NOT do

- **Never** factor in the claimant's race, national origin, religion, gender identity, or any protected class. The fraud-score agent's system prompt forbids this; the audit trail records every input the score used.
- **Never** factor in cross-carrier loss history that hasn't been validated through ISO ClaimSearch (out of v0 scope; v1 hook).
- **Never** reduce the band based on adjuster intuition that "the claimant seems fine." Per-claim flags + cross-claim pattern + narrative divergence are the only allowed inputs.

## Audit trail expectations

The score's structured output must include the full input breakdown:

```json
{
  "fraudScore": 0.62,
  "fraudBand": "siu-refer",
  "components": {
    "perClaimRedFlagDensity": 0.43,
    "crossClaimPatternStrength": 0.67,
    "narrativeDivergence": 0.30,
    "adjusterHistoricalPrior": 0.05
  },
  "bandRationale": "Per-claim flags include loss-timing and behavioral; cross-claim pattern shows frequency-clustering on the policyholder. Narrative-vs-photo divergence is moderate. Adjuster prior is low.",
  "fraudConfirmed": false
}
```

`fraudConfirmed` is true only when band == `siu-priority` AND the priority-fraud-review HITL gate has been resolved with "confirm". This field is what the package's `gate.priority-fraud-review` trigger matches against (per [[PAC-SIU-001]]).
