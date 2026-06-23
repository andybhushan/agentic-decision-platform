---
docId: BANK-002
title: Application Intake - Required Fields and Verification Sources
dimensions: [procedural, entity]
domain: banking/consumer-lending/origination
---

# Application Intake — Required Fields and Verification Sources

This document codifies what the Loan Application Intake agent must extract from an incoming application and which authoritative sources each field is verified against.

## Required fields

The intake agent produces a `LoanApplication` record with:

- **Applicant identity** — full legal name, SSN (last-4 only in agent output; full SSN handled out-of-band), date of birth, current address (and previous address if < 2 years).
- **Income** — gross annual income, source (W-2 / 1099 / self-employed / retirement / SSDI), employer name + tenure.
- **Existing debt** — sum of monthly payments across mortgage, auto, student loan, revolving credit. Pulled from credit bureau report; the applicant's stated debt is cross-checked but credit bureau is authoritative.
- **Loan request** — amount, term, purpose (auto / home-equity / consolidation / other), collateral description.
- **Collateral valuation** — for auto, year/make/model/VIN/mileage; for home-equity, address + appraised value + appraisal date. Vehicle valuation pulled from J.D. Power / NADA; home appraisal from licensed appraiser report on file.

## Verification sources

| Field | Authoritative source | Agent action if missing |
|---|---|---|
| Income | Pay-stub or W-2 on file | Mark `incomeVerified=false`; route to "verification pending" |
| Credit score | Tri-bureau merge (Experian + Equifax + TransUnion); use middle score | Mark `creditVerified=false`; route to "verification pending" |
| Existing debt | Credit bureau report | Use stated, mark `debtSourceStated=true` |
| Collateral value (auto) | J.D. Power valuation tool | Mark `collateralVerified=false`; route to "verification pending" |
| Collateral value (home) | Appraisal on file | Mark `collateralVerified=false`; route to "verification pending" |

## Out-of-scope for v0

These fields exist in the production schema but are not exercised in this stress test:

- Co-applicant / joint application handling.
- VA / FHA-specific overlays.
- Pre-qualification vs. full application distinction.
- Existing customer cross-product offers.

## Outputs

The intake step emits:

- A `LoanApplication` JSON record with the fields above.
- A `missingFieldsList` if any required field couldn't be resolved.
- `incomeVerified`, `creditVerified`, `collateralVerified` booleans.
- `intakeConfidence` — float in [0,1]. Drops below 0.6 if any of the three verification booleans is false.
