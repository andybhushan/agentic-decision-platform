# ADP Platform Foundation (reusable data + semantic layer)

The shared, use-case-agnostic **data & semantic foundation** every ADP use case builds on. Migrated 2026-06-22 from the live-proven WS2 build and de-branded; verified in place.

## Contents

```
platform/foundation/
  contracts/
    schemas/
      domain-event.schema.json      append-only DomainEvent envelope (the audit/replay spine)
      event-payloads.schema.json    per-eventType payloads (the ontology "seam")
      platform-event.schema.json    unified envelope (domain + decision tiers, correlation ids)
      lineage.schema.json           multimodal/derived-event lineage block
    event-taxonomy.alpha.md         the reconciled event taxonomy (domain vs decision.* tiers)
    event-catalog.alpha.md          canonical event catalog
  services/
    data-access/    swappable claim/policy/evidence provider (synthetic now, real later)
    event-bus/      durable, replayable dispatch; swappable transport  [verified: 6/6 tests]
    feedback/       labeled-feedback capture (eval/tuning seed)         [verified: 3/3 tests]
```

## Verified after migration
- `node services/event-bus/bus.test.mjs` → **6/6**
- `node services/feedback/feedback.test.mjs` → **3/3**

## How use cases consume the foundation
- The **event contracts** are shared; each use case validates its `payload` against the ontology-emitted schema (the seam).
- The **services** are generic; a use case configures the data source + topics.
- The **ontology + input contracts are per use case** (claims has `claim/policy/evidence`; banking has `loan/borrower`), under `usecases/<uc>/ontology/`.

## Rewiring TODO (build phase)
- `services/data-access/seed-input-data.mjs` generates claims-shaped input — its schema path points at the use-case input contracts (`usecases/meridian-pnc-auto-claims/ontology/contracts-input/schemas`); wire that path (it's claims-specific, so it may move into the use case).
- Wire the **C# agents** (platform/src) to **consume the Fabric data-agent / ontology-mcp** per the ICA-aligned MCP pattern (ADR-U7).
- Provision a **fresh Fabric workspace + event-store on the DT subscription** (standalone, no shared infrastructure with other engagements).

> Provenance: the Fabric ontology (23 entities incl. the multimodal evidence/consent set), the gold generator, and these contracts/services were proven live before migration. See each use case's `ontology/` + `data/fabric-gold-generator/`.
