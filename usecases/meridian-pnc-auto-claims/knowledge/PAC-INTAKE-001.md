---
docId: PAC-INTAKE-001
title: FNOL Intake — Field Extraction Standards
dimensions: [procedural, entity]
domain: insurance/auto/fnol
ontologyBindings: [acl:Claim, acl:LossEvent, acl:Vehicle, acl:Claimant]
---

# FNOL Intake — Field Extraction Standards

The Claim Intake agent normalises the policyholder's first-notice-of-loss submission into the Claim entity. This document defines the fields, their sources, and the confidence rules.

## Required fields

| Field | Source signals | Notes |
|---|---|---|
| `claimNumber` | System-generated; never extracted | Format: CLM-YYYY-NNNNN |
| `policyholderId` | Policy lookup by authenticated channel | If channel is `phone-csr`, CSR must confirm |
| `policyNumber` | Policyholder lookup | Must be active on incident date |
| `incidentDate` | Narrative + claimant statement | If conflicting, request explicit confirmation |
| `incidentType` | Narrative semantic classification | One of the values from [[PAC-COV-001]] |
| `vehicleVin` | Policy lookup + claimant confirmation | If multiple vehicles on policy, must disambiguate |
| `narrative` | Claimant submission | Verbatim; do not summarise into this field |

## Optional but recommended fields

- `photosAttached` — count and reference IDs.
- `policeReportFiled` — boolean; required for intersection and hit-and-run incidents.
- `thirdPartyInvolved` — boolean; if true, third-party contact info should be solicited.
- `injuries` — boolean and brief description; triggers medical-payments coverage check.

## Confidence rules

The intake step's confidence is the minimum across per-field confidences. Per-field rules:

- A field extracted unambiguously from a structured submission (form fields filled in) → 0.95.
- A field inferred from free-text narrative with one clear signal → 0.85.
- A field that required reconciling two narrative signals → 0.75.
- A field with a missing signal but resolvable from policy lookup → 0.70.
- A field with conflicting signals (narrative vs structured input) → 0.50, flagged for human review.

## Common patterns to flag

- Narrative mentions "low speed" but vehicle photos show airbag deployment → severity-hint conflict (flag for triage attention).
- Date in narrative differs from system-recorded `fnolReceivedAt` by more than 7 days → late reporting (see [[PAC-FRD-001]]).
- Channel is `mobile-app` but no GPS coordinates attached → reduce intake confidence to 0.70.
