---
docId: ACL-V1-BINDING
title: Auto Claims Ontology (v2.4) — v1 binding reference
ontologySource: progressive-auto-claims v2.4.0
ontologyNamespace: https://ontology.progressive.example/auto-claims/v2.4.0#
prefix: acl
domain: insurance/auto/ontology
status: v1.1-adopted
---

# Auto Claims Ontology v2.4 — v1 binding reference

This file is the **v1-friendly extract** of the auto-claims ontology v2.4 that sits stranded in `architecture/docs/design/ontology/claims-processing/auto-claims-ontology.md` (status: Published, owner: Claims Data & Platform Engineering, archived repo).

v1 does not replicate the full 30-entity model. It binds against the subset its corpus and Delta tables actually touch, and tags every cited knowledge fragment + every Delta table with the canonical `acl:*` entity name. When the team's `adp-claims` or `adp-sandbox` opens for contributions, this file is the contract v1 already pre-populated against.

## 1. Entity binding map (v1 touches)

| `acl:*` entity | v1 surface | Notes |
|---|---|---|
| `acl:Claim` | `fact_claims` (Fabric Lakehouse) · subject id `CLM-2026-*` | Top-level aggregate. `schemaBinding.primaryEntity.entitySemantics = "acl:Claim"` |
| `acl:Policy` | embedded in `policy` block of `claims-25.json` | Not a separate Delta table in v1 |
| `acl:PolicyTerm` | `policy.effectiveFrom` / `policy.effectiveTo` | Implicit |
| `acl:Coverage` | `policy.coverages[]` | PAC-COV-001 + PAC-COV-002 describe coverage parts and their bindings |
| `acl:LossEvent` | `incident` block on a claim | One claim → one loss event in v1 (no multi-vehicle scenarios) |
| `acl:Vehicle` | `dim_vehicle` (Fabric Lakehouse) · vin | `schemaBinding.secondaryEntity.entitySemantics = "acl:Vehicle"` |
| `acl:VehicleDamage` | DamageReport emitted by `agent.damage-categorize` | Not persisted in v1 — lives in trace step output |
| `acl:Adjuster` | adjuster roster MCP tool (mock) | Routing target on triage / shop assignment |
| `acl:Claimant` | first-party only in v1 (the policyholder) | `dim_policyholder` |
| `acl:Payment` | settlement disbursement step output | Not persisted in v1 |
| `acl:FraudIndicator` | fraud-pattern-scan step output | Indicators inline in trace |
| `acl:SIUReferral` | SIU referral step output (when `gate.priority-fraud-review` opens) | Inline in trace + HITL gate |
| `acl:BodilyInjury` | NOT modelled in v1 | Out of scope (alpha PRD is focused on first-party PD) |
| `acl:Subrogation` | NOT modelled in v1 | Out of scope |

## 2. Controlled vocabulary used by v1

Subsets of §6 in the canonical ontology that v1 actually emits or accepts:

- **`ReportingChannel`** (used in `claim.channel`): `Phone`, `MobileApp`, `Web`, `Agent`. Telematics / IoTCrashDetection (added in v2.4) not yet emitted by the synthetic corpus.
- **`ClaimStatus`** (emitted on FNOL → Damage flow): `Open`, `UnderInvestigation`, `PendingCoverageDecision`, `CoverageDenied`, `InNegotiation`, `PendingPayment`, `Closed`.
- **`CoverageCode`**: `BI`, `PD`, `COLL`, `COMP` (v1's corpus carries these four for the most part; UMBI / UIMBI / MEDPAY / PIP are present in policy structure but not exercised by the demo flows).
- **`LossCause`**: `RearEndCollision`, `HeadOnCollision`, `SideImpact`, `SingleVehicleRollover`, `HitAndRun`, `ParkedVehicleHit`, `AnimalStrike`, `Theft`, `VandalismRiot`, `Hail`, `GlassOnly`.

## 3. Global business rules v1 honours

- **GR-01 (Date integrity).** `incident.incidentDate ≤ claim.fnolReceivedAt ≤ now()`. Enforced implicitly by corpus generation.
- **GR-02 (Coverage applicability).** Coverage verification step (PAC-COV-002) checks that the loss type maps to an active coverage part at DOL.
- **GR-05 (State compliance).** Settlement agent applies state-specific disclosure (PAC-SET-002 — CA Fair Claims Settlement Practices Regulations).
- **R-FRD-001 (Fraud → SIU).** When `gate.priority-fraud-review` opens on the fraud handler, v1 raises HITL for an `SIUReferral` decision.

## 4. Rules v1 does not yet implement

These remain ontology asks for v1.5+:

- **R-CLM-001.** "A claim must have at least one Exposure within 24 hours of FNOL." v1 doesn't yet model Exposure as a separate entity — collapsed into the claim record. Track this for v1.5 schema expansion.
- **R-EXP-001.** "`paidToDate` must not exceed `Coverage.limit` minus applicable deductible." v1's settlement disbursement does check against per-incident limits but doesn't enforce reserve-versus-paid invariants.
- **GR-03 (Reserve adequacy).** Reserves are not yet a runtime concept in v1.
- **GR-06 (PII minimization).** Row-level security predicate per §2.6 R-PTY-001 is not yet enforced — synthetic data only in v1, so the gap is non-blocking.

## 5. How the binding shows up in runtime

- **Knowledge corpus.** Every PAC-* knowledge doc declares `ontologyBindings: [acl:X, acl:Y]` in its front-matter (e.g., PAC-COV-001 binds to `acl:Coverage`, PAC-DAMAGE-001 binds to `acl:VehicleDamage`, PAC-REG-001 binds to `acl:Claim` + `acl:FraudIndicator`). The `LocalFoundryIQSource` and `AzureSearchFoundryIQSource` parse these and forward them on each `ContextFragment`.
- **Trace steps.** `StepRunner` aggregates the distinct ontology entity IDs touched by every cited fragment on a step into `TraceStep.ontologyBindings`. Same pipeline writes them to `DecisionEvent.ontologyBindings` so the Decision Journal records the canonical entity surface of each decision.
- **Schema binding.** Each Meridian package's `digitalWorker.schemaBinding.primaryEntity.entitySemantics` ties the underlying Delta table to its `acl:*` identity (e.g., `fact_claims` → `acl:Claim`, `dim_vehicle` → `acl:Vehicle`). The docs portal renders this mapping.

## 6. Regulatory mapping (companion to ontologyBindings)

PAC-REG-001 / PAC-REG-002 / PAC-FRD-001 / PAC-SET-001 / PAC-SET-002 add a `regulatoryBasis` front-matter array pointing to NAIC AI Model Bulletin paragraphs + CA 10 CCR §2695 sections + FCRA where relevant. The same StepRunner aggregation surfaces these into `TraceStep.regulatoryBasis` and `DecisionEvent.regulatoryBasis`. This closes the explicit ask in the agentic-claims-alpha PRD ("every decision mapped to specific NAIC AI Model Bulletin paragraphs + CA Fair Claims Settlement Practices Regulations sections").

## 7. What this file is not

- Not a contribution to the team's `adp-claims` or `adp-sandbox` repos. Confidentiality constraint per `feedback-adp-v1-confidential` and no-github-pushes rule per `feedback-adp-no-github-pushes` keep this strictly inside v1.
- Not a fork of v2.4. If the team commits ontology changes, v1 follows.
- Not authoritative. The v2.4 file under `repos/architecture/docs/design/ontology/claims-processing/auto-claims-ontology.md` remains the canonical source even though the repo is archived.

## 8. Provenance

- Source ontology: `https://github.com/IBM-Project-Adp/architecture` (archived) · `docs/design/ontology/claims-processing/auto-claims-ontology.md` · v2.4.0 · `Status: Published` · exported 2026-04-14 by Fabric IQ Ontology Export Service.
- v1 adoption: this file + front-matter on PAC-* corpus + `entitySemantics` on Meridian package schemaBindings + StepRunner aggregation + console + docs portal rendering. Landed 2026-06-03 as part of v1.1 patch A.
