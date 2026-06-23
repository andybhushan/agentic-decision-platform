# Event Schema & Taxonomy (alpha) — T070 / issue #112

**Status:** Draft for team review · **Owner:** Data & Semantic (Anand + vibha436) · **Date:** 2026-06-18
**ADR:** 0005 (event-driven) · **Constitution:** Art. VI (event-driven state), Art. VII (explainability), Art. X (PII)
**Target:** `adp-base` · `docs/decisions/` (taxonomy) + `adp-sandbox` · `contracts/events/`

> This reconciles **two event vocabularies** that currently coexist so the platform has **one event backbone, not two**:
> 1. **WS2 `DomainEvent`** (business facts: `FNOLReceived`, `GateTripped`, …) — the existing event-store contract.
> 2. **New `decision.*` taxonomy** (`decision.raised/viewed/disposition`, `agent.step`, `evidence.opened`, `feedback.captured`) from #112, hung off the Decision Store (#90/#91).

## 1. The reconciliation (the key decision)

Per **constitution Article VI** — *"all agent decisions MUST be published as events to the event-store; events are immutable, append-only, and include full decision context; downstream services react to events."*

Therefore the relationship is **source-of-truth vs projection**, not competing stores:

| Tier | Events | Store | Role |
|---|---|---|---|
| **Tier 1 — Domain events (source of truth)** | `FNOLReceived` … `ClaimResolved` + new `ConsentCaptured`, `EvidenceUploaded` | **event-store (Cosmos, append-only)** | The immutable audit/replay spine (Art. VI). |
| **Tier 2 — Decision/UI events (projection + interaction)** | `decision.raised/viewed/disposition`, `agent.step`, `evidence.opened`, `feedback.captured` | **Decision Store (Postgres, #91)** + telemetry (Event Hubs) | Read-model that powers the Decision Queue UI; **derived from Tier 1**, never the primary record. |

**Rule:** a `decision.*` event is a **projection of, or reaction to, a Tier-1 domain event** — it does not replace it. The Decision Store is a queryable read-model built by reacting to the event-store (Art. VI), exactly as the F3/F4 design intends.

## 2. decision.* → DomainEvent origin (mapping)

| Tier-2 event (#112) | Derived from / triggered by (Tier-1) | Notes |
|---|---|---|
| `decision.raised` | `GateTripped`, `CoverageVerified(adverse)`, `EstimateDrafted(total-loss-probable)`, `TriageCompleted(HITL)` | A "decision for the adjuster" is raised when a domain event needs human judgment. |
| `decision.disposition` | `HitlResolved` | Adjuster's approve/override/escalate = the disposition. |
| `decision.viewed` | (UI interaction only) | Pure telemetry → Event Hubs, **not** the audit event-store. |
| `agent.step` | telemetry of the agent action that emitted a Tier-1 event | OTel span; correlates to the domain event it produced. |
| `evidence.opened` | (UI interaction over an `EvidenceRef`) | Telemetry; the durable fact is `EvidenceUploaded` (Tier-1). |
| `feedback.captured` | adjuster feedback on a `decision.disposition` | The #114 labeled-feedback stream. |

## 3. Net-new Tier-1 events (closing the consent/evidence gap)

Added to the canonical catalog (were missing in v0; required by #80 `EvidenceRef` + #112 `evidence.opened`):

| eventType | topic | producedBy | Payload (key fields) | Ontology entities |
|---|---|---|---|---|
| `EvidenceUploaded` | `claims.evidence` | intake-agent / mobile-pwa | evidenceId, type, uri, source, label, piiRedactionApplied | Evidence (new) |
| `ConsentCaptured` | `claims.evidence` | intake-agent / mobile-pwa | consentType, decision, captureChannel, captureActor, evidenceRef | Consent (new) |

New topic `claims.evidence` joins the existing topic map. `Evidence` + `Consent` ontology entities are added in C1 (#9).

## 4. Unified envelope + correlation IDs (#112 AC)

Both tiers share one envelope (`schemas/platform-event.schema.json`), extending the WS2 `DomainEvent` with explicit correlation IDs:

```
eventId          server-assigned (append order)
eventType        Tier-1 PascalCase (FNOLReceived) OR Tier-2 dotted (decision.raised)
tier             "domain" | "decision"
topic            dotted channel (claims.lifecycle, claims.evidence, decision.queue, …)
schemaVersion    contract major version
timestamp        ISO-8601
producedBy       agent/service/UI id
actor            { type: agent|service|human, id, role }     <- who acted
correlation      { claimId, decisionId?, agentId?, correlationId }   <- #112 correlation IDs
payload          validated against the per-eventType payload schema (the seam)
payloadSchemaRef uri-reference into event-payloads
```

- **`claimId`** ties everything to a claim; **`decisionId`** ties Tier-2 events + `HitlResolved` to a raised decision; **`agentId`** ties `agent.step`/domain events to the digital worker that produced them (feeds F9 "Digital Workforce").
- `correlationId` = demo-run/trace key for deterministic replay (carried from WS2).

## 5. PII-aware field policy (#112 AC)

| Class | Rule | Mechanism |
|---|---|---|
| Direct PII (claimant name, phone, address) | **Never** in event payloads; reference by `partyRef` | data minimization (Art. X) |
| Evidence content | **Never** inline; `EvidenceRef.uri` only; `piiRedactionApplied` flag on derived data | #80 EvidenceRef |
| Narrative text | redacted before emission; `piiRedactionApplied: true` | #80 ClaimantNarrative |
| Consent records | retained (audit-grade) but no raw biometric/source content | `ConsentCaptured` |

Events are immutable (Art. VI), so PII must be excluded **before** append — there is no later redaction.

## 6. Acceptance criteria (#112) — status
- [x] Event schema + taxonomy doc (this file + `schemas/platform-event.schema.json`)
- [x] Correlation IDs (claim, decision, agent) — in the envelope `correlation` block
- [x] PII-aware field policy (§5)
- [x] Reconciliation of `decision.*` vs `DomainEvent` (the open §6 question from the snapshot — resolved via Art. VI)
- [ ] Confirm with F3/F4 owners that Decision Store = projection over event-store (one-line ADR note)
- [ ] Publish (Anand pushes)

## 7. Decision recorded
**The event-store (Cosmos, Tier-1) is the single source of truth; the Postgres Decision Store is a read projection (Tier-2).** This should be captured as a one-paragraph amendment/clarification on ADR-0005 (see item D2) so the two-backbone ambiguity is closed in the decision record.
