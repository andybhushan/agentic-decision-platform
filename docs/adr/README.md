# Architecture Decision Records

Lightweight ADRs for adp-v1. Each ADR captures one substantive decision, the options considered, and the trade-offs accepted — so future-anyone can understand *why*, not just *what*.

## Guiding principle

**Microsoft-first where Microsoft is genuinely best. IBM / Red Hat / HashiCorp where they are genuinely best. Every choice defensible on technical merit.**

The platform is Azure-only by mission; lock-in at L1/L3/L5/L7 to Microsoft is acceptable and earned (Foundry, Agent 365, Fabric IQ, Entra Agent ID, Defender for AI have no equivalent). L9 (IaC + automation) is where HashiCorp / Red Hat genuinely win for certain concerns. L10 keeps the door open for hybrid integration tech (Confluent, Vault, ARO, watsonx.data) when v1+ scenarios demand it.

## Index

| ID | Decision | Status |
|---|---|---|
| [0001](0001-platform-usecase-boundary.md) | Platform vs use case boundary (folder split + CI check) | Accepted |
| [0002](0002-ea-package-format.md) | Agent package format — Typed C# DSL → JSON Schema artifact | Accepted (v1) |
| [0003](0003-compile-pipeline-shape.md) | Compile pipeline as a standalone CLI (`adpc`) | Accepted |
| [0004](0004-state-decision-bus-trace-stores.md) | Cosmos (state) + Event Hubs Kafka API (bus) + RTI + medallion (trace) | Accepted (revised) |
| [0005](0005-bicep-vs-terraform.md) | Bicep for resources; HashiCorp Terraform for ring automation (D9) | Accepted |
| [0006](0006-console-framework-and-state-contract.md) | Vite + React + Fluent v9; REST + SignalR phased D7–D9 | Accepted |
| [0007](0007-agent-runtime-stack.md) | MS Agent Framework + Foundry Agent Service + Agent 365 + MCP + A2A | Accepted |
| [0008](0008-identity-governance-security.md) | Entra Agent ID + Defender for AI + Purview + (Sentinel v1) | Accepted |
| [0009](0009-context-layer.md) | Fabric IQ + Foundry IQ + Work IQ (stub) + AI Search; Cosmos Gremlin v1 | Accepted |
| [0010](0010-compute-and-edge-hosting.md) | Container Apps + Functions + SWA; Foundry Local door-open for v1 edge | Accepted |
| [0011](0011-semantic-layer-sql-now-fabric-later.md) | Semantic layer: Azure SQL for v0, Fabric Lakehouse for v1 (same `IContextSource` contract) | Accepted; v0 + v1 both implemented |
| [0012](0012-work-iq-synthetic-now-graph-later.md) | Work IQ: synthetic-but-deterministic v0, Microsoft Graph v1 (same `IContextSource` contract) | Accepted; v0 implemented |

## Where IBM / Red Hat / HashiCorp tech is committed for v0

| Tech | Where | Rationale |
|---|---|---|
| **HashiCorp Terraform** | D9 ring automation module (ADR-0005) | Genuinely better than Bicep for dehydrate/rehydrate + cross-environment orchestration |

## Where IBM / Red Hat / HashiCorp tech is door-open for v1+

| Tech | Where it would fit | When to revisit |
|---|---|---|
| **Confluent Kafka** | L6 decision bus (alternative to Event Hubs) | If cross-system streaming volume (e.g. Meridian Duck Creek event feed) demands it |
| **HashiCorp Vault** | L1 secrets (alternative to Key Vault) | If hybrid-cloud secret use case appears |
| **Red Hat OpenShift on Azure (ARO)** | L8 compute (alternative to Container Apps / AKS) | If a customer requires Red Hat governance |
| **Red Hat Ansible** | L9 config management | If VM / edge config emerges as a real concern |
| **IBM watsonx.data** | L10 hybrid analytics | If customer needs cross-cloud data lake federation |

## Format

Each ADR follows: Context · Options · Decision · Consequences · Trade-offs accepted · Validation.

ADRs are written **before** the corresponding code lands, not as backfill. If a future change violates an ADR, write a new ADR that supersedes it — never silently drift. The supersedes / superseded-by chain is the audit trail.
