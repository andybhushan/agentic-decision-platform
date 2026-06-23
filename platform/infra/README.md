# platform/infra/

Bicep modules for the v0 Azure resource group `rg-adp-v1`. Authored locally; **not yet deployed** (per `feedback_adp_portal_local_first`).

## Files

| File | Resource |
|---|---|
| [`main.bicep`](main.bicep) | Entry point — calls every module |
| [`modules/identity.bicep`](modules/identity.bicep) | 6 user-assigned managed identities (per ADR-0008) |
| [`modules/log-analytics.bicep`](modules/log-analytics.bicep) | Log Analytics workspace + App Insights |
| [`modules/keyvault.bicep`](modules/keyvault.bicep) | Key Vault + RBAC role assignments |
| [`modules/storage.bicep`](modules/storage.bicep) | General storage account (Functions deployment + general use) |
| [`modules/cosmos.bicep`](modules/cosmos.bicep) | Cosmos DB serverless + `dw-state` container (per ADR-0004) |
| [`modules/eventhubs.bicep`](modules/eventhubs.bicep) | Event Hubs namespace + decision bus topic (per ADR-0004) |
| [`modules/eventgrid.bicep`](modules/eventgrid.bicep) | Custom topic for low-volume fan-out |
| [`modules/ai-search.bicep`](modules/ai-search.bicep) | AI Search basic SKU (per ADR-0009) |
| [`modules/container-apps.bicep`](modules/container-apps.bicep) | Container Apps env (apps added D5) |
| [`modules/functions.bicep`](modules/functions.bicep) | Function app on Flex Consumption (.NET isolated 10) |
| [`modules/swa.bicep`](modules/swa.bicep) | Static Web App (console hosting) |
| [`parameters/dev.bicepparam`](parameters/dev.bicepparam) | Dev environment parameters |

## Deferred to D5+

- `signalr.bicep` — SignalR Service for console live tail (D9 stretch per ADR-0006)
- `openai.bicep` reference — `dt-navigator-openai` is existing; will reference via Key Vault secret on D5
- Defender for AI enablement — D9 per ADR-0008
- Container Apps `app` definitions — added on D5 when service container images exist
- Sentinel workspace — v1 per ADR-0008
- Private endpoints — v1 hardening pass

## Lint locally (no deploy)

```powershell
$dotnet = "$env:LOCALAPPDATA\Microsoft\dotnet"; $env:PATH = "$dotnet;$env:PATH"
az bicep build --file main.bicep --stdout > $null
# Exit 0 = lint clean.
```

## Deploy (when explicitly authorised)

```powershell
$rg = 'rg-adp-v1'
az group create --name $rg --location eastus2
az deployment group create --resource-group $rg --template-file main.bicep --parameters parameters/dev.bicepparam
```

**Do not run the deploy command without explicit user signal** ("deploy" / "go live" / "ship it").
