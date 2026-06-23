---
docId: BANK-003
title: FCRA Adverse-Action Disclosure Requirements - Consumer Loan Denials
dimensions: [regulatory, procedural]
domain: banking/consumer-lending/disclosure
---

# FCRA Adverse-Action Disclosure Requirements

The Fair Credit Reporting Act (FCRA, 15 U.S.C. Section 1681) requires that when a consumer loan application is denied or approved on less-favorable terms than requested based wholly or in part on information from a consumer reporting agency, the applicant must receive a written adverse-action notice that meets specific content and timing requirements. This document codifies what the Loan Decision Letter Agent must include in every denial or counter-offer letter the platform generates, and the state-specific overlays that apply.

## Required content (federal floor, applies to all states)

Every adverse-action notice must contain, at minimum, the following six elements:

1. **A statement of the action taken** (denied, approved with less-favorable terms, or counter-offered) and the specific loan product the action relates to.
2. **The principal reason(s) for the adverse action**, drawn from a list of FCRA-permissible reason codes. Use up to four reason codes ranked by contribution to the decision. The Loan Decision Letter Agent's reasonCodes array is the source of truth.
3. **Name, address, and toll-free telephone number of each consumer reporting agency** that supplied a report used in the decision (Experian, Equifax, TransUnion for tri-bureau decisions).
4. **A statement that the consumer reporting agency did not make the credit decision** and cannot explain the specific reasons for the action.
5. **The consumer's right to obtain a free copy** of their consumer report from the reporting agency within 60 days of the adverse-action notice.
6. **The consumer's right to dispute** the accuracy or completeness of any information in their consumer report directly with the agency.

If a credit score was used as a factor in the decision, the notice must additionally include:

- The numerical credit score itself.
- The range of possible scores (e.g., 300 to 850 for FICO).
- The key factors that adversely affected the score, drawn from the score model's reason codes (use up to five, ranked).
- The date the score was created.
- The name of the entity that provided the score.

## Timing requirement

Notice must be delivered to the applicant **within 30 days of the adverse action** for FCRA purposes. ECOA Reg B imposes a separate 30-day notification window measured from receipt of a completed application; the platform's safe default is to deliver the FCRA-compliant adverse-action notice within 15 calendar days of the decision, which satisfies both regimes with margin.

## State-specific overlays the Letter Agent must apply

| State | Overlay |
|-------|---------|
| California | Add CCRAA (California Consumer Credit Reporting Agencies Act) language acknowledging the applicant's additional state-level dispute rights. Include the Spanish-language summary insert if the applicant's correspondence preference is Spanish or if the application was taken in Spanish per Cal. Civ. Code Section 1632. |
| New York | Add the New York Department of Financial Services complaint address and phone number. State-specific delivery window is 30 days; no acceleration. |
| Texas | Add the Texas Office of Consumer Credit Commissioner contact details. For home-equity loans, additionally cite Tex. Const. Art. XVI Section 50(a)(6) provisions if the decision involves an HE product. |
| Massachusetts | If the applicant's correspondence preference is Spanish, include the Spanish-language summary insert per M.G.L. c. 184 Section 17B. Adverse-action notices for HE loans require senior-counsel co-sign before mailing. |
| Florida | Standard federal floor applies. No additional state-specific content required. |
| Illinois | Add Illinois Attorney General consumer-protection complaint address. |
| Other states | NAIC-default federal floor language only; do not invent state-specific overlays the regulator did not promulgate. |

## Tone and reading-level requirements

The letter must be written at no higher than an 8th-grade reading level (Flesch-Kincaid 6.0-8.0). Use plain English, not banking jargon. The reason codes must be translated from internal codes (e.g., "DT01: High debt-to-income ratio") into consumer-readable language ("Your existing monthly debt obligations are high relative to your verified monthly income."). The Letter Agent's qualityCheck step verifies reading level and reason-code translation before the letter is queued for mailing.

## What the Letter Agent must NEVER include

- The applicant's race, ethnicity, color, national origin, religion, sex, gender identity, age (unless legally required for the specific product), or marital status.
- The applicant's protected-class status under any state-specific anti-discrimination law (see BANK-004 for the ECOA / Reg B prohibition list).
- The internal model name or score model code (e.g., "FICO 8 model code 9404") — only the score number and standard reason codes.
- Speculative reasons not supported by the reason codes that drove the decision.

## Audit trail

Every adverse-action letter must reference the underlying loan-application ID, the decision ID, the agent ID that produced the decision (`entraAgentId`), and the reason codes used. This ties the letter back through the Decision Journal to the original eligibility decision, satisfying CFPB examination-evidence requirements.
