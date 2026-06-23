# Claim & Policy Data Contract (alpha) — T011 / issue #80

**Status:** Draft for team review · **Owner:** Data & Semantic (Anand + vibha436) · **Date:** 2026-06-18
**ADR:** 0005 (event-driven, service-owned data), 0006 (Fabric IQ ontology) · **Constitution:** Art. IV (tools/contracts), Art. X (PII minimization)
**Target:** `adp-sandbox` · `docs/design/data-semantic-layer/contracts/input/`

> This is the **canonical input contract** the triage/coverage agents consume — the read-only `Policy` + `Claim` (FNOL) data, **not** a domain event. It is the upstream half of the convergence seam: the structured fields defined here are exactly the inputs that later produce the `FNOLReceived` / `ClaimOpened` domain events (`event-catalog.alpha.md`). One id (`CA-…`) flows from this contract through the events into `gold_claims` and the Fabric IQ ontology.

---

## 1. Why this exists (the gap it closes)

Issue #80 asks for "the canonical input schema the triage agent consumes." The WS2 pack already had the **event/payload** contract (`domain-event.schema.json` + `event-payloads.schema.json`); what was missing was the **input** contract for the static `Policy` and the submitted `Claim`/FNOL. This file adds it, reusing the same ontology bindings, `money`/`coverageCode` defs, and id patterns so the input and event contracts cannot drift.

It also adds the two things #80/#112 newly require and the v0 catalog did not model:
- **`EvidenceRef`** — multimodal evidence (photo/video/document/dashcam/blackbox/voice-transcript) as a first-class reference.
- **`consent`** — audit-grade consent on evidence (dashcam/blackbox), required by constitution Art. X + CA FCSPR. (Surfaced earlier from the mvp-demo FNOL mobile contract.)

## 2. Schemas (this deliverable)

| Entity | File | Ontology binding | Notes |
|---|---|---|---|
| `Policy` | `schemas/policy.schema.json` | Policy, PolicyTerm, Coverage, Vehicle | coverages/exclusions/endorsements/insured vehicles; `policyNumber ^[A-Z]{2}-AUTO-\d{4}-\d{4}$` |
| `Claim` | `schemas/claim.schema.json` | Claim, LossEvent, LossLocation, Claimant, Vehicle | composes narrative + evidence; `claimId ^[A-Z]{2}-\d{4}-\d{7}$`; `lossType` ∈ {FirstPartyCollision, TheftRecovery, HitAndRun, MultiVehicle} |
| `ClaimantNarrative` | `schemas/claimant-narrative.schema.json` | Claimant statement | channel-agnostic; `segments` carry voice transcript (spike A1); advisory `extractedSignals` |
| `EvidenceRef` | `schemas/evidence-ref.schema.json` | Evidence (new), Consent (new) | multimodal + first-class `consent`; PII-minimized (ref only, never raw payload) |

## 3. Sub-type samples (this deliverable)

One realistic `{policy, claim}` pair per alpha sub-type, all schema-valid:

| Sub-type | File | claimId | Highlight |
|---|---|---|---|
| First-Party Collision | `samples/first-party-collision.sample.json` | `CA-2026-0000123` | **the anchor** — drives the G3 total-loss gate; dashcam consent granted |
| Theft Recovery | `samples/theft-recovery.sample.json` | `CA-2026-0000457` | COMP path; police report evidence |
| Hit & Run | `samples/hit-and-run.sample.json` | `CA-2026-0000688` | unknown third party; voice-transcript narrative + recording consent |
| Multi-Vehicle | `samples/multi-vehicle.sample.json` | `CA-2026-0000931` | injury reported; blackbox telemetry + consent; liability-split context |

## 4. How it threads to the rest of the lane

```
Policy + Claim (THIS contract)                  <- T013 data-access layer (#82) serves these
        |  intake/triage agent reads
        v
FNOLReceived / ClaimOpened domain events        <- event-catalog.alpha.md (#112)
        |  event-store validates payload (seam)
        v
gold_claims  +  Fabric IQ claims_ontology        <- semantic layer (#9/#10)
```

- **`EvidenceRef.type`** values (photo/video/document/voice-transcript) are the same modalities as sandbox spikes **A2/A3/A4/A1**; **D1 (#9)** will add the matching ontology entities, and **X1 (#11)** the lineage events.
- **`consent`** becomes a `ConsentCaptured` domain event + a `Consent` ontology entity in B/C items (the EvidenceRef shape here is the source of truth for both).

## 5. Conventions honored
- Reuses WS2 `money` / `coverageCode` / `geocode` defs and the canonical id patterns (no drift vs the event contract).
- `additionalProperties: false` everywhere (strict, matches WS2 schemas).
- PII minimization (Art. X): the agent receives evidence **refs + metadata**, never raw content; `piiRedactionApplied` flags derived data.
- Draft-2020-12 JSON Schema (matches the existing WS2 schemas).

## 6. Acceptance criteria (#80) — status
- [x] JSON Schema for `Policy`, `Claim`, `ClaimantNarrative`, `EvidenceRef`
- [x] One realistic sample per sub-type (First Party, Theft Recovery, Hit & Run, Multi-Vehicle)
- [x] Schema versioned (`/v1/input/…` `$id`) and documented (this file)
- [x] Validation harness proving samples conform (`validate.mjs`)
- [ ] Review with claims SME
- [ ] Publish to repo `/contracts` (Anand pushes)

## 7. Open questions for the team
1. Do `Policy`/`Claim` belong in the shared `AgenticClaimsAlpha.Models` project (constitution Art. IV) as generated types, or stay schema-first here? (Recommend schema-first → codegen.)
2. Confirm `lossType` enum is the full alpha set (any BI-only or glass-only sub-types in scope?).
3. Confirm `consent` belongs on `EvidenceRef` vs a standalone consent store keyed by claim (recommend: on the ref, plus a `ConsentCaptured` event for the audit trail).
