---
docId: PAC-REG-001
title: NAIC Model Regulation — Unfair Claims Practices
dimensions: [regulatory]
domain: insurance/auto/regulatory
ontologyBindings: [acl:Claim, acl:Adjuster, acl:Payment]
regulatoryBasis: ["NAIC Model UCSP Act §§1-10 (full unfair-practices framework)", "NAIC AI Model Bulletin §§3-4 (model-governance overlay)"]
---

# NAIC Model Regulation — Unfair Claims Practices Act (summary)

The National Association of Insurance Commissioners' Unfair Claims Settlement Practices Act is adopted in some form by most US states. It bounds how insurers may handle claims. The platform's claim handlers must operate within these constraints.

## Practices prohibited as unfair

- Misrepresenting pertinent facts or insurance policy provisions.
- Failing to acknowledge a claim within a reasonable time (most states: 15 calendar days).
- Refusing to settle a claim where liability has become reasonably clear.
- Not attempting in good faith to effectuate prompt, fair, and equitable settlements.
- Compelling insureds to institute litigation to recover amounts due under a policy by offering substantially less than the amounts ultimately recovered.
- Failing to provide a reasonable written explanation of the basis of a denial.
- Delaying investigation or payment by requiring multiple submissions of essentially the same information.

## Practical effect on automated decisioning

When an agent in this platform reaches a denial decision, it must:

1. Provide a written explanation citing the specific policy clause, regulation, or fact pattern that supports the denial.
2. Not delay communication beyond the state acknowledgement window.
3. Make the basis of the decision auditable — every denial decision is journaled with provenance (GROUNDED preferred; DERIVED denials require human approval per [[PAC-COV-002]]).

Any HITL gate that holds a denial decision must include the operator's written rationale before the decision is communicated to the claimant.

## State-specific timing windows (selected)

| Jurisdiction | Acknowledge | Affirm/Deny |
|---|---|---|
| New York | 15 days | 30 days from completion of investigation |
| California | 15 days | 40 days |
| Florida | 14 days | 90 days |
| Texas | 15 days | 15 business days after receipt of all items |

These windows are floor minimums. The platform's SLO for intake (`intake_latency_p90_minutes ≤ 15`) is more aggressive than the regulatory floor.
