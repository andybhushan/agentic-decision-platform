# ADR-0013 — Foundry Agent Service migration (code ready, RBAC pending)

- **Status:** Code ready; runtime activation gated on RBAC grant
- **Date:** 2026-05-28
- **Deciders:** Anand Bhushan
- **Supersedes:** Implementation portion of ADR-0007 (Agent runtime stack)
- **Superseded by:** —

## Context

The pre-v1 `FoundryAdapter` called Azure OpenAI chat-completions directly via `Azure.AI.OpenAI` SDK with API-key auth. The "Foundry" branding in the class name was aspirational, not accurate — no Foundry Agent Service involvement, no Entra Agent ID per agent.

User flagged this honestly during the IQ-naming discussion (2026-05-28). True "Foundry" means the Azure AI Foundry Agent Service runtime — persistent agents with stable Entra IDs, threads + runs lifecycle, tool registration at agent-creation time, governance hooks (Purview, Defender for AI).

User constraint: zero new model-deployment costs. Solution: reuse the existing `dt-navigator-openai` AOAI account as a Foundry project model connection, rather than re-deploying gpt-4o under a new account.

## Decision

**Migrate `FoundryAdapter` to `Azure.AI.Agents.Persistent` SDK (v1.1.0).** Each `AgentSpec` becomes a persistent Foundry agent (Entra Agent ID). Runs use threads. Auth is AAD-only via `DefaultAzureCredential`. The existing `dt-navigator-openai` is connected as the Foundry project's model source — zero new model-hosting cost.

Implementation completed 2026-05-28. Runtime activation gated on one RBAC grant (see "Activation steps" below) that this account cannot self-perform.

## Implementation

### Azure resources provisioned (ibmalliance subscription)

| Resource | Identifier | Notes |
|---|---|---|
| AIServices account | `ai-adp-v1` (rg-adp-v1, eastus2, S0) | Kind=AIServices (unified Foundry account); system-assigned MI principal `128d1588-…64b0c` |
| Foundry project | `adp-v1` (sub-resource of `ai-adp-v1`) | Endpoint: `https://ai-adp-v1.services.ai.azure.com/api/projects/adp-v1` |
| Model connection | `dt-navigator-aoai` (connection inside project) | Points to existing `dt-navigator-openai` AOAI account; ApiKey auth; gives Foundry agents access to its gpt-4o deployment |

Zero new model deployments — agents reference `gpt-4o` which Foundry resolves via the connection.

### Code changes

| File | Change |
|---|---|
| [platform/src/Agents/FoundryAdapter.cs](platform/src/Agents/FoundryAdapter.cs) | Full rewrite. Uses `PersistentAgentsClient` against Foundry project endpoint. Ensure-create-by-name pattern (`adp-v1-{agentSpec.Id}`) — first invocation per cold instance creates the Foundry agent; subsequent invocations cache the agent ID. Threads created per invocation; tool calls dispatched via RequiresAction. |
| [platform/src/Agents/LegacyOpenAIAdapter.cs](platform/src/Agents/LegacyOpenAIAdapter.cs) | New file (renamed from old `FoundryAdapter.cs`). Direct AOAI chat-completions retained as fallback. |
| [platform/src/Agents/AgentAdapterFactory.cs](platform/src/Agents/AgentAdapterFactory.cs) | New file. Env-var-driven adapter selection: `AGENT_BACKEND=foundry` (or `FOUNDRY_PROJECT_ENDPOINT` present) → FoundryAdapter; `AGENT_BACKEND=legacy` (or AOAI creds present) → LegacyOpenAIAdapter; neither → throw. |
| [platform/src/Agents/Agents.csproj](platform/src/Agents/Agents.csproj) | Added `Azure.AI.Agents.Persistent` 1.1.0 + `Azure.Identity` package refs. NU1701/NU1702 suppressed because the SDK targets net8.0 and we run net10.0 (auto-fallback works; spike validated). |
| [platform/src/TracesApi/Program.cs](platform/src/TracesApi/Program.cs) | DI registration now uses `AgentAdapterFactory.FromEnvironment()` (was `FoundryAdapter.FromEnvironment()`). |
| [platform/src/PackageCompiler/Program.cs](platform/src/PackageCompiler/Program.cs) | Same DI swap in CLI. |

### Activation steps (one-time, requires Owner / User Access Administrator)

The deployer (anand.bhushan@ibmalliance.onmicrosoft.com) is a Contributor on `ai-adp-v1` but lacks `Microsoft.Authorization/roleAssignments/write` at that scope — same limitation as Key Vault role grants in D5b. Two roles need granting once an admin is available:

```powershell
# Grant the deployer Azure AI User on the Foundry account (for local CLI use)
$accountId = (az cognitiveservices account show --name ai-adp-v1 -g rg-adp-v1 --query id -o tsv)
$userObjId = (az ad signed-in-user show --query id -o tsv)
az role assignment create `
  --assignee-object-id $userObjId `
  --assignee-principal-type User `
  --role '53ca6127-db72-4b80-b1b0-d745d6d5456d' `   # Azure AI User
  --scope $accountId

# Grant the Function app's system MI the same role (for cloud runtime)
$funcMI = (az functionapp show -g rg-adp-v1 -n func-adp-v1-fnol --query identity.principalId -o tsv)
az role assignment create `
  --assignee-object-id $funcMI `
  --assignee-principal-type ServicePrincipal `
  --role '53ca6127-db72-4b80-b1b0-d745d6d5456d' `
  --scope $accountId

# Then flip the Function app to Foundry backend
az functionapp config appsettings set -g rg-adp-v1 -n func-adp-v1-fnol `
  --settings AGENT_BACKEND=foundry FOUNDRY_PROJECT_ENDPOINT='https://ai-adp-v1.services.ai.azure.com/api/projects/adp-v1'
```

Until those grants land, the **default cloud backend remains `legacy`** (LegacyOpenAIAdapter). The platform continues to work exactly as before; the Foundry code path is dormant.

Local smoke test attempted 2026-05-28 returned the expected `PermissionDenied` from Foundry:

```
The principal `anand.bhushan@ibmalliance.onmicrosoft.com` lacks the required data action
`Microsoft.CognitiveServices/accounts/AIServices/agents/read` to perform `GET
/api/projects/{projectName}/assistants` operation.
```

Code path validated up to the RBAC layer — the SDK call, AAD token acquisition, and project-endpoint routing all worked correctly; only the data-plane authorization stops execution.

## Consequences

- `FoundryAdapter` is now genuinely Foundry-backed (post-RBAC grant). Each agent is a persistent Foundry agent with an Entra Agent ID. The IQ-naming honesty issue is closed at the Foundry layer.
- `entraAgentId` is captured in the new adapter's `AgentInvocationResult.StructuredFields["foundryAgentId"]`. Propagating it through `TraceStep` + `DecisionEvent` is a v1.1 enhancement; for v1.0 it's in the structured-fields blob.
- `AZURE_OPENAI_API_KEY` is no longer required when `AGENT_BACKEND=foundry`. After role grants land + flip, we can drop the secret from Function app settings entirely (a real security win).
- Tool-calling iteration cap (`MaxToolCallIterations=4` in legacy) becomes `MaxToolRoundtrips=6` in Foundry. The Foundry Agent Service handles the inner loop server-side; we only count outer roundtrips.
- Cold-start cost: first invocation per agent on a cold Function instance pays ~1-2s for `Administration.CreateAgentAsync` (or `GetAgentsAsync` upsert lookup). Warmed = sub-100ms agent resolution.

## Trade-offs accepted

- **One-time RBAC grant blocks self-service activation.** Same pattern as Key Vault (D5b). Documented; defer to admin.
- **SDK targets net8.0; we run net10.0.** NuGet auto-fallback works (spike validated 2026-05-28). NU1701/NU1702 suppressed in Agents.csproj. If SDK 1.2+ adds net10.0 explicit support later, the suppression can be removed.
- **Foundry agent name collisions across deployments are possible.** Names `adp-v1-{agentSpec.Id}` are deterministic. If a different `adp-v1` deployment runs against the same Foundry project, agents from both deployments coexist. Acceptable for v1; v1.1 may add environment-scoped naming `adp-v1-{env}-{agentSpec.Id}`.

## Validation

- ✅ Foundry account `ai-adp-v1` + project `adp-v1` + `dt-navigator-aoai` connection all provisioned in the ibmalliance subscription (rg-adp-v1, eastus2).
- ✅ `Azure.AI.Agents.Persistent` 1.1.0 NuGet package restored + compiled clean on net10.0 (spike + main build both green).
- ✅ `FoundryAdapter` rewritten using `PersistentAgentsClient`, `Administration.CreateAgentAsync`, `Threads.CreateThreadAsync`, `Messages.CreateMessageAsync`, `Runs.CreateRunAsync` + `Runs.SubmitToolOutputsToRunAsync(ThreadRun, IEnumerable<ToolOutput>, CancellationToken)`. All compile clean; no warnings.
- ✅ `AgentAdapterFactory` cleanly routes between Foundry + Legacy by env var.
- 🟡 Local smoke test returned `PermissionDenied` at the data-plane RBAC check — as expected without the role grant. Code path through SDK + AAD + project endpoint validated; only authorization gate remains.
- ⏸ Cloud activation pending two `az role assignment create` commands (documented above) from a principal with `Microsoft.Authorization/roleAssignments/write`.

## Migration plan for the rest of the v1 work

Track 2b (`adpc deploy-agents` subcommand for batch agent provisioning) is now optional — the ensure-create-by-name pattern in the adapter does the same thing lazily on first invocation. Drop Track 2b unless we want pre-warming for cold-start latency reduction.
