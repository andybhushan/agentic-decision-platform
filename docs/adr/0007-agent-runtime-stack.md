# ADR-0007 — Agent runtime stack

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

The agent runtime is the platform's beating heart. Three sub-decisions:

1. **Agent construction SDK** — what does the developer write when they write an agent?
2. **Agent hosting** — where do agents run, how are they identified, how do they discover tools?
3. **Inter-agent protocol** — how do agents talk to each other, and to tools?

Each must be best-in-class. Microsoft has invested heavily in this layer (Agent 365 GA'd 2026-05-01, Agent Framework, Foundry Agent Service, MCP, A2A) — there is no IBM/HashiCorp equivalent that beats it. This is squarely a Microsoft-first decision.

## Options considered

### Agent construction SDK

| Option | Pros | Cons |
|---|---|---|
| **Microsoft Agent Framework SDK** (`Microsoft.Agents.AI`) | Native .NET; integrates with Foundry Agent Service; supports intra-agent graphs; ships with Semantic Kernel under the hood; future-bet of Microsoft | Newer SDK, smaller community than LangChain |
| Semantic Kernel directly | Mature; battle-tested | Lower-level; Agent Framework sits on top of it and is the recommended modern path |
| LangChain / LangGraph | Largest ecosystem; cyclic graphs (good for fraud detection); language-agnostic via Python/JS | Not Microsoft-first; impedance mismatch with Foundry hosting |
| Custom on top of Azure OpenAI SDK | Maximum control | Reinvents what the SDK provides; not defensible |

### Agent hosting

| Option | Pros | Cons |
|---|---|---|
| **Foundry Agent Service** (hosted prompt-agents, workflow-agents, hosted-agents) | Managed identity (Entra Agent ID); content safety; MCP tool catalog; A2A out of the box; co-design with Redmond per kickoff | New service; rough edges expected per Miha |
| Self-host on Container Apps | Maximum control | Reinvents identity, content safety, registration — exactly what Foundry exists to provide |
| Azure OpenAI Assistants API | Familiar | Being deprecated in favour of Foundry Agent Service |

### Inter-agent protocol

| Option | Pros | Cons |
|---|---|---|
| **MCP (Model Context Protocol)** for tools | Anthropic-standard, Microsoft-adopted, Foundry-native; rapidly becoming the universal tool-calling protocol | Spec still maturing |
| **A2A (Agent-to-Agent)** for inter-agent | Microsoft + Google initiative; supported in Foundry; clean handoff semantics | Spec earlier-stage than MCP |
| Custom REST | Familiar | Reinvents what MCP/A2A standardise |
| LangChain agent-as-tool | Works | Not standard; ties us to LangChain |

### Edge / private agents

| Option | Pros | Cons |
|---|---|---|
| **Foundry Local** | Microsoft-managed edge runtime; runs the same Foundry agent definitions on-premises or in air-gapped environments; aligns with Meridian's "their version of Duck Creek" simulation scenario; PII-sensitive deployments | Newer; limited model catalog vs cloud Foundry |
| Self-host containerised agents | Maximum control | Reinvents the wheel |
| Skip edge for v0 | Simplest | Misses a "Microsoft-proud" capability the platform should show |

## Decision

**Agent construction:** **Microsoft Agent Framework SDK** (`Microsoft.Agents.AI`). One-line agent declarations, fluent composition, native Foundry registration. LangGraph reserved for v1 if we hit cyclic-graph use cases the Agent Framework cannot model (the fraud DW is the likely candidate per memory — Chad's architecture repo explicitly lists "IBM Enterprise Advantage (LangGraph)" at L3 Agent Runtime for fraud detection).

**Agent hosting:** **Foundry Agent Service** for all v0 agents. Edge / Foundry Local reserved for v1+ when a use case demands it (Meridian air-gap if it materialises; NYPD private deployment if that becomes the second client zero).

**Inter-agent protocol:**
- **MCP** for agent-to-tool calls. Every tool in an agent package binds to an `mcp://` endpoint.
- **A2A** for agent-to-agent handoffs. The FNOL Handler DW's Initial Triage Agent uses A2A to call the (post-v0) Fraud Investigation DW's Hosted Agent.

**Stack summary:**

```text
Developer writes:  Microsoft Agent Framework SDK (C# fluent API)
Agent runs in:     Foundry Agent Service (cloud) or Foundry Local (edge, v1+)
Agent identity:    Entra Agent ID
Agent registry:    Agent 365
Agent calls tool:  MCP
Agent calls agent: A2A
Inter-DW pause:    Durable Functions (per ADR-0003 / orchestration layer)
```

## Consequences

- `platform/src/Agents/` is a .NET 10 class library that wraps Microsoft Agent Framework SDK; produces `Microsoft.Agents.AI.Agent` instances from `AgentSpec` records in the package model.
- `platform/src/AgentRegistry/` integrates with Agent 365 SDK (stub in v0 — registry writes to local JSON; real Agent 365 registration on D9+).
- `platform/src/MCP/` ships 5 MCP servers (one per tool in the FNOL package): claim-store, policy-store, vehicle-lookup, adjuster-roster, decision-journal. Built on `ModelContextProtocol` .NET package.
- `platform/src/A2A/` adapter ships in v0 as a thin pass-through; actual A2A usage gates on Phase 2 use cases (Fraud DW).
- Confidence calibration thresholds (per package) are evaluated by Agent Framework's response handlers; HITL gates trip via Durable Function-side rule eval.
- Content safety: Foundry Agent Service enforces built-in jailbreak/PII detection; Defender for AI provides higher-level protection (see ADR-0008).

## Trade-offs accepted

- Microsoft-vendor lock-in at L3. Acceptable — Foundry is genuinely best-in-class and the mission is Azure-only. Mitigation: keep the package format vendor-neutral (per ADR-0002) so the agent runtime is replaceable in principle.
- New SDK rough edges. Acceptable — we have direct Foundry team access per kickoff (Sean leading MS requirements gathering).
- LangGraph not in v0. Acceptable — fraud DW is Phase 2 and the decision to add LangGraph then can be a follow-up ADR with concrete evidence.
- Foundry Local not in v0. Acceptable — no edge use case in v0 scope; door open architecturally via `deploymentTarget: "foundry-local"` in the package schema.

## Validation

- Each of the 4 FNOL agents (`agent.claim-intake`, `agent.coverage-verify`, `agent.initial-triage`, `agent.assignment-routing`) successfully registers with Foundry Agent Service.
- Each agent has a distinct Entra Agent ID.
- MCP tool calls from agents work end-to-end (agent → MCP server → backend → response).
- Per-agent content safety blocks an obvious jailbreak prompt in the demo.
- v0 stretch: one A2A handoff demonstrated (FNOL Handler → mock Fraud DW agent that just echoes).
