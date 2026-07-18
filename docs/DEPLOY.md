# Deployment Runbook — v0

This document describes the local-to-cloud deploy path for adp-v1.

> **Never** auto-deploy. The exact commands below are run only on explicit user signal ("deploy", "go live", "ship it").

## Subscription + region

| Setting | Value |
|---|---|
| Subscription | Project-IBMMSOFFERINGSPOC (`5aaa5efd-2544-456c-964e-4d8627d6a0b8`) |
| Tenant | `740bc3aa-5daf-42f6-939a-b2d007a60d26` (ibmalliance.onmicrosoft.com) |
| Region | `eastus2` |
| Resource group | `rg-adp-v1` |

## D5b initial deploy — LIVE 2026-05-26

Deployment `adp-v1-bootstrap-retry` succeeded. 18 resources provisioned.

| Resource | Name | Endpoint / Region |
|---|---|---|
| Resource group | `rg-adp-v1` | eastus2 |
| Log Analytics | `log-adp-v1` | eastus2 |
| Application Insights | `appi-adp-v1` | eastus2 |
| Key Vault | `kv-adp-v1` | https://kv-adp-v1.vault.azure.net/ |
| Storage account | `stadpv1` | eastus2 |
| Cosmos DB | `cdb-adp-v1` | https://cdb-adp-v1.documents.azure.com:443/ |
| Event Hubs namespace | `evh-adp-v1` | eastus2 (Kafka API enabled) |
| Event Hubs topic | `adp-v1-decisions` | partitions=4, retention=7d |
| Event Grid topic | `egt-adp-v1-fanout` | https://egt-adp-v1-fanout.eastus2-1.eventgrid.azure.net/api/events |
| AI Search | `srch-adp-v1` | **eastus** (eastus2 was out of capacity) — https://srch-adp-v1.search.windows.net |
| Container Apps env | `cae-adp-v1` | eastus2 |
| Function plan | `plan-adp-v1-fnol` | FC1 (Flex Consumption) |
| Function app | `func-adp-v1-fnol` | .NET isolated 10.0 |
| Static Web App | `swa-adp-v1-console` | Free tier |
| (reused) Azure OpenAI | `dt-navigator-openai` | https://dt-navigator-openai.openai.azure.com/ |

## Post-deploy role grants (manual, run with Owner privileges)

The original Bicep tried to grant Key Vault Secrets User to each workload identity, but the deploying account doesn't hold `Microsoft.Authorization/roleAssignments/write` at that scope. **Granting these is required before any workload can read secrets from Key Vault.** Run these once an account with `Owner` or `User Access Administrator` is available:

```powershell
$rg = 'rg-adp-v1'
$vaultId = (az keyvault show --name kv-adp-v1 --resource-group $rg --query id -o tsv)
$secretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6'
$workloads = @('orchestrator','decision-ingest','context-router','mcp-claim-store','mcp-policy-store','console-api')
foreach ($w in $workloads) {
    $pid = (az identity show --name "id-adp-v1-$w" --resource-group $rg --query principalId -o tsv)
    az role assignment create --assignee-object-id $pid --assignee-principal-type ServicePrincipal --role $secretsUserRole --scope $vaultId
}
```

If you can't get the role grant done, workloads can read AOAI / Cosmos creds from env vars (the `adpc` pattern we already use for local). The vault becomes useful when the Container Apps services land in D6+.

## Known deltas from the original Bicep

1. **Cosmos API version pinned to `2024-05-15`** (not `2024-12-01-preview`). The newer preview removed `EnableServerless` capability in favour of `CapacityMode`. The older stable API still works and is more conservative.
2. **AI Search lives in `eastus` not `eastus2`.** `eastus2` returned `InsufficientResourcesAvailable` for basic-SKU AI Search on the deploy attempt. Cross-region resources within one RG are fine.
3. **Key Vault role assignments omitted from Bicep.** See "Post-deploy role grants" above.

## Decision journal pipeline (D7b — live)

```text
adpc execute --publish-decisions
  ↓
Event Hubs `adp-v1-decisions`  (Kafka API, partition key = digitalWorkerId, retention 7d)
  ↓ consumer-group "decision-ingest"
adpc ingest --max-events N --timeout S
  ↓
Cosmos `adp.dw-state`  (partition key /subjectId, id = traceId/stepId, idempotent)
  ↓ (read)
adpc show-state --subject <id>
```

### Required env vars

```powershell
$env:AZURE_OPENAI_ENDPOINT      = az cognitiveservices account show --name dt-navigator-openai --resource-group rg-microsoft-navigator --query properties.endpoint -o tsv
$env:AZURE_OPENAI_API_KEY       = az cognitiveservices account keys list --name dt-navigator-openai --resource-group rg-microsoft-navigator --query key1 -o tsv
$env:AZURE_SEARCH_ENDPOINT      = "https://srch-adp-v1.search.windows.net"
$env:AZURE_SEARCH_API_KEY       = az search admin-key show --service-name srch-adp-v1 --resource-group rg-adp-v1 --query primaryKey -o tsv
$env:AZURE_EVENTHUBS_CONNECTION = az eventhubs namespace authorization-rule keys list --namespace-name evh-adp-v1 --resource-group rg-adp-v1 --name RootManageSharedAccessKey --query primaryConnectionString -o tsv
$env:AZURE_COSMOS_CONNECTION    = az cosmosdb keys list --name cdb-adp-v1 --resource-group rg-adp-v1 --type connection-strings --query "connectionStrings[0].connectionString" -o tsv
```

### Two-process smoke test

```powershell
# Terminal A — start the consumer first (so it's listening before events emit)
dotnet run --project platform/src/PackageCompiler -c Release --no-build -- ingest --max-events 4 --timeout 120

# Terminal B — emit events
dotnet run --project platform/src/PackageCompiler -c Release --no-build -- execute `
  --artifact build/fnol-handler.zip `
  --subject CLM-2026-10000 `
  --claim usecases/meridian-pnc-auto-claims/data/claims-25.json `
  --search-mode azure --tools --publish-decisions `
  --trace build/fnol-handler-d7b.trace.json `
  --adapter foundry

# Terminal A or new — verify Cosmos persisted the 4 rows
dotnet run --project platform/src/PackageCompiler -c Release --no-build -- show-state --subject CLM-2026-10000
```

## Live URLs (D7c → D8 — 2026-05-27)

| Surface | URL | Notes |
|---|---|---|
| Operator Console | `https://witty-sea-0d12a380f.7.azurestaticapps.net` | SWA `swa-adp-v1-console`, Free tier; "Run new claim" button triggers orchestration |
| Function app | `https://func-adp-v1-fnol.azurewebsites.net/api/` | .NET 10 isolated worker, Flex Consumption, Durable Task |
| Health probe | `GET  /api/health` | Anonymous, no Cosmos call |
| Get trace by subject | `GET  /api/traces/{subjectId}[?traceId=...]` | Anonymous, queries Cosmos `dw-state`, returns latest trace |
| **Start orchestration** | `POST /api/runs` body `{ "subjectId": "CLM-2026-1000X", "packageId": "fnol-handler" }` | 202 with runId + statusUrl + traceUrl |
| **Get run status** | `GET  /api/runs/{runId}/status` | Durable status (Pending/Running/Completed/Failed/...) + RunResult on completion |

## D8 — end-to-end live orchestration

The Durable Function bundles the FNOL artifact + a 25-claim synthetic corpus in `Resources/`. POST starts an orchestration; the activity runs `PlanExecutor` against the bundled inputs and writes each step to Cosmos via `DwStateWriter` (the new Cosmos-direct `IDecisionSink`). Typical wall time: 60-90s for the 4-step FNOL run.

```powershell
# Start
$run = Invoke-RestMethod -Uri "https://func-adp-v1-fnol.azurewebsites.net/api/runs" `
  -Method Post -ContentType "application/json" `
  -Body (@{ subjectId = "CLM-2026-10003"; packageId = "fnol-handler" } | ConvertTo-Json)

# Poll
do {
  Start-Sleep 5
  $s = Invoke-RestMethod -Uri "https://func-adp-v1-fnol.azurewebsites.net/api/runs/$($run.runId)/status"
  "  $($s.status)"
} until ($s.status -in 'Completed','Failed','Terminated')

# Fetch
Invoke-RestMethod -Uri "https://func-adp-v1-fnol.azurewebsites.net/api/traces/$($run.subjectId)"
```

Or click **Run new claim** in the operator console — it picks a random `CLM-2026-1000X` subject, fires the run, polls, and refreshes the trace view when complete.

## Two architecturally meaningful pieces from D8

- **`IDecisionSink` interface** — `DecisionPublisher` (Event Hubs), `DwStateWriter` (Cosmos direct), and `SignalRStepSink` (live tail) all implement it. CLI publishes to EH; the Durable activity uses a `CompositeDecisionSink([DwStateWriter, SignalRStepSink])`.
- **Bundled artifact + claim corpus in the Function** — `platform/src/TracesApi/Resources/` ships into the publish package via `<None Include="Resources/**/*" CopyToPublishDirectory="PreserveNewest" />`. The activity reads from `AppContext.BaseDirectory` at runtime. v1+ pulls these from blob storage / Process Studio.

## D9a — SignalR live tail (live)

- **Resource:** `signalr-adp-v1` (Free_F1, Serverless mode, eastus2). $0/day idle, 20K messages/day cap.
- **Hub:** `fnoltrace`. Per-subject scoping via `Clients.User(subjectId).SendCoreAsync(...)`.
- **Negotiate:** `GET /api/negotiate?subject=CLM-2026-XXXXX` returns `{ url, accessToken }`; the JWT carries `asrs.s.uid = subjectId`.
- **Push:** every `IDecisionSink.PublishAsync` from PlanExecutor → `SignalRStepSink` → SignalR Service → connected client receives a `step` message.
- **Console:** `liveTail.ts` (uses `@microsoft/signalr`); on "Run new claim" the console resets the trace view, subscribes to the subject, and appends each incoming step. After the orchestration completes the canonical trace is refetched from Cosmos.

Two gotchas:

1. **SignalR binding's default config key is `AzureSignalRConnectionString`.** Setting `AZURE_SIGNALR_CONNECTION` alone won't be picked up by `[SignalRConnectionInfoInput]`; either rename the app setting or set `ConnectionStringSetting = "AZURE_SIGNALR_CONNECTION"` on the attribute.
2. **`@microsoft/signalr` bundle adds ~15 KB gz** to the console (124 → 140 KB gz). Acceptable; lazy-load if it grows.

## Live URLs after D9a

| Surface | URL |
|---|---|
| Console | https://witty-sea-0d12a380f.7.azurestaticapps.net |
| Health | https://func-adp-v1-fnol.azurewebsites.net/api/health |
| Get trace | https://func-adp-v1-fnol.azurewebsites.net/api/traces/{subjectId} |
| Start run | `POST` https://func-adp-v1-fnol.azurewebsites.net/api/runs |
| Run status | https://func-adp-v1-fnol.azurewebsites.net/api/runs/{runId}/status |
| **SignalR negotiate** | https://func-adp-v1-fnol.azurewebsites.net/api/negotiate?subject={subjectId} |
| SignalR Service | `signalr-adp-v1.service.signalr.net` (hub `fnoltrace`) |

Open `https://witty-sea-0d12a380f.7.azurestaticapps.net/?subject=CLM-2026-10001` to view a live trace. The chip top-right shows **● LIVE** (green) when fetched from the deployed Function, **● DEMO** (amber) when falling back to the bundled JSON.

## D7c — Function deployment recipe

`func` Core Tools were not installed; deployment uses `az functionapp deployment source config-zip`. Two gotchas worth knowing:

1. **Flex Consumption uses blob-container deployment storage.** The default Bicep wired `SystemAssignedIdentity` auth, but the deploying user doesn't hold `Microsoft.Authorization/roleAssignments/write`, so the function's MI can't write the deployment zip. **Fix applied post-deploy** (also documented in `platform/infra/modules/functions.bicep` going forward): set `functionAppConfig.deployment.storage.authentication` to `StorageAccountConnectionString` referencing the `AzureWebJobsStorage` app setting.

2. **`Compress-Archive` writes backslashes in zip entries**, which Kudu rejects with `Cannot find required .azurefunctions directory at root level`. Use `System.IO.Compression.ZipFileExtensions.CreateEntryFromFile` with forward-slash entry names, or zip from a bash shell with `zip -rq` (when available).

Build + zip + deploy:

```powershell
# 1. Publish
dotnet publish platform/src/TracesApi -c Release -o build/tracesapi-publish

# 2. Zip with forward-slash entries
$src = (Resolve-Path build/tracesapi-publish).Path
$dst = Join-Path (Resolve-Path build).Path 'tracesapi.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $dst) { Remove-Item $dst -Force }
$z = [System.IO.Compression.ZipFile]::Open($dst, 'Create')
Get-ChildItem -Recurse -File $src -Force | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1).Replace('\','/')
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, 'Fastest') | Out-Null
}
$z.Dispose()

# 3. Pre-flight (one-time) — set Cosmos app setting + storage conn + deployment-auth switch + CORS
$cosmosConn = az cosmosdb keys list --name cdb-adp-v1 --resource-group rg-adp-v1 --type connection-strings --query "connectionStrings[0].connectionString" -o tsv
$stConn = az storage account show-connection-string --name stadpv1 --resource-group rg-adp-v1 --query connectionString -o tsv
az functionapp config appsettings set --name func-adp-v1-fnol --resource-group rg-adp-v1 --settings "AZURE_COSMOS_CONNECTION=$cosmosConn" "AzureWebJobsStorage=$stConn" -o none
az storage container create --name deployments --connection-string $stConn -o none
# Patch deployment storage auth (see Function deployment-recipe note #1 above)
az functionapp cors add --name func-adp-v1-fnol --resource-group rg-adp-v1 --allowed-origins "https://witty-sea-0d12a380f.7.azurestaticapps.net" "http://localhost:5174"

# 4. Deploy
az functionapp deployment source config-zip --resource-group rg-adp-v1 --name func-adp-v1-fnol --src build/tracesapi.zip --build-remote false
```

## D7c — SWA console deployment

```powershell
cd platform/console
$env:VITE_TRACES_API = "https://func-adp-v1-fnol.azurewebsites.net/api"
npm run build

$tok = az staticwebapp secrets list --name swa-adp-v1-console --resource-group rg-adp-v1 --query "properties.apiKey" -o tsv
npx --yes @azure/static-web-apps-cli@latest deploy ./dist --deployment-token $tok --env production
```

## Managed identities (per ADR-0008)

Each workload has its own user-assigned identity. No shared service principals.

- `id-adp-v1-orchestrator`
- `id-adp-v1-decision-ingest`
- `id-adp-v1-context-router`
- `id-adp-v1-mcp-claim-store`
- `id-adp-v1-mcp-policy-store`
- `id-adp-v1-console-api`

All six are granted **Key Vault Secrets User** on `kv-adp-v1`.

## Deploy commands (run from repo root)

```powershell
# Pre-flight (read-only)
az account show
az group exists --name rg-adp-v1
az storage account check-name --name stadpv1
az bicep build --file platform/infra/main.bicep

# RG (idempotent, free)
az group create --name rg-adp-v1 --location eastus2 `
  --tags project=adp-v1 environment=dev owner=anand-track managedBy=bicep

# Preview (no changes)
az deployment group what-if `
  --resource-group rg-adp-v1 `
  --template-file platform/infra/main.bicep `
  --parameters platform/infra/parameters/dev.bicepparam

# Apply (creates 23 resources, ~10-15 min)
az deployment group create `
  --resource-group rg-adp-v1 `
  --name adp-v1-bootstrap `
  --template-file platform/infra/main.bicep `
  --parameters platform/infra/parameters/dev.bicepparam
```

## Post-deploy validation

```powershell
# Capture deployment outputs
az deployment group show `
  --resource-group rg-adp-v1 `
  --name adp-v1-bootstrap `
  --query properties.outputs

# Sanity-check each resource is ready
az cosmosdb show --name cdb-adp-v1 --resource-group rg-adp-v1 --query "{state:provisioningState}" -o tsv
az eventhubs namespace show --name evh-adp-v1 --resource-group rg-adp-v1 --query "{state:provisioningState}" -o tsv
az search service show --name srch-adp-v1 --resource-group rg-adp-v1 --query "{state:provisioningState}" -o tsv
az functionapp show --name func-adp-v1-fnol --resource-group rg-adp-v1 --query "{state:state}" -o tsv
az staticwebapp show --name swa-adp-v1-console --resource-group rg-adp-v1 --query "{state:provisioningState}" -o tsv
```

## Estimated idle cost

| Resource | Approx idle cost / day |
|---|---|
| Cosmos DB serverless | $0 (no requests) |
| Event Hubs Standard (1 TU) | ~$0.75 |
| AI Search Basic | ~$2.50 |
| Container Apps env | $0 (no apps yet) |
| Function plan (Flex) | $0 (no invocations) |
| Static Web App Free | $0 |
| Storage Standard LRS | $0.05 |
| Key Vault | $0.10 |
| Log Analytics (pay-per-GB) | ~$0.10 |
| **Total idle** | **~$3.50–4.00 / day** |

(Active usage adds incremental cost. See `az consumption usage list` for actuals after a few days.)

## Tear-down

```powershell
# Removes everything in the RG, irreversible.
az group delete --name rg-adp-v1 --yes --no-wait
```

## D11 — Fabric Lakehouse semantic layer (Fabric IQ)

ADR-0011 documents the choice; this section is the operator runbook for the v1 path.

Fabric resources are **not** first-class Bicep. The provisioning + load lives in two PowerShell scripts that call Fabric REST + OneLake DFS APIs.

```powershell
# 0. Pre-req: be logged into az with a principal that can see the Fabric capacity.
az login

# 1. Provision the Fabric workspace + Lakehouse (idempotent).
#    Uses capacity 'offeringsfabric001' (verified in tenant).
./scripts/provision-fabric.ps1
# → prints workspaceId, lakehouseId, and the SQL endpoint connection string.

# 2. Load the semantic tables from claims-1k.json.
#    Generates CSV in-memory, uploads to OneLake Files, then triggers Lakehouse 'tables/load'.
./scripts/load-fabric-lakehouse.ps1 -WorkspaceId <ws> -LakehouseId <lh>

# 3. Grant the Function app's system MI Viewer on the workspace (required for read).
#    The principalId is the system-assigned MI of func-adp-v1-fnol.
$fabToken = (az account get-access-token --resource 'https://api.fabric.microsoft.com' | ConvertFrom-Json).accessToken
$miId = az functionapp show -g rg-adp-v1 -n func-adp-v1-fnol --query identity.principalId -o tsv
$body = @{ principal = @{ id = $miId; type = 'ServicePrincipal' }; role = 'Viewer' } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://api.fabric.microsoft.com/v1/workspaces/<ws>/roleAssignments" `
  -Headers @{ Authorization = "Bearer $fabToken"; 'Content-Type' = 'application/json' } -Body $body

# 4. Flip the Function app to the Fabric backend.
$connStr = '<connection string from step 1>'
az functionapp config appsettings set -g rg-adp-v1 -n func-adp-v1-fnol `
  --settings SEMANTIC_BACKEND=fabric "FABRIC_LAKEHOUSE_CONNECTION=$connStr"
```

Rollback to v0 (Azure SQL) is a single command:

```powershell
az functionapp config appsettings set -g rg-adp-v1 -n func-adp-v1-fnol --settings SEMANTIC_BACKEND=sql
```

### Gotchas (D11)

- **Lakehouse SQL endpoint metadata sync lags table creation by 1–5 minutes.** After `load-fabric-lakehouse.ps1` completes, the tables exist in OneLake but `INFORMATION_SCHEMA.TABLES` won't show them until the SQL endpoint syncs. Trigger an explicit refresh:
  ```powershell
  $epId = (Invoke-RestMethod "https://api.fabric.microsoft.com/v1/workspaces/<ws>/lakehouses/<lh>" -Headers @{ Authorization = "Bearer $fabToken" }).properties.sqlEndpointProperties.id
  Invoke-WebRequest -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/<ws>/sqlEndpoints/$epId/refreshMetadata?preview=true" -Headers @{ Authorization = "Bearer $fabToken"; 'Content-Type'='application/json' } -Body '{}'
  ```
- **Windows PowerShell 5.1 reads `.ps1` files as ANSI without a UTF-8 BOM.** Em dashes (and other non-ASCII characters) in script literals get mis-decoded and break the parser. Use ASCII-safe characters in scripts, or save with UTF-8 BOM.
- **`ConvertFrom-Json -Depth` is PS 7+.** Don't pass it in scripts that should run on Windows PowerShell 5.1; default depth (100) is fine for our corpus.
- **Fabric role grant returns 201**, not 200 — `Invoke-RestMethod` accepts both, but be aware when scripting status-code checks.

## What this deploy does NOT include (deferred to v2+)

- Fabric RTI (KQL eventhouse) for live trace persistence — SignalR + Cosmos cover this.
- Fabric medallion (Bronze/Silver) — Lakehouse holds Gold-equivalent only.
- Defender for AI subscription — enablement on the Foundry resource.
- Private endpoints + VNet integration — v1 hardening pass.
- Sentinel SIEM workspace ingestion rules.
- Container Apps `app` definitions — once we have container images to deploy.
