---
docId: BANK-005
title: Fair Lending Pricing Bands - APR Tiers by Risk Stratum
dimensions: [procedural, regulatory]
domain: banking/consumer-lending/pricing
---

# Fair Lending Pricing Bands

When the Loan Eligibility Agent returns approve or approve-with-conditions, the platform must produce a pricing offer that consists of an APR, a term, and any conditions. This document codifies the APR pricing bands used, the risk-stratification model that drives band selection, and the fair-lending guardrails that govern variance within each band. The Loan Decision Letter Agent reads this document when generating offer letters; the Loan Eligibility Agent reads it when proposing a structured offer.

## Risk stratum derivation

Each approved application is assigned to one of five risk strata based on the post-decision composite score. The composite score is derived from:

- **FICO band** (35% weight): 740+ tier A, 700-739 tier B, 660-699 tier C, 620-659 tier D, below 620 not eligible for non-secured products.
- **DTI band** (25% weight): below 30% tier A, 30-36% tier B, 36-43% tier C, 43-50% tier D, above 50% denied.
- **Employment tenure** (15% weight): 5+ years tier A, 2-5 years tier B, 6 months - 2 years tier C, below 6 months tier D.
- **LTV band, secured products only** (15% weight): below 70% tier A, 70-80% tier B, 80-90% tier C, 90-100% tier D, above 100% denied.
- **Bank-relationship tenure** (10% weight): 5+ years tier A, 2-5 years tier B, 6 months - 2 years tier C, no prior relationship tier D.

The five strata after weighted composition are A (lowest risk), B, C, D (highest accepted), and Referred (composite below threshold, referred to underwriter per BANK-001).

## APR pricing bands by product and stratum

### Auto loans, 36-72 months

| Stratum | APR floor | APR ceiling | Typical APR |
|---------|-----------|-------------|-------------|
| A | 5.49% | 6.74% | 5.99% |
| B | 6.49% | 8.24% | 7.24% |
| C | 8.99% | 12.49% | 10.49% |
| D | 12.49% | 17.99% | 14.99% |

### Personal loans (unsecured), 24-60 months

| Stratum | APR floor | APR ceiling | Typical APR |
|---------|-----------|-------------|-------------|
| A | 8.99% | 11.49% | 9.99% |
| B | 11.99% | 14.99% | 13.49% |
| C | 14.99% | 18.99% | 16.49% |
| D | 18.99% | 24.99% | 21.49% |

### Home-equity loans, 60-180 months

| Stratum | APR floor | APR ceiling | Typical APR |
|---------|-----------|-------------|-------------|
| A | 6.49% | 7.99% | 7.24% |
| B | 7.99% | 9.74% | 8.74% |
| C | 9.74% | 12.49% | 10.99% |
| D | 12.49% | 15.49% | 13.99% |

### Debt-consolidation loans, 24-60 months

Treat as personal-loan pricing minus 50 basis points across all strata to incentivize consolidation of higher-APR external debt.

## Fair-lending variance discipline (the core requirement)

Within any single stratum, APR variance across the approved population must not correlate with any protected-class proxy. The platform's fair-lending governance enforces this with three rules:

1. **Within-stratum APR variance cap**: standard deviation of approved APRs within a single stratum may not exceed 75 basis points. Wider variance signals either a stratum that is too broad (refine the model) or pricing discretion that risks ECOA disparate-impact (audit and remediate).
2. **Within-stratum APR median equality**: across protected-class proxy strata (BISG-derived for race / ethnicity), median APR within the same risk stratum must be within 25 basis points. Statistically significant divergence triggers a fair-lending review job (v1.5).
3. **Risk-band-jumping prohibition**: the Eligibility Agent must not adjust risk stratum based on subjective factors. Stratum is derived deterministically from the composite score; the offer agent picks an APR within the assigned stratum's range.

## Conditions that the agent may attach to approve-with-conditions decisions

| Condition code | When applied | Letter language |
|----------------|--------------|-----------------|
| COSIGN | DTI between 43-50% on personal/auto with FICO tier B or worse | "A qualified co-signer with a verified DTI below 30% and FICO of 700 or higher is required." |
| DOWNPAYMENT | LTV in 90-100% band on secured product | "A minimum down payment of N% is required, reducing LTV to no more than 80%." |
| AUTOPAY | Stratum C or D, any product | "Enrollment in autopay from a Meridian deposit account is required. This earns a 25-basis-point APR reduction." |
| VERIFY-INCOME | Employment tenure below 6 months on personal/HE | "Provide additional income verification: two most-recent pay stubs and a signed verification-of-employment from your employer." |
| COLLATERAL-INSPECT | Secured product, used collateral, collateral value above $50K | "An independent collateral inspection is required at the borrower's cost." |
| BANK-RELATIONSHIP | First-time applicant, no prior Meridian deposit history | "Open and fund a Meridian deposit account with a minimum of $500 within 30 days of closing." |

The Letter Agent picks conditions from this table and emits human-readable language; it does not invent conditions outside the table. The Eligibility Agent's `conditions[]` output drives which rows the Letter Agent emits.

## Counter-offer protocol

When the requested loan amount, term, or product does not fit the applicant's stratum, the Eligibility Agent may emit a counter-offer rather than a flat denial. Counter-offers must:

- Reduce loan amount, shorten term, raise APR, or change product to a lower-risk alternative — never expand any term that increases risk.
- Be accompanied by FCRA / ECOA adverse-action language (the counter-offer constitutes an adverse action under FCRA because the original request was denied even though a less-favorable alternative was offered).
- Be no more than one offer per application — if the applicant rejects the counter, the application is closed, not re-pricing-iterated.

The Letter Agent's `counterOffer` payload includes the original requested terms, the offered terms, the rationale, and the FCRA-compliant adverse-action content per BANK-003.
