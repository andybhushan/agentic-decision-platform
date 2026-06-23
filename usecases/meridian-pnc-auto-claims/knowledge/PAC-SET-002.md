---
docId: PAC-SET-002
title: Settlement Disclosure - State-Specific Language and Appeal Rights
dimensions: [regulatory, procedural]
domain: insurance/auto/settlement
ontologyBindings: [acl:Payment, acl:Claim, acl:Claimant]
regulatoryBasis: ["10 CCR §2695.7(b)(1) (CA Fair Claims Settlement Practices Regulations — written-notice requirement)", "NAIC Model UCSP Act §902 (denial-explanation standard)", "State-specific appeal-rights statutes"]
---

# Settlement Disclosure — State-Specific Language and Appeal Rights

Every settlement offer (payment or denial) must include a written disclosure that meets the state insurance department's requirements. This document codifies the disclosure rules. The settlement-disclosure agent uses these to compose the policyholder-facing letter.

## NAIC baseline (all states)

Per [[PAC-REG-001]] (NAIC Unfair Claims Practices), every settlement must disclose:

1. **The basis of the calculation.** Whether ACV, repair-based, partial, or denial. Cite the relevant coverage Part.
2. **The deductible applied** (if any) and the order of application.
3. **The appeal procedure.** How to dispute, where to write, what the response timeline is.
4. **Time-to-respond.** The policyholder has at least 60 days (and longer in some states) to accept, dispute, or counter-offer before the file may be closed without prejudice.
5. **Department of Insurance contact.** The state DOI complaint line for unresolved disputes.

The disclosure is delivered in writing within **15 calendar days** of the settlement decision in most states; some states impose tighter windows.

## State-specific overrides (delivery window)

| State | Settlement letter must be delivered within | Notes |
|---|---|---|
| California | 30 days of the agreed-amount decision | CA Fair Claims Settlement Practices Regulations |
| New York | 30 days of the determination | NY Reg 64 |
| Texas | 5 business days for first-party PD | TX Insurance Code 542 |
| Florida | 14 days of the agreed amount | FL Statute 626.9541 |
| Massachusetts | 10 days for first-party | MA c.176D |
| All other states | 15 calendar days | NAIC default |

## State-specific overrides (denial language)

For a full denial, the following states require **specific language** beyond the NAIC baseline:

- **California** — must include the specific Insurance Code section invoked for the denial reason.
- **New York** — must enumerate "all bases" for the denial (not "primary" basis); future grounds-shifting is barred.
- **Texas** — denial must cite the contractual provision or statute by name and section.
- **Florida** — denial that invokes a fraud finding must reference the SIU finding directly (cross-references [[PAC-SIU-001]]).
- **Illinois** — denial must include a translation availability statement in Spanish if the policyholder's preferred language is Spanish on the policy file.

The disclosure agent must check the policyholder's state from `dim_policyholder` and select the applicable templates.

## Appeal-rights language

Standard appeal language (used in most states unless overridden):

> "You have the right to appeal this determination. To file an appeal, please write to [carrier address]. Include the claim number, the reason for your appeal, and any supporting documentation. The carrier will acknowledge your appeal within 10 business days and provide a written response within 30 days. If you disagree with the appeal response, you may file a complaint with the [State] Department of Insurance at [DOI contact]."

States with stricter requirements (CA, NY, MA, FL, TX) override this language with their own templates. The agent must NOT mix template sentences across states.

## Mandatory inclusions for total-loss settlements

For ACV-based total-loss settlements, additionally:

- The valuation tool and date used (e.g., "Mitchell IntelliWriter, valuation date 2026-05-27").
- The policyholder's right to dispute the ACV with an independent appraisal.
- The salvage-retention option terms (see [[PAC-SET-001]]).
- For states with statutory total-loss thresholds (see [[PAC-TOTAL-LOSS-001]]), reference the applicable threshold.

## Mandatory inclusions for fraud-impacted settlements

If the upstream Fraud Handler found `partial-fraud` (per [[PAC-SIU-001]]) — i.e., adjusted reserves due to inflation:

- Disclose only the portion deemed not-fraudulent. Do not include the SIU's full findings in the policyholder letter (those go to the SIU file, not the disclosure).
- Cite the contractual or statutory basis for the adjustment.
- For Florida (FL Statute 626.989 reference per [[PAC-REG-001]]), additionally include the standard fraud-reporting disclosure.

If the Fraud Handler found `confirmed-fraud`, the settlement path is `denial`. The disclosure must use the state's denial template, not the partial-settlement template.

## Outputs

The settlement-disclosure step emits:

- `disclosureText` — the composed letter, plain text, ready for mail-merge.
- `deliveryWindowDays` — the state's delivery window (e.g., 15 for NAIC default, 30 for CA/NY, 5 for TX).
- `mandatoryClauses` — list of clauses included (`appeal-rights`, `doi-contact`, `acv-valuation`, `language-availability`, ...).
- `stateTemplateUsed` — which state-specific template (or `naic-default`) was selected.
- `denialDisclosure` — **boolean, true if this is a full-denial disclosure**. Used by the package's HITL gate (every denial gets a human pair of eyes before mailing).

## What the disclosure must NEVER include

- Speculation about the policyholder's character, motive, or honesty (even on fraud-impacted settlements — the disclosure stays factual and bounded to the contract).
- Settlement offers that condition acceptance on waiving future appeal rights without explicit policyholder consent in writing.
- Language that suggests the carrier's determination is final and non-reviewable.
- Any reference to the carrier's internal SIU findings beyond what the state mandates.
