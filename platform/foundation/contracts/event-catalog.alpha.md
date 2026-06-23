# Event Catalog v1 (alpha) — agentic-claims-alpha Data Foundation

**Status:** Draft for team sign-off (reconciles the deployed `event-store` stub with the Data/Semantic event catalog)
**Owner:** Data & Semantic (Anand) · **Date:** 2026-06-04 · **ADR:** 0005 (event-driven, service-owned data)
**Companion contracts:** `schemas/domain-event.schema.json`, `schemas/event-payloads.schema.json`, `rules/gate-rules.alpha.json`

> This catalog is the single canonical source for the `DomainEvent` envelope, the event taxonomy, and
> the topic map. It supersedes the example-only enums in `src/services/event-store/openapi.yaml`, which
> were a stub. Two reconciliations are baked in (both flagged for sign-off — see §4).

---

## 1. Canonical identifiers (DECISION — pending Suresh sign-off)

| Concern | Canonical (recommended) | Was in stub | Rationale |
|---|---|---|---|
| `claimId` (= `claim_number`) | `CA-2026-0000123`, pattern `^[A-Z]{2}-\d{4}-\d{7}$` | `CLM-2026-00123` | Matches the ontology + the live `gold_claims` data; one id end-to-end |
| `policyNumber` | `CA-AUTO-2024-7891` (pattern `^[A-Z]{2}-AUTO-\d{4}-\d{4}$`) | same | Already aligned |
| `correlationId` | demo-run key (e.g. `demo-run-001`); drives deterministic replay/reset | same | Keep |
| `eventId` / `sequenceNumber` | server-assigned by event-store (append order) | same | Keep |

**Action:** the three mock services and the event-store stub must switch from `CLM-…` to the `CA-…`
claim id so the data plane, the gold product, and the explainability artifact all key on one value.

---

## 2. Topic map

Cross-service domain events flow on Azure Service Bus topics (ADR-0005). One topic per lifecycle channel:

| Topic | Purpose | Subscribers |
|---|---|---|
| `claims.lifecycle` | Claim open/resolve + claimant comms | event-store, explainability, status-link (Event Grid bridge) |
| `claims.triage` | Triage classification + fraud signal | event-store, explainability |
| `claims.coverage` | Coverage determination | event-store, explainability |
| `claims.estimation` | Damage estimate + total-loss probability | event-store, explainability |
| `claims.hitl` | Gate trips + adjuster resolutions | event-store, explainability, adjuster UI |
| `claims.explainability` | Artifact recorded (rule/ontology versions used) | event-store |

Telemetry (not domain events) flows on **Event Hubs** → Operations Agent. UI notifications (status-link)
flow on **Event Grid**. Durable audit/replay = **event-store** (Cosmos, append-only).

---

## 3. Canonical event catalog (v1)

Envelope = `DomainEvent` (see `schemas/domain-event.schema.json`). `payload` validates against the
per-event schema in `schemas/event-payloads.schema.json` (the ontology seam). `eventType` is PascalCase
past-tense (DDD domain event); `topic` is the dotted channel.

| # | eventType | topic | producedBy | Payload (key fields) | Ontology entities |
|---|---|---|---|---|---|
| 1 | `FNOLReceived` | claims.lifecycle | intake-agent | rawFnolRef, claimantRef, geocode{lat,long}, reportingChannel | LossEvent, LossLocation, Claimant |
| 2 | `ClaimOpened` | claims.lifecycle | intake-agent | claimId, policyNumber, lossDate, structured FNOL | Claim, Policy, PolicyTerm |
| 3 | `TriageCompleted` | claims.triage | triage-agent | confidence(0-1), fraudSignal(clean/flagged/escalate), recommendedPath(STP/HITL) | Claim, FraudIndicator |
| 4 | `CoverageVerified` | claims.coverage | coverage-agent | determination(covered/adverse), deductible, limits, applicableCoverages, citations, adverseDetermination | Coverage, PolicyTerm, Exposure |
| 5 | `EstimateDrafted` | claims.estimation | estimation-agent | repairCostEstimate, actualCashValue, totalLossRatio, totalLossProbability, recommendation, lineItemCount | TotalLossEvaluation, VehicleDamage, Vehicle |
| 6 | `GateTripped` | claims.hitl | gate-engine | gateId(G1..G5), ruleId, ruleVersion, gateType(soft/hard), triggerReason, evidenceRefs[] | (rule registry) |
| 7 | `HitlResolved` | claims.hitl | adjuster-ui | gateId, approver, approverRole, decision(approved/denied/escalate), edits, resolvedAt | Adjuster |
| 8 | `ClaimantNotified` | claims.lifecycle | comms-agent | messageRef, channel(sms/web), postG5ApprovalRef | (none; comm record) |
| 9 | `ExplainabilityRecorded` | claims.explainability | explainability-svc | artifactId, ontologyVersion, ruleVersions[], naicRefs[], caFcsprRefs[] | (artifact) |
| 10 | `ClaimResolved` | claims.lifecycle | demo-orchestrator | resolution, totalCycleMinutes, adjusterTouches | Claim |

**Notes**
- The stub's per-outcome events (`TriageConfirmed`, `CoverageDenialApproved`, `TotalLossApproved`) collapse
  into the generic pair **`GateTripped` + `HitlResolved`** keyed by `gateId`. This keeps all five gates
  on one uniform contract and matches the rule registry. (Reconciliation #2 — see §4.)
- Every payload field is an ontology attribute (or a derived value the ontology defines), so the
  JSON Schema emitted from the wedge ontology *is* the payload validator.

### 3.1 The 405 anchor stream (deterministic; DF-6/DF-7)

```
FNOLReceived → ClaimOpened → TriageCompleted(confidence 0.94, clean, STP)
  → CoverageVerified(covered, deductible 500, adverse=false)
  → EstimateDrafted(repair 6731.55, ACV 9250.00, ratio 0.728, tlProb 0.71, total-loss-probable)
  → GateTripped(G3, hard, ruleId R-TL-001)  → HitlResolved(G3, derek.chen, licensed-adjuster, approved, edit)
  → ClaimantNotified(sms)  → ExplainabilityRecorded  → ClaimResolved(total-loss-approved)
```
`claimId = CA-2026-0000123`, `correlationId = demo-run-001`. Replays byte-identical every run.

---

## 4. Reconciliations baked in (sign-off needed)

1. **Claim id** `CLM-2026-00123` → `CA-2026-0000123` (ontology/gold canonical). → Suresh.
2. **Event taxonomy** — generic `GateTripped`/`HitlResolved` replace per-outcome events; added
   `FNOLReceived`, `EstimateDrafted` (was `EstimateProduced`), `ExplainabilityRecorded`,
   `ClaimantNotified`. → Suresh + Chad.
3. **Envelope** gains `schemaVersion` + `payloadSchemaRef` for versioned, ontology-validated payloads.

## 5. Open items
- G4 (high-value-estimate gate per journey-map) not in this v1 catalog; add a `GateTripped(G4)` path only
  if PM confirms G4 in alpha scope.
- Topic count: 6 here vs 4 in stub; confirm `claims.triage` + `claims.explainability` as first-class topics.
