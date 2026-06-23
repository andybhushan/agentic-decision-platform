# ADR-0004 — State, decision bus, and trace stores

- **Status:** Accepted (revised)
- **Date:** 2026-05-26 (revised)
- **Deciders:** Anand Bhushan
- **Supersedes:** prior draft (Event Grid for bus, Bronze for trace)
- **Superseded by:** —

## Context

Three persistence concerns, must stay separate:

1. **Digital Worker state** — per-DW, per-subject, mid-flight orchestration state. Hot read-write. Days-long retention.
2. **Decision bus** — append-only stream of every agent decision, tagged with provenance, consumed by Decision-Ingest, the console live view, and any downstream analytics.
3. **Trace store** — durable record for live query (sub-second), audit (years), and calibration retraining.

Each needs the BEST tool. Re-examining without the "match PDF" constraint:

## State store

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cosmos DB** | Multi-region; partition-keyed; change feed for event sourcing; native Foundry + Functions integration | Eventual consistency surprises; per-RU cost ramp | **Pick** |
| Postgres on Azure | Familiar; ACID; cheap | No partition-key model; multi-region adds complexity | Reject |
| Fabric SQL endpoint | Co-located with data substrate | Not designed for mid-flight hot state | Reject |
| Azure Table Storage | Cheap | Limited query model | Reject |

## Decision bus

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Azure Event Hubs (Kafka API)** | High-throughput; Kafka-protocol compatible (Confluent skills transfer); ordering per partition; Fabric Eventstream subscribes natively; replay window | Slightly more complex than Event Grid; not free-tier | **Pick (primary bus)** |
| Event Grid | Cheap; native pub/sub; Foundry integrates | At-least-once with no ordering; no replay; not the right tool for a decision *stream* | Pick (secondary fan-out only) |
| Service Bus | Sessions, dead-letter, FIFO | Heavier per-message cost; overkill for decision events | Reject |
| Confluent Kafka (IBM-tech wedge) | Stream-native; replay; multi-cloud | Operational complexity; Confluent is now the lever IBM uses for hybrid integration scenarios | **Door open** for v1 if scale demands cross-system streaming (e.g. Meridian's Duck Creek event feed into ADP) |

## Trace store

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Fabric Real-Time Intelligence (KQL eventhouse)** | Designed for high-volume event/trace storage; KQL queries are sub-second on millions of rows; native Event Hubs ingestion; partition by stream | New service (came out 2025-Q4); KQL learning curve | **Pick (live trace + recent analytics)** |
| Application Insights | Live trace native; built-in retention | Schema-on-write; aggressive sampling at scale; tech-telemetry semantic, not business | Use for L8 infra telemetry only |
| Fabric Bronze/Silver/Gold medallion | Cheap; replay-friendly; analytics-ready | Latency Bronze → Silver in minutes; not for live tail | **Pick (cold audit + 30+ day analytics)** |
| Cosmos with TTL | Hot reads | Cost at scale; not analytics-friendly | Reject |

## Decision

For v0:

### State
- **Cosmos DB.** Account `cdb-adp-v1`. Container `dw-state` partitioned by `subjectId` (claim ID for FNOL Handler; will be different per use case but always the natural-key of the subject the DW operates on).
- Change feed wired to Event Hubs (D6+) — when DW state changes, an event fires automatically.

### Decision bus
- **Azure Event Hubs, Kafka API.** Namespace `evh-adp-v1`. Topic `adp-v1-decisions`. Partitioned by `digitalWorkerId`. Retention 7 days (replay window).
- **Event Grid** still in the picture for low-volume console fan-out (HITL gate opened, trace complete) — different concern from the decision stream.

### Trace store
- **Two-tier:** Fabric Real-Time Intelligence (RTI) for live + 30-day, Bronze/Silver/Gold for cold + analytics.
- RTI eventhouse `adp-rti` with table `decisions`. Ingested directly from Event Hubs via Fabric Eventstream.
- Bronze table `adp.bronze.decisions` populated nightly from RTI via Fabric pipeline. Silver/Gold conformations on D7+.
- The **console reads live from RTI** (sub-second KQL); audit queries go against Silver/Gold.

### Where Confluent (IBM-tech) fits

Door open, not pre-empted: when v1 needs cross-system streaming (Meridian Duck Creek event feed → ADP Event Hubs, or ADP decisions → IBM watsonx.data lake), Confluent Cloud is the right bridge. v0 does not need it.

## Consequences

- Four Azure resources in v0 for these concerns: Cosmos account, Event Hubs namespace, Event Grid topic, Fabric workspace (with RTI eventhouse + Bronze table).
- **Decision-Ingest service** is a small Functions app subscribed to Event Hubs that writes both to RTI (live) and triggers downstream consumers. One of v0's runtime workloads.
- Console subscribes via SignalR (D9 stretch) that's backed by an Event Hubs consumer group.
- Schema for `decisions` defined in `platform/src/DecisionIngest/Schemas/Decision.cs` on D6.
- Idempotency enforced at Decision-Ingest via `decisionId` (per-event UUID) before the RTI insert.

## Trade-offs accepted

- Cosmos cost ramps with sustained writes. Mitigated by partition discipline + TTL on terminal states + change feed (no double-writes for events).
- Event Hubs is not free. Acceptable — the platform's primary nervous system is worth its cost.
- RTI is new. The KQL learning curve is real. Mitigation: `platform/src/Tools/RtiQueryHelpers/` ships a handful of canned queries the console + audit users invoke by name.
- Two trace tiers (RTI hot + Medallion cold) means two schemas. Mitigation: RTI schema mirrors Bronze schema column-for-column; the pipeline is a flat copy.

## Validation

- A claim flowing through FNOL Handler emits 4+ decision events → all 4 land in Event Hubs within 1s → all 4 visible in RTI within 5s → all 4 visible in Bronze within 24h.
- Re-emitting a duplicate decision (at-least-once delivery) does not produce duplicates in RTI — idempotency holds via `decisionId`.
- Cosmos DW state at end-of-claim matches Event Hubs decision log for the same claim (cross-checked end of D7).
- KQL query against RTI returns the full trace for one claim in under 200ms (validated end of D8).
