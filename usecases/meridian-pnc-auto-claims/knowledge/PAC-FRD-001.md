---
docId: PAC-FRD-001
title: Fraud Indicators for Auto Claims
dimensions: [procedural, historical]
domain: insurance/auto/triage
ontologyBindings: [acl:FraudIndicator, acl:Claim]
regulatoryBasis: ["NAIC AI Model Bulletin §3.2 (algorithmic-decision support standards)", "NAIC Model UCSP Act §4 (fair investigation standard)"]
---

# Fraud Indicators for Auto Claims

The triage step performs a first-pass fraud scan. A claim with two or more independent indicators should be flagged for the SIU (Special Investigations Unit) regardless of the standard severity tier.

## Common red flags

**Loss timing**
- Incident occurs within 30 days of policy inception.
- Incident occurs within 7 days of a coverage increase or new endorsement (especially uninsured-motorist or rental reimbursement).
- Reporting delay exceeds 14 days without a documented reason.

**Witness pattern**
- No third-party witnesses despite incident type (e.g., intersection collision with no witnesses).
- Only "passenger" witnesses related to the claimant.
- Witnesses' addresses match the claimant's.

**Damage / narrative mismatch**
- Vehicle damage location inconsistent with the described incident type.
- Severity of injuries reported disproportionate to vehicle damage.
- Police report absent for an incident type that typically requires one.

**Repair / valuation**
- Insured insists on a specific repair shop they cannot explain choosing.
- Pre-existing damage visible in submitted photos but not disclosed.

**Behavioral**
- Claimant aggressively pushes for fast settlement.
- Multiple recent claims under the same policy (≥ 3 in 24 months).
- Refusal to provide vehicle for inspection.

## Scoring

The fraud-indicator-scan skill returns a structured signal:

```json
{ "indicators": ["loss-timing", "narrative-mismatch"], "score": 0.42, "rationale": "..." }
```

Score is the normalised count of indicators (each indicator weighted 0.15). A score ≥ 0.30 means at least two indicators present — flag for SIU review.

## What is NOT a fraud indicator

A claim is **not** flagged purely because:
- The claimant has filed claims with other insurers in the past.
- The vehicle is old or low-value.
- The claimant is in a high-fraud geography (this would be a routing input, not a fraud indicator).
- The incident occurred on a weekend or holiday.

Adjusters and the triage agent should not weight any of these as fraud signals on their own.
