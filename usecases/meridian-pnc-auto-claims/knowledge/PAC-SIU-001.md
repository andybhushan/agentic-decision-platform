---
docId: PAC-SIU-001
title: SIU Referral Procedure and Investigator Routing
dimensions: [procedural, collaboration, regulatory]
domain: insurance/auto/fraud
ontologyBindings: [acl:SIUReferral, acl:FraudIndicator, acl:Claim, acl:Adjuster]
regulatoryBasis: ["NAIC Model Insurance Fraud Prevention Model Act §3 (referral procedures)", "State Insurance Fraud reporting statutes (e.g. CA Insurance Code §1872.4)"]
---

# SIU Referral Procedure and Investigator Routing

The SIU (Special Investigations Unit) takes over claims that the Fraud Handler scores into the `siu-refer` or `siu-priority` bands ([[PAC-FRD-003]]). This document covers the routing decision, regulatory notification requirements, and the handoff back to Claims.

## Referral types and SLA

| Band | Referral mode | SIU response SLA | Adjuster activity |
|---|---|---|---|
| `siu-refer` | Standard ticket. Claim file annotated; SIU investigator picks up from queue. | 5 business days to acknowledge, 30 days to provide finding. | Adjuster continues routine documentation; no payment without SIU clearance. |
| `siu-priority` | Direct page to senior SIU investigator. Claim status moves to "investigation-hold". | 24 hours to acknowledge, 14 days to provide finding. | Adjuster activity suspended on this claim. All policyholder communications routed through SIU. |

In both modes the policyholder is notified per the state's fraud-investigation disclosure rules (varies by state — most require notification within 10 business days of the investigation commencing).

## Investigator selection

The siu-routing agent (`agent.siu-routing`) picks one SIU investigator using priority rules analogous to [[PAC-ROUTE-001]] but specialised for fraud:

1. **Certification fit.** The investigator must hold the state's SIU credential. NAIC's reciprocity covers most states but not all — investigators are scoped per state.
2. **Pattern specialty.** Match investigator specialty to the dominant pattern family ([[PAC-FRD-002]]): frequency-clustering specialists, ring specialists, and sequence-signal specialists handle different caseloads.
3. **Caseload balance.** Among matched investigators, prefer the one with the lowest active-investigation count and the longest time since their last new assignment.
4. **Tenure for siu-priority.** Priority-band cases must go to an investigator with ≥5 years tenure or a documented OEC (Organised Economic Crime) certification.

## Hard exclusions

An investigator is **never** routed when:

- The investigator was on the policyholder's prior claim within the last 24 months (conflict-of-interest concern; protects investigator reputation).
- The investigator is the spouse, immediate relative, or business associate of the claimant (declared in the investigator profile).
- The investigator's state credential has lapsed.

## Handoff back to Claims

When SIU finishes, the finding goes back to Claims through the Decision Journal. The Fraud Handler DW's terminal step records the SIU finding event but does not modify the claim payment status — that's the Settlement DW's job (deferred to v2+).

Possible SIU findings:

- `cleared` — investigation finds no fraud; claim resumes normal workflow.
- `confirmed-fraud` — investigation finds fraud; claim moves to denial workflow (Settlement DW handles denial language).
- `partial-fraud` — investigation finds inflation or staged elements but the underlying loss is real; claim proceeds with adjusted reserves.
- `insufficient-evidence` — investigation closes without a finding; claim resumes with annotation. Re-referral allowed if new evidence surfaces within 90 days.

## Outputs from the siu-routing step

The siu-routing step emits:

- `siuInvestigatorId` — chosen investigator identifier.
- `referralMode` — `standard` | `priority`.
- `routingReason` — narrative naming the certification match, pattern specialty, and caseload.
- `estimatedFindingDate` — derived from SIU response SLA + investigator queue depth.
- `regulatoryNotifications` — list of state notification windows the carrier must honor.

## HITL gates

The siu-routing step should report low confidence (< 0.6) and route to HITL when:

- No in-state SIU investigator carries the required pattern specialty (carrier ops must authorise cross-state SIU loan).
- The lowest-load investigator is at >75% capacity for priority cases.
- Two or more hard-exclusion candidates appear in the top-3 ranked investigators (suggests data-quality issue with the SIU roster; senior reviewer should reconcile).
