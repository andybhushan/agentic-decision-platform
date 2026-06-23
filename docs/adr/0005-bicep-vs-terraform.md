# ADR-0005 — Bicep vs Terraform for IaC

- **Status:** Accepted (v0, with named tension)
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

Two signals point in opposite directions:

- The IBM-Project-Adp `architecture` repo's **ADR-002 chose Bicep over Terraform** for the platform IaC. This is the team's accepted direction.
- Miha said in the 2026-05-13 kickoff: *"Automation = best fit. Terraform, Ansible for platform automation. How is our adpd platform going to be built up, automated, torn down, replicated, dehydrated, rehydrated."* The IBM-tech wedge that survived Miha's filter for ADP is **Terraform / Ansible**.

These signals can be reconciled — but only if the reconciliation is explicit, not handwaved.

## Options considered

### Option A — Pure Bicep (match team ADR-002)

- Pros: native Azure; no provider drift; first-class support in Azure Portal / az CLI / Container Apps / Foundry; same artifact ecosystem as the rest of the architecture repo; matches what every Microsoft Reference Architecture sample ships.
- Cons: gives up Miha's stated IBM-tech-wedge entirely; Bicep is Azure-only (matches "non-portable by design" mission, so this is not necessarily a con).

### Option B — Pure Terraform

- Pros: aligns with Miha's automation wedge; portable to multi-cloud (irrelevant here since mission is Azure-only); IBM Consulting has deeper Terraform / Ansible muscle.
- Cons: overrides the team's accepted ADR-002 — politically expensive; Foundry + Aspire + newer Azure services often ship Bicep-first, Terraform provider lags weeks-months; module ecosystem for Container Apps / Foundry Agent Service less mature.

### Option C — Hybrid: Bicep for control-plane resources + Terraform for platform-automation tooling

- Pros: keeps team alignment for the resources Azure manages best (Foundry, Container Apps, Cosmos, Event Grid, Fabric); reserves Terraform for the *automation* layer Miha named — provisioning developer environments, tearing down test rings, dehydrate/rehydrate flows, multi-environment promotion. These really do fit Terraform's strengths better than Bicep's.
- Cons: two IaC systems in one repo — onboarding overhead, two state stores, two CI patterns.

### Option D — Bicep now, Terraform-shaped reconciliation as a future ADR

- Pros: zero v0 risk; preserves Miha's wedge as an open question rather than a closed one; lets the wedge be argued with code (a working Terraform module for some specific automation use case) rather than as opinion.
- Cons: defers the reconciliation. Risk: it never happens and Miha's wedge silently dies.

## Decision

**Option D for v0.** Bicep for all `platform/infra/` resource declarations, matching architecture-repo ADR-002.

**With an explicit deliverable as the reconciliation:** by D9 of this build, produce one Terraform module that does *something* Bicep cannot do well — concretely, a `platform-automation/terraform/` module that handles dev-ring dehydrate/rehydrate (the literal use case Miha named). If the module is genuinely useful, it gets a follow-up ADR that promotes it to the canonical pattern for "platform automation" tasks distinct from "resource declaration."

This is the only way Miha's stated IBM-tech wedge survives contact with the codebase. If we don't actually try Terraform for the thing he named it for, the wedge is rhetoric.

## Consequences

- `platform/infra/*.bicep` is the v0 IaC. Modules: Cosmos, Event Grid, Container Apps env, Function app, Fabric workspace reference (Fabric is portal-managed, Bicep references not creates), Storage, SWA.
- `platform-automation/terraform/dev-ring/` is created on D9 with one working module for ring dehydrate/rehydrate.
- A follow-up ADR (0009 or later) is scheduled if and only if the D9 module proves out — no preemptive policy.
- Boundary check (ADR-0001) does not need to change — `platform-automation/` is sibling to `platform/`, not under it.

## Trade-offs accepted

- Two IaC systems in the repo eventually. Acceptable because they serve different concerns (declare vs orchestrate-automation).
- If the D9 Terraform module is a dud, this ADR is the record that "we tried." The wedge dies on evidence, not on absence.
- Architecture-repo ADR-002's reasoning (Azure-native, fast-moving services, Foundry tooling parity) remains valid for resource declaration. We honour it.

## Validation

- `az deployment group create` brings up the v0 RG from `platform/infra/main.bicep` in under 5 minutes.
- D9 Terraform module successfully tears down and restands the dev ring.
- If the Terraform module is genuinely useful, propose ADR-0009 to formalise.
