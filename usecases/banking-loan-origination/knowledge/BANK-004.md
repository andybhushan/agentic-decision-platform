---
docId: BANK-004
title: ECOA Regulation B - Prohibited Bases and Discrimination-Free Decisioning
dimensions: [regulatory, procedural]
domain: banking/consumer-lending/compliance
---

# ECOA Regulation B - Prohibited Bases and Discrimination-Free Decisioning

The Equal Credit Opportunity Act (15 U.S.C. Section 1691 et seq.) and its implementing Regulation B (12 CFR Part 1002) prohibit creditors from discriminating against applicants on any of nine prohibited bases. The Loan Eligibility Agent and the Loan Decision Letter Agent must enforce this rule both at decision-time (the eligibility decision must not factor in any prohibited basis) and at communication-time (no adverse-action letter may reference or be inferred from a prohibited basis).

## The nine prohibited bases

A creditor must not deny credit, vary terms, or use any prohibited basis as a factor in any aspect of a credit transaction:

1. **Race**
2. **Color**
3. **Religion**
4. **National origin**
5. **Sex** (including sexual orientation and gender identity per CFPB guidance issued 2021)
6. **Marital status**
7. **Age** (with limited exceptions where age is empirically derived and not used to discriminate against applicants 62 or older)
8. **Receipt of public assistance income** (the existence of such income may not be a negative factor)
9. **Good-faith exercise of any right under the Consumer Credit Protection Act**

The Loan Eligibility Agent's invariant `inv.no-protected-class-inputs` enforces this at the platform level — any reference to any of the nine bases in the eligibility decision inputs is a hard validation failure and the orchestration aborts.

## What the platform does to enforce this

| Enforcement point | How it works |
|-------------------|--------------|
| Eligibility Agent system prompt | Explicit instruction: "NEVER factor in race, national origin, religion, gender identity, age, or any protected class per ECOA / Reg B." Reinforced at every invocation. |
| Eligibility input audit | Before the LLM call, `StepRunner` walks the agent's input context for any field that matches the protected-class lexicon. Any hit raises `InvariantViolation` and the orchestration aborts. |
| Decision rationale audit | After the LLM call, the produced `decisionRationale` is scanned for protected-class lexicon hits. A hit triggers a HITL gate (mandatory review) before the decision can be communicated. |
| Letter Agent system prompt | Explicit instruction to never reference protected-class characteristics in the adverse-action letter. The qualityCheck step re-scans the produced letter. |
| Decision Journal record | Every decision event records the exact input fields the agent saw. This is the audit trail compliance presents to a CFPB examiner. |

## Disparate-impact monitoring (out of v0; v1.5)

Even when no prohibited basis is used as a direct input, a model can produce outcomes that disproportionately affect a protected class - the disparate-impact problem. v1.5 adds a quarterly fair-lending review job that compares approval rates across protected-class strata (inferred from BISG-style proxies on the borrower population) and flags statistically significant disparities for human review. v0 documents the requirement but does not implement the monitoring job.

## Required disclosures

Beyond the FCRA adverse-action content in BANK-003, ECOA Reg B requires the adverse-action notice to include:

1. **A statement of the action taken** (denied / approved on terms different from those requested / counter-offered).
2. **The name and address of the creditor** (Meridian Consumer Loans, or the appropriate brand name).
3. **The ECOA-mandated notice** - the verbatim federal statement: "The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant has the capacity to enter into a binding contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552."
4. **The principal reason(s) for the adverse action** (overlaps with FCRA, see BANK-003).

The Letter Agent's federal-floor template includes all four elements verbatim. State overlays (per BANK-003) layer on top.

## Reading-level and language requirements

Reg B's "principal reasons" must be drawn from the FCRA-permissible reason codes and translated into plain consumer-readable language. The Letter Agent uses the same plain-English translation table as FCRA notice generation (see BANK-003). For Spanish-language applicants, the notice must be available in Spanish if the application was taken in Spanish or the applicant requested Spanish correspondence; the Letter Agent's `language` parameter handles this branching.

## Where this binds in the platform

| Agent step | What enforces ECOA Reg B compliance |
|------------|-------------------------------------|
| loan-application-intake | Must not extract protected-class fields. The intake schema (BANK-002) does not allow them. |
| loan-eligibility | Invariant `inv.no-protected-class-inputs` audits inputs; the decision rationale is scanned post-LLM for protected-class lexicon. |
| loan-decision-letter | System prompt prohibition; letter qualityCheck step re-scans output. Federal ECOA statement is required content in every adverse-action letter. |
