---
docId: BANK-001
title: Consumer Loan Eligibility Framework - DTI, LTV, Credit Score
dimensions: [procedural, regulatory]
domain: banking/consumer-lending/origination
---

# Consumer Loan Eligibility Framework

This document codifies the eligibility ruleset used by the Loan Application Handler DW for consumer auto loans and home-equity loans. Three primary signals gate approval: Debt-to-Income (DTI), Loan-to-Value (LTV), and FICO credit score. Each has independent floor/ceiling thresholds; failure on any one routes the application to a denial or a senior-underwriter referral.

## DTI thresholds

Debt-to-Income ratio = (existing monthly debt payments + proposed monthly payment) / verified gross monthly income.

| DTI band | Auto loans (up to 7yr term) | Home-equity (up to 20yr term) |
|---|---|---|
| 0% – 35% | Approve standard | Approve standard |
| 36% – 43% | Approve with rate adjustment +0.5% | Approve with rate adjustment +0.75% |
| 44% – 49% | Refer to senior underwriter | Refer to senior underwriter |
| >= 50% | Decline | Decline |

DTI is computed off verified income only. Stated income is not eligible for approval; the application is routed to "income verification pending" if no W-2 / 1099 / pay-stub documents are on file.

## LTV thresholds

Loan-to-Value ratio = loan amount / appraised collateral value.

| LTV band | Auto (collateral = vehicle) | Home-equity (collateral = property) |
|---|---|---|
| 0% – 80% | Approve standard | Approve standard |
| 81% – 90% | Approve with PMI surrogate fee | Approve with PMI requirement |
| 91% – 100% | Refer to senior underwriter | Refer to senior underwriter |
| > 100% | Decline (loan exceeds collateral) | Decline |

For used vehicles older than 7 model years the LTV ceiling tightens to 80% regardless of credit band.

## FICO bands

| FICO band | Auto | Home-equity |
|---|---|---|
| 740+ | Approve | Approve |
| 680 – 739 | Approve standard | Approve standard |
| 620 – 679 | Approve subprime tier (rate +1.5%) | Refer to senior underwriter |
| 580 – 619 | Refer | Decline |
| < 580 | Decline | Decline |

## Composite gating

The application-eligibility agent must apply the **stricter** of the three signals — if DTI says approve-with-adjustment but FICO says decline, the application is declined. There is no "average" or "compensating-factors" auto-override; compensating factors are senior-underwriter discretion only.

## Outputs

The eligibility step emits:

- `decision` — one of `approve` | `approve-with-conditions` | `refer-to-underwriter` | `decline`.
- `decisionRationale` — narrative naming the DTI, LTV, FICO values used and the stricter-of rule application.
- `conditions` — list of conditions if approve-with-conditions (e.g., "PMI required", "rate +1.5%").
- `referralReason` — if refer-to-underwriter, what signal pushed it there.
- `requiresHumanReview` — **boolean, true if decision is `refer-to-underwriter` or `decline`**. Used by the package's HITL gate.

## What this agent must NOT do

- **Never** factor in race, national origin, religion, gender identity, age, or any protected class per ECOA / Reg B.
- **Never** approve based on stated (unverified) income.
- **Never** auto-override a decline using compensating-factors logic — that's senior-underwriter discretion only.
