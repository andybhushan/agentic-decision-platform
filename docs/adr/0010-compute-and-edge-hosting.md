# ADR-0010 — Compute and edge hosting

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

L8 of the reference architecture. Decides where each platform workload runs. Five workload kinds in v0:

1. **Aspire-hosted long-running services** — Decision-Ingest, MCP servers, Context Router.
2. **Durable Functions** — FNOL orchestrator (per ADR-0003 / orchestration layer).
3. **Static Web App** — Operator Console.
4. **Foundry-hosted agents** — the 4 FNOL agents (per ADR-0007).
5. **Edge / private deployment** — for the Foundry Local agents (v1+ scope).

Most decisions here are not controversial — Microsoft has a clean answer for each shape. The non-obvious decision is **whether to use AKS at all** in v0, and **how to wire Foundry Local** for future edge scenarios.

## Options considered

### Long-running services

| Option | Pros | Cons |
|---|---|---|
| **Azure Container Apps** | Aspire-native; scale-to-zero; no Kubernetes overhead; managed Dapr if needed | Fewer knobs than AKS |
| AKS managed | Maximum control; CNCF standard | K8s expertise required; cost overhead for v0 scale |
| Azure App Service | Familiar | Less suited to multi-service Aspire pattern |
| Red Hat OpenShift on Azure (ARO) | Enterprise governance; multi-cloud option | Cost; deferred to v1+ if AKS-managed proves insufficient |

### Event-driven workloads

| Option | Pros | Cons |
|---|---|---|
| **Azure Functions (Premium / Flex Consumption)** | Native Durable; cheap; standard pattern | Cold-start on Consumption tier |
| Container Apps Jobs | Co-locates with services | Less idiomatic for short-lived event handlers |

### Console

| Option | Pros | Cons |
|---|---|---|
| **Azure Static Web App** | Free tier covers v0; built-in API integration; deploy from GitHub Actions; matches adp-portal pattern | Some advanced features paywalled |
| Container Apps for the console | Maximum control | Loses the SWA managed deploy + auth conveniences |

### Edge / private

| Option | Pros | Cons |
|---|---|---|
| **Foundry Local** | Microsoft-managed edge runtime; same agent definitions as cloud Foundry; PII/data-sovereign deployments | Limited model catalog vs cloud; v1+ |
| Containerised agents on customer infrastructure | Maximum control | Reinvents Foundry's identity/safety/registry |
| Azure Stack HCI / Azure Local | Full-fat Azure on-premises | Cost; overkill for an agent runtime |

### Heavy compute

| Option | Pros | Cons |
|---|---|---|
| **Azure Databricks** | Industry-standard; matches existing UC2 / DT pattern from `DEPLOYMENT_REFERENCE.md` | Deferred — no v0 workload requires it |
| Azure Synapse | Legacy | Reject |
| Fabric Spark | Native | Deferred — v0 doesn't need Spark; if it does, this is the pick |

## Decision

### v0 placement

| Workload | Host | Why |
|---|---|---|
| Aspire app host (dev) | Local laptop | Aspire dev model |
| Aspire services (prod) | **Container Apps env `cae-adp-v1`** | Aspire-native + scale-to-zero |
| Decision-Ingest service | **Container Apps** | Long-running consumer |
| Context Router service | **Container Apps** | Long-running |
| 5 MCP servers | **Container Apps** (one app each, internal-only ingress) | Long-running tool servers |
| FNOL Durable Function | **Azure Functions, Flex Consumption** | Native Durable; cheap; orchestrator pattern |
| 4 FNOL agents | **Foundry Agent Service** (per ADR-0007) | Already decided |
| Operator Console | **Azure Static Web App `swa-adp-v1-console`** | Standard pattern; matches adp-portal |
| Bicep templates | n/a | Run from `az deployment group create` |

### v1+ door-opens

- **Foundry Local** — when a use case demands edge / private (Meridian air-gap, NYPD private deployment), the agent's `deploymentTarget` in the package switches from `foundry-agent-service` to `foundry-local`. Platform code already supports this via ADR-0007's enum.
- **AKS** — adopted only if Container Apps' constraints bite (custom networking, complex multi-container deployments, etc.). v0 makes no AKS commitment.
- **Red Hat OpenShift on Azure (ARO)** — door open at L10 for customers requiring Red Hat governance. IBM-tech wedge that genuinely wins for some enterprises. Not preempted; not committed.
- **Azure Databricks** — wired in if v0 workload needs heavy compute (model training, feature pipelines, batch enrichment). Mirrors UC2 pattern; reuse pattern locks in well.

## Consequences

- One Container Apps environment hosts all Aspire services in v0 (`cae-adp-v1`). Each service is its own container app within it.
- One Function app for Durable orchestration (`func-adp-v1-fnol`); future packages get their own Function apps to keep blast radius small.
- One SWA for the console.
- Foundry Agent Service hosts the 4 agents (no compute decision needed — it's a managed service).
- All v0 hosting fits in `rg-adp-v1` with no special networking — public endpoints behind Entra; private endpoints land in v1.
- The Foundry Local door (ADR-0007's `deploymentTarget: foundry-local`) lets a future use case target edge without platform changes.

## Trade-offs accepted

- No AKS in v0. Acceptable — Container Apps is the right scale for what we're building, and AKS overhead is real.
- All v0 endpoints public (behind Entra). Acceptable for an internal proving-ground; private endpoints + VNet integration land before any external showcase.
- Databricks deferred. Acceptable — v0 has no Spark workload; the UC2 pattern documents how to plug it in when needed.
- Foundry Local not exercised in v0. Acceptable — the deployment target enum exists in the package schema, so the path is open; v1+ stretch when a real edge case demands it.

## Validation

- `azd up` (or `az deployment group create` against `platform/infra/main.bicep`) brings up the entire v0 RG within 10 minutes.
- All Aspire services come up green on the local dashboard within 30 seconds.
- A package targeting `foundry-local` for an agent passes schema validation (proves the door is real, even if no runtime exercises it in v0).
- Cost dashboard for `rg-adp-v1` stays under $50/day idle.
