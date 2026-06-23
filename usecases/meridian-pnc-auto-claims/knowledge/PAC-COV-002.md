---
docId: PAC-COV-002
title: Coverage Verification Rules and Common Exclusions
dimensions: [procedural, regulatory]
domain: insurance/auto/coverage
ontologyBindings: [acl:Coverage, acl:Exposure, acl:PolicyTerm, acl:Claim]
---

# Coverage Verification Rules and Common Exclusions

## Standard verification sequence

1. Confirm the policy is in force on the date of incident (between `effectiveStart` and `effectiveEnd`).
2. Confirm the claimant is a named insured or covered driver on the policy.
3. Confirm the vehicle is listed on the policy (VIN match against `vehicle.vin`).
4. Map the incident type to one or more coverage parts (see [[PAC-COV-001]]).
5. Verify no policy-level exclusion applies.
6. Apply per-coverage deductible to the loss estimate.

## Common exclusions that deny coverage

- Vehicle used commercially without a rideshare endorsement (e.g., gig delivery without the endorsement on the policy).
- Driver excluded by name on the policy declarations page.
- Loss occurring during a racing event or organized speed contest.
- Intentional acts by the insured.
- War, riot, or civil disorder (unless explicitly endorsed).
- Wear, tear, mechanical breakdown, or freezing (not a covered peril under comprehensive).

## Ambiguous cases requiring human review

The coverage-verification agent should mark `coverageDecision = "needs-human-review"` when:

- The incident narrative suggests intentional damage but the police report is silent on intent.
- The vehicle is on the policy but the named driver is not — and there's no exclusion either way.
- A rideshare endorsement is missing but the narrative implies the driver was logged into a TNC app.
- The policy was renewed mid-month and the incident date falls within the renewal grace period.
- Multiple coverages could apply but with different deductibles — verify which one is the lower-cost path for the claimant.

## Confidence calibration

A verification with no exclusions, clean VIN match, and unambiguous coverage mapping should report confidence ≥ 0.90. Any single ambiguity flagged above drops confidence to the 0.55–0.75 range and should not auto-approve.
