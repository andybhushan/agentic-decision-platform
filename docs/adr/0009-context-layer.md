# ADR-0009 — Context layer

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

The context layer is what makes an agentic platform actually useful. Agents reason. The context layer is what they reason **with**: business entities, procedural knowledge, regulatory documents, collaboration signals, historical patterns. ICA's "Context Studio" exists for exactly this reason; this is where modern Microsoft has built a platform-grade answer with **Fabric IQ**, **Foundry IQ**, and **Work IQ**.

Three sub-decisions:

1. **Federation / intent routing** — agents ask by intent, the context layer figures out which sources contribute.
2. **Source selection** — which Microsoft IQ services + supporting stores back the federation.
3. **Latency tiering** — hot / warm / cold context paths.

## Options considered

### Federation pattern

| Option | Pros | Cons |
|---|---|---|
| **Intent-router service** (agents call `getContext(intent, dims)`; router federates) | Decouples agents from sources; portable across use cases; matches modern Foundry pattern | One more service to build/operate |
| Direct binding (each agent calls each IQ source explicitly) | No router | Couples agents to sources; every context change ripples through agent code |
| LangChain context-loader pattern | Familiar | Not Microsoft-first; impedance mismatch with Foundry agents |

### Sources

| Source | Role | Status |
|---|---|---|
| **Fabric IQ** | Business entity ontology (Claim, Policy, Policyholder, Vehicle, Adjuster, etc.); the L4 business-data semantic model | **Pick** |
| **Foundry IQ** | Procedural + regulatory knowledge; RAG-ready document corpus; cited responses | **Pick** |
| **Work IQ** | Collaboration context — who's worked on what, what's been said in Teams, calendar context | **Pick** (stubbed in v0) |
| **Azure AI Search** | Vector + hybrid search backbone underneath Foundry IQ | **Pick** |
| **Cosmos DB Gremlin API** | Entity graph for fast lookups across the ontology | **Pick** (deferred to v1 — v0 uses Fabric SQL queries against the entity tables) |
| **Neo4j** (IBM-adjacent via Bob / Engineering+OperationsIQ) | Graph DB | **Reject** — Cosmos Gremlin is the Microsoft-native answer; cleaner |

### Latency tiers

| Tier | Use | Backed by |
|---|---|---|
| **Hot** (< 10ms) | Single-entity lookup that the agent already knows the key of | Redis cache (Azure Cache for Redis Enterprise) in front of Fabric IQ |
| **Warm** (< 200ms) | Multi-source federation | Direct Fabric IQ + Foundry IQ + AI Search calls |
| **Cold** (1–5s) | LLM-planned context assembly | gpt-4o-mini orchestrates a query plan |

## Decision

### Architecture

```text
Agent calls:  contextLayer.GetContext(intent, dimensions, subjectKey)
                                 │
                                 ▼
                         Intent Router
                       (FabricIQ + FoundryIQ + WorkIQ + Search + Cache)
                                 │
        ┌────────────┬───────────┼───────────┬─────────────┐
        ▼            ▼           ▼           ▼             ▼
   Fabric IQ    Foundry IQ    Work IQ   AI Search    Redis Cache
   (entities)   (knowledge)   (collab)  (vectors)    (hot lookups)
```

### v0 deliverables

1. **`platform/src/ContextLayer/`** — .NET class library exposing `IContextRouter` with intent-based `GetContext()` returning a unified `Context` object containing the requested dimensions.
2. **Fabric IQ adapter** — read-only access to a small entity table set (Claim, Policy, Policyholder, Vehicle, Adjuster) in the `adp-v1` Fabric workspace. Seeded from the synthetic claims corpus during deploy.
3. **Foundry IQ adapter** — Foundry Knowledge Base with 5–10 seed documents (Meridian-style policy excerpts, P&C Auto regulatory snippets). AI Search index `srch-adp-v1` backs it.
4. **Work IQ adapter (stub)** — returns empty collaboration context; surface exists, plug-in deferred to v1.
5. **No Cosmos Gremlin in v0** — entity graph queries answered by direct Fabric IQ table queries. Gremlin lands in v1 when query patterns demand it.
6. **No Redis hot cache in v0** — warm-path latency is acceptable. Add Redis when measured cold-start hurts.

### Intent vocabulary

Three intents v0 must satisfy (per FNOL Handler package):

| Intent | Dimensions | Source mix |
|---|---|---|
| `verify_coverage` | entity, procedural, regulatory | FabricIQ + FoundryIQ |
| `triage_decision` | entity, historical, collaboration | FabricIQ + FoundryIQ (historical claims) + WorkIQ (stub) |
| `assign_adjuster` | collaboration, entity, procedural | WorkIQ (stub) + FabricIQ + FoundryIQ |

## Consequences

- `platform/src/ContextLayer/` is a v0 deliverable (D5–D6).
- Fabric workspace `adp-v1` gets a Lakehouse with the entity tables + a Knowledge Base.
- AI Search resource `srch-adp-v1` provisioned in Bicep (D2).
- Foundry IQ knowledge base seeded with 5–10 documents (manual upload acceptable for v0; pipeline lands in v1).
- Provenance tagging at the context-layer level: every fragment returned is tagged GROUNDED (came from authoritative source) or DERIVED (inferred by Foundry IQ at query time).
- Latency budget: warm-path SLA 200ms p95. Measured and alerted on D7.

## Trade-offs accepted

- Cosmos Gremlin deferred — entity-graph queries less efficient in v0 (Fabric SQL is fine at small scale). Acceptable until volume demands it.
- Redis cache deferred — hot-path requests use warm-path latency. Acceptable for v0 demo.
- Work IQ stubbed — collaboration context is empty. Acceptable — Phase 1 use case (FNOL) only marginally needs it; Phase 2 (Damage / Fraud) will demand it.
- Foundry IQ document corpus is tiny in v0 (5–10 docs). Acceptable — proves the pipeline; real Meridian corpus lands when access provides it.

## Validation

- `IContextRouter.GetContext(intent, dims, subjectKey)` returns a `Context` object with non-null entries for requested dimensions (Work IQ may be empty).
- Warm-path latency p95 ≤ 200ms on synthetic data (measured end of D7).
- Every context fragment carries a provenance tag (GROUNDED or DERIVED).
- Adding a new intent to the FNOL Handler package does not require any platform code change (only configuration in the package's `contextBindings`).
