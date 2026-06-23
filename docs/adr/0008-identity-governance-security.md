# ADR-0008 — Identity, governance, security

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

Identity, governance, and security at L1 of the reference architecture. This is the layer enterprise buyers (and Mohamad, Varun, Chris McGuire, Microsoft alliance partners) scrutinise hardest. A platform that runs agents without verifiable identity, content-safety guarantees, lineage tracking, and SOC visibility is unsellable. Get it right at v0; do not bolt on later.

Microsoft has the strongest stack in the industry for this — Entra ID, Entra Agent ID, Defender for AI, Defender for Cloud, Purview, Sentinel. There is no IBM/HashiCorp combination that beats it on the Azure-only mission. This is squarely Microsoft-first.

(Door left open at L10 for HashiCorp Vault if a hybrid-secrets use case ever appears.)

## Options considered

### Identity

| Concern | Pick | Why |
|---|---|---|
| **Human identity** | Entra ID | Default, no alternative |
| **Service principal identity** | Entra Managed Identity | Default |
| **Agent identity** | **Entra Agent ID** | New for Agent 365 (2026-05-01 GA); each agent gets a distinct, governable identity |
| **Tool / MCP server identity** | Entra Workload Identity | Same identity plane as agents |
| **Cross-tenant federation (Meridian integration)** | Entra B2B + cross-tenant access policies | Standard Azure pattern |

### Content safety / model security

| Concern | Pick | Why |
|---|---|---|
| **In-flight prompt safety** | Foundry Agent Service built-in safety + **Microsoft Defender for AI** | Built-in: jailbreak / PII detection on every prompt. Defender for AI: tenant-wide prompt-injection telemetry, exfil detection, model-theft monitoring |
| **Output filtering** | Foundry safety filters + Defender for AI | Same |
| **Model abuse detection** | Defender for AI | Tracks unusual model usage patterns per agent |

### Data governance

| Concern | Pick | Why |
|---|---|---|
| **Data classification** | **Microsoft Purview** | Auto-classifies PII (claim narratives, policyholder data) in Fabric + Cosmos; sensitivity labels propagate |
| **Lineage** | Purview | Decision → agent → tool → backend traced automatically |
| **DLP** | Purview + Defender for Cloud | Blocks sensitive data egress |

### SIEM / SOC

| Concern | Pick | Why |
|---|---|---|
| **Security events** | **Microsoft Sentinel** | All Defender + Entra + Foundry signals land here; analytics rules + playbooks |
| **Resource posture** | Defender for Cloud | Azure-native CSPM |

### Secrets

| Concern | Pick | Why |
|---|---|---|
| **Azure secrets** | **Azure Key Vault** | Default. References from Container Apps + Functions via managed identity |
| **Hybrid / multi-cloud secrets** (door open) | HashiCorp Vault | Reserved for v1+ if cross-cloud secret use case appears. IBM-tech wedge that genuinely wins for hybrid |

## Decision

**Layered approach. v0 deliverables, with progressive enablement:**

- **D2–D5:** Bicep wires up:
  - Entra Managed Identity for the Function app, Container Apps env, Static Web App, Decision-Ingest service.
  - Key Vault for Azure OpenAI keys, Cosmos connection string, Event Hubs connection string. (gpt-4o key is the only real secret pre-existing; Key Vault `kv-adp-v1` references back to `dt-navigator-openai`.)
  - Entra Agent ID provisioning stub (full Agent 365 registration on D9+).
- **D6–D9:** Foundry agents register with distinct Entra Agent IDs. MCP tools authenticate via Entra Workload Identity to their backends.
- **D9+:** Purview wired to Fabric workspace; sensitivity labels applied to Bronze tables. Defender for AI enabled on the Foundry resource.
- **v1:** Sentinel ingests Defender + Foundry logs; analytics rules + alert playbooks; SOC handoff defined.

**Specific principles:**

1. **No shared service principals.** Every workload (4 agents + 5 MCP tools + 1 orchestrator + 1 ingest service + 1 console) has its own identity.
2. **No secrets in code, env vars only via Key Vault references** at deploy time.
3. **Every decision in the journal is signed by the agent's Entra Agent ID** (post-D9 when real registration lands; v0 stubs a placeholder ID).
4. **Purview sensitivity labels propagate** — a claim tagged "PII / personal" in Bronze must keep that label across Silver, Gold, and RTI.

## Consequences

- 11 distinct identities in v0 (4 agents + 5 tools + orchestrator + ingest). Bicep provisions all.
- Key Vault is in the critical path of every workload start. Acceptable — sub-second resolve.
- Purview ingest of the Fabric workspace adds an automatic dependency; classification rules need to be authored on D9 (one task).
- Defender for AI subscription required on the Foundry resource (cost line item).
- Sentinel workspace deferred to v1; v0 logs to Log Analytics (the Sentinel ingestion source).

## Trade-offs accepted

- Microsoft governance lock-in at L1. Acceptable — best-in-class for Azure-only; the door at L10 for HashiCorp Vault remains open for hybrid scenarios.
- Defender for AI is paid; cost line item. Acceptable — security is not where v0 saves money.
- 11 identities is operational overhead. Mitigated by Bicep modules + Entra Workload Identity Federation (no client secrets stored).
- Sentinel deferred to v1. Acceptable — Log Analytics captures the same signals; Sentinel adds the SIEM correlation layer which v0 demos don't need yet.

## Validation

- Each agent and tool has a distinct Entra principal observable in Azure Portal.
- A jailbreak prompt to any agent is blocked by Foundry safety; the block lands in Log Analytics + Defender for AI dashboard.
- A synthetic claim's PII fields are classified by Purview within 1 hour of landing in Bronze.
- Deleting Key Vault `kv-adp-v1` halts the platform (proves no embedded secrets exist).
- No agent can access a tool it does not have Entra permission for (verified by attempting the negative case end of D9).
