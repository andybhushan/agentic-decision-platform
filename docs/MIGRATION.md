# ADP Migration and Recreation Guide

**Purpose:** recreate the entire platform, exactly as it runs today, in a different subscription, tenant, region, or instance. Everything the current environment does is either captured in this repository or listed here as an explicit manual step. Follow the phases in order.

Current reference environment (what you are cloning): resource group `rg-adp-v1`, East US 2, subscription `Project-IBMMSOFFERINGSPOC` (`5aaa5efd-2544-456c-964e-4d8627d6a0b8`), backend image `tracesapi:v22-runtime-switch`, live at `https://lemon-water-065e3e40f.7.azurestaticapps.net`.

Last updated: 2026-07-13. If the platform has moved on, reconcile against `docs/WORLD-CLASS-MVP-REVIEW.md` and the git log first.

---

## 0. What you are recreating (target-state inventory)

### 0.1 Azure resources (all in one resource group)

| Resource | Reference name | SKU / notes |
|---|---|---|
| Container Apps environment | `cae-adp-v1` | Consumption |
| Container App | `ca-tracesapi` | System-assigned MI ON; ingress external; single revision mode; the entire backend |
| Container Registry | `acradpv1` | Basic; admin user enabled (registry password is a container secret) |
| Cosmos DB account | `cdb-adp-v1` | Serverless; database `adp`; containers `dw-state` (pk `/subjectId`) and `intake` (pk `/subjectId`) |
| Event Hubs namespace | `evh-adp-v1` | Basic; hub for decision fan-out |
| SignalR Service | `sigr-adp-v1` | Free/Standard, **Serverless mode**, hub `fnoltrace` |
| Storage account | `stadpv1` | Functions runtime store + blob container `evidence` (created on first use by the app) |
| AI Search | `srch-adp-v1` | Basic; index `adp-knowledge` (seeded by CLI, see Phase 3) |
| AI Foundry (Cognitive Services) | `aif-adp-v1` | Kind AIServices; project `adp-v1`; model deployments `gpt-4o`, `text-embedding-3-small`, `text-embedding-3-large` |
| Key Vault | `kv-adp-v1` | Secrets store (see post-deploy grants) |
| App Insights + Log Analytics | `appi-adp-v1`, `log-adp-v1` | Telemetry |
| Event Grid topic | `egt-adp-v1-fanout` | Provisioned, lightly used |
| User-assigned identities | `id-adp-v1-*` (6) | Provisioned by Bicep for future per-workload auth |
| Static Web App | `swa-adp-v1-console` | Free; deployed via SWA CLI, not GitHub Actions |
| Azure OpenAI | `dt-navigator-openai` (SHARED, lives outside the RG) | `gpt-4o` + embeddings; a new environment can reuse it or deploy its own; only the endpoint + key matter |

### 0.2 Microsoft Fabric items (workspace `adp-v1`)

| Item | Reference name | How it is created |
|---|---|---|
| Workspace | `adp-v1` (id `12b39202-bbf7-4985-8eb1-541b3cde0071`) | `scripts/provision-fabric.ps1` (REST; needs a capacity) |
| Lakehouse | `adp` (id `7ad533bb-706e-4528-b9d4-f6cd86cbf5dd`) | provision script |
| Semantic tables | `dim_policyholder`, `dim_vehicle`, `fact_claims`, `dim_borrower`, `fact_loan_applications` | loader scripts (Phase 4) |
| Claims-domain tables (24) | `claim`, `coverage`, `payment`, ... | `usecases/meridian-pnc-auto-claims/data/fabric-gold-generator` CSVs + loader |
| Ontology + graph | `claims_ontology`, `claims_ontology_graph` | **MANUAL, Fabric portal** |
| Data Agent | `claims_data_agent` (aiskill id in `FABRIC_DATA_AGENT_URL`) | **MANUAL, Fabric portal**: create, add lakehouse source, tick the 5 semantic tables, publish |
| Semantic model | `claims_semantic` | **MANUAL, Fabric portal** |

### 0.3 What is code vs what is manual

Everything in `platform/`, `apps/`, `usecases/`, `scripts/` is code and travels with the repo. The only artifacts that must be re-created by hand are: the Fabric ontology/graph/Data Agent/semantic model (portal), the AOAI + Foundry model deployments (one CLI command each), the RBAC grants (admin), and the tenant approvals listed in section 9.

---

## 1. Prerequisites

- **Tooling on the build machine:** Azure CLI (with `containerapp` extension), .NET 10 SDK (reference machine uses `$LOCALAPPDATA/Microsoft/dotnet/dotnet.exe`), Node 20+, npm, PowerShell 5.1+ (write `.ps1` ASCII-only; PS 5.1 reads them as ANSI), Playwright (`npx playwright install chromium`) for verification screenshots.
- **Azure:** a subscription where you hold Contributor on a new resource group; quota for the SKUs above; one region (reference: East US 2; note AI Search Basic was NOT available in eastus2 at bootstrap time and lives in eastus, cross-region in one RG is fine).
- **Azure OpenAI:** either reuse an existing account (endpoint + key) or create one and deploy `gpt-4o` (2024-11-20 or later) and `text-embedding-3-small`.
- **Fabric:** a capacity (F2 is enough) you can attach a workspace to, and portal access to create ontology + Data Agent items.
- **Admin asks to file early (they gate two phases):**
  1. Role for the Foundry agents data plane on the new `aif-*` account, for BOTH the Container App's managed identity and your user. Ask for **"Azure AI User"**; if the tenant's catalog lacks it (ours did), use **"Cognitive Services User"** (data actions `Microsoft.CognitiveServices/*`). "Azure AI Developer" was NOT sufficient in our tenant.
  2. (Optional features) Microsoft Graph application permissions for real Work IQ, and M365 Copilot licensing for the copilot surface. The platform runs fully without these (synthetic Work IQ; in-app copilot).

---

## 2. Phase 1: core Azure resources (Bicep)

IaC lives at `platform/infra/main.bicep` with modules per service and `parameters/dev.bicepparam`.

```powershell
az group create -n <rg> -l eastus2 --subscription <sub>
az deployment group create -g <rg> --subscription <sub> `
  --template-file platform/infra/main.bicep `
  --parameters platform/infra/parameters/dev.bicepparam
```

Three deltas learned at original bootstrap (see `docs/DEPLOY.md` for detail):
1. Cosmos API version pinned to `2024-05-15` (newer previews changed serverless capability shape).
2. AI Search may need a different region than the RG default (capacity).
3. Key Vault role assignments are NOT in the Bicep (the deploying account usually lacks `roleAssignments/write`); run the KV grants from `docs/DEPLOY.md` "Post-deploy role grants" with an Owner/UAA account.

Then create what sits outside the original Bicep:

```powershell
# Foundry account + project + model deployments
az cognitiveservices account create -n <aif> -g <rg> --kind AIServices --sku S0 -l eastus2 --subscription <sub>
az cognitiveservices account deployment create -n <aif> -g <rg> --subscription <sub> `
  --deployment-name gpt-4o --model-name gpt-4o --model-version 2024-11-20 --model-format OpenAI --sku-name Standard --sku-capacity 30
# repeat for text-embedding-3-small / -large
# project: create in the AI Foundry portal (or REST); note the endpoint:
#   https://<aif>.services.ai.azure.com/api/projects/<project>

# Static Web App (CLI-deployed, no repo link)
az staticwebapp create -n <swa> -g <rg> --subscription <sub> --sku Free
```

RBAC for the Foundry agents data plane (after the Container App exists so its MI principal id is known):

```powershell
$mi = az containerapp show -n <ca> -g <rg> --subscription <sub> --query identity.principalId -o tsv
az role assignment create --assignee-object-id $mi --assignee-principal-type ServicePrincipal `
  --role "Cognitive Services User" --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<aif>
az role assignment create --assignee <your-user-object-id> --role "Cognitive Services User" --scope <same scope>
```

(Run under git-bash with `MSYS_NO_PATHCONV=1` or the `--scope` path gets mangled.)

---

## 3. Phase 2: knowledge plane (Foundry IQ / AI Search)

The index `adp-knowledge` is created and seeded by the `adpc` CLI from the markdown knowledge bases:

```bash
export AZURE_SEARCH_ENDPOINT=https://<search>.search.windows.net
export AZURE_SEARCH_API_KEY=<admin key>
export AZURE_OPENAI_ENDPOINT=<aoai endpoint>       # embeddings
export AZURE_OPENAI_API_KEY=<aoai key>

dotnet platform/src/PackageCompiler/bin/Release/net10.0/adpc.dll index \
  --knowledge usecases/meridian-pnc-auto-claims/knowledge
dotnet .../adpc.dll index --knowledge usecases/banking-loan-origination/knowledge
```

That covers PAC-*.md (claims) and BANK-*.md (banking). Index name is a constant (`AzureSearchFoundryIQSource.IndexName = "adp-knowledge"`), so no config beyond endpoint + key.

---

## 4. Phase 3: Microsoft Fabric (Fabric IQ)

1. **Workspace + lakehouse:** `scripts/provision-fabric.ps1` (edit capacity/workspace names). Add the Container App's **managed identity as a workspace member** (portal, Manage access) so the deployed API can call the Data Agent.
2. **Semantic tables:** run `scripts/load-fabric-lakehouse.ps1` (claims 1k universe) and `scripts/load-fabric-banking.ps1` (borrowers). Update the WorkspaceId/LakehouseId defaults in the scripts to the new ids.
3. **Ongoing sync:** `scripts/sync-intake-to-fabric.ps1` rebuilds the 5 semantic tables as the full universe (claims-1k + borrowers-30) OVERLAID with runtime intake (runtime rows replace colliding ids), then refreshes the SQL endpoint metadata. Update its 3 id parameters. Run pre-demo or on demand.
4. **Claims-domain 24 tables:** generator CSVs are in `usecases/meridian-pnc-auto-claims/data/fabric-gold-generator/data/`; load with the same OneLake pattern if the ontology needs them.
5. **MANUAL portal steps** (no API for these at time of writing):
   - Create the ontology (`claims_ontology`) over the lakehouse and its graph.
   - Create the **Data Agent**, add the lakehouse as a source, **tick the 5 semantic tables**, publish.
   - Note the agent's assistants base URL: `https://api.fabric.microsoft.com/v1/workspaces/<ws-id>/aiskills/<skill-id>/aiassistant/openai` (this becomes `FABRIC_DATA_AGENT_URL`).
6. **Protocol gotchas (all verified live):** every Data Agent call needs `?api-version=2024-05-01-preview`; the serving assistant is minted via `POST /assistants {"model":"gpt-4o"}` (the aiskill id is NOT an assistant id); after ANY re-publish of the agent, **restart the Container App revision** (it caches its minted assistant for the process lifetime); if SQL reads look stale after a table Overwrite, call the SQL endpoint `refreshMetadata?preview=true` (the sync script does this).
7. **Lakehouse SQL connection** for `FABRIC_LAKEHOUSE_CONNECTION`: `Server=<sql endpoint from lakehouse properties>;Database=<lakehouse name>;` with AAD auth (the code uses DefaultAzureCredential).

---

## 5. Phase 4: backend (Container App)

### 5.1 Environment variables on `ca-tracesapi` (complete list)

| Variable | Value source | Notes |
|---|---|---|
| `AzureWebJobsStorage` | storage account connection string | also the evidence blob store |
| `FUNCTIONS_WORKER_RUNTIME` | `dotnet-isolated` | |
| `AGENT_BACKEND` | `agent-framework` | default runtime; runs may override per request (`foundry`, `legacy`) |
| `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY` | AOAI account | reasoning, vision, embeddings, both chat surfaces |
| `AZURE_SEARCH_ENDPOINT` / `AZURE_SEARCH_API_KEY` | search service | Foundry IQ |
| `AZURE_COSMOS_CONNECTION` | Cosmos keys | journal + intake |
| `AZURE_EVENTHUBS_CONNECTION` | EH namespace | fan-out |
| `AZURE_SIGNALR_CONNECTION` | **secret ref** `azure-signalr-connection` | live tail; Serverless mode required |
| `SEMANTIC_BACKEND` | `fabric` | selects FabricLakehouseSource |
| `FABRIC_LAKEHOUSE_CONNECTION` | Phase 3 step 7 | AAD SQL |
| `FABRIC_DATA_AGENT_URL` | Phase 3 step 5 | Data Agent consultations |
| `FOUNDRY_PROJECT_ENDPOINT` | Phase 1 | enables the foundry runtime option |
| `WEBSITE_HOSTNAME` | container FQDN | |

Container secrets: the ACR pull password (`<acr>azurecrio-<acr>`) and `azure-signalr-connection`. Everything else is plain env; move more into secrets/Key Vault when hardening.

### 5.2 Build and deploy (the exit-code-gated path, non-negotiable)

```bash
dotnet publish platform/src/TracesApi/TracesApi.csproj -c Release -o build/tracesapi-publish
# GATE ON THE EXIT CODE. Never pipe through grep/filters that mask a TreatWarningsAsErrors failure.
cd build/tracesapi-publish   # Dockerfile lives here (functions dotnet-isolated 10 base)
az acr build --registry <acr> --image tracesapi:v1-<tag> --subscription <sub> .
az containerapp update -n <ca> -g <rg> --subscription <sub> --image <acr>.azurecr.io/tracesapi:v1-<tag>
# verify behavior after every deploy (curl /api/health, then one real run)
```

Signed use-case packages ship inside the image from `platform/src/TracesApi/Resources/*.zip`; recompile any edited package first: `adpc compile --in usecases/<uc>/packages/<x>.json --out platform/src/TracesApi/Resources/<x>.zip`.

### 5.3 Code-level SDK rules (paid for in deploys, do not relearn)

- `Azure.AI.OpenAI` 2.1 chat completions are binary-incompatible with the `OpenAI` 2.10 assembly Agent Framework resolves. New direct chat-completion code must call the AOAI REST API over HttpClient (`api-version=2024-10-21`); see `EvidenceVision.cs` and `MemberAssist.cs`. Agent Framework's own path (`ChatClientAgent`) is fine; see `OperatorCopilot.cs`.
- Cosmos writes: the SDK's Newtonsoft default drops `id` on PascalCase records; write lowercase anonymous objects.

---

## 6. Phase 5: frontend (Static Web App)

The API URL and the share key are **baked at build time** from `apps/console/.env.production`:

```
VITE_TRACES_API=https://<new container app FQDN>/api
VITE_SHARE_KEY=<your share key>            # omit entirely to disable the access gate
```

Update both for the new environment (this is THE step people forget: the SWA has no linked backend and no runtime proxy; the SPA calls the container app directly, CORS is open on the API).

```bash
cd apps/console && npm ci && npm run build
TOK=$(az staticwebapp secrets list -n <swa> -g <rg> --subscription <sub> --query properties.apiKey -o tsv)
npx --yes @azure/static-web-apps-cli@latest deploy ./dist --deployment-token "$TOK" --env production
# verify the LIVE bundle hash matches dist/index.html before believing the deploy
```

Theme defaults to light; member/borrower portals, docs, and diagram library are all inside this one SPA.

---

## 7. Phase 6: verification (definition of done for the migration)

Run in order; every item must pass before calling the environment live.

1. `GET /api/health` returns ok; `/api/agents` shows `availableRuntimes: [agent-framework, foundry, legacy]`.
2. Console loads with the share key; queue shows 25 claims + 13 applications (corpus).
3. **Full claim run** on `agent-framework`; then the SAME subject on `foundry` (runtime dropdown); confirm 4 persistent `adp-v1-agent.*` agents appear in the Foundry project.
4. Trace steps cite all three IQ systems (chips) including `DATA_AGENT/<subject>`.
5. **Member flow:** sign in, file a claim WITH a photo; record gains `evidenceAssessment`; tracker shows photos + "what our AI saw"; run the damage stage; estimate appears on the tracker. Attach a police-report PDF; document chip renders.
6. **Banking flow:** apply with a payslip photo; vision reads the figures; loan run verifies income.
7. **HITL:** force a gate (Lab), resolve it, confirm the judgment prints in the Decision Record.
8. **Chat:** member assistant answers an estimate question and REFUSES a fraud-score question; platform copilot answers a gates question (journal chip), a records question, and a portfolio analytics question (Data Agent chip).
9. **Outcomes:** KPIs non-zero; governance insights row renders (evidence mix, calibration, judgment outcomes).
10. Smoke scripts: `apps/console/scripts/smoke-*.mjs` and `demo-warmup.mjs` (update the API base in `shot.mjs`/scripts if hardcoded).
11. Playwright screenshots of `/`, `/decisions`, `/outcomes`, `/docs`, `/member/home`, `/bank/home` via `scripts/shot.mjs`.

---

## 8. Parameterization checklist (find/replace when renaming)

- Resource names above (`*-adp-v1`, `acradpv1`, `stadpv1`).
- `apps/console/.env.production`: `VITE_TRACES_API`, `VITE_SHARE_KEY`.
- Fabric ids in `scripts/provision-fabric.ps1`, `load-fabric-*.ps1`, `sync-intake-to-fabric.ps1`, and `apps/console/scripts/ask-data-agent.mjs`.
- `FOUNDRY_PROJECT_ENDPOINT`, `FABRIC_DATA_AGENT_URL`, `FABRIC_LAKEHOUSE_CONNECTION` env values.
- Foundry agent name prefix `adp-v1-` (constant in `FoundryAdapter.cs`) if you want per-env separation in one project.
- Docs pages state the reference names (`DocsPage.tsx`, `ADP-SOLUTION.md`, diagrams): update if the new environment is client-facing.
- Guardrails that stay true anywhere: carrier-agnostic naming (Meridian/Northwind fiction only), all data synthetic, no client names.

---

## 9. Known open items that do NOT block a migration

| Item | State | Needed for |
|---|---|---|
| Microsoft Graph app permissions (Calendars.Read, Mail.Read, User.Read.All) on the CA managed identity | tenant admin consent pending | real Work IQ (synthetic source runs meanwhile) |
| M365 Copilot licensing + custom agent publishing | pending | exposing the operator copilot inside M365 Copilot |
| Key Vault-backed secrets for all env vars | improvement | hardening beyond demo posture |

---

## 10. One-page order of operations

1. RG + Bicep (`platform/infra`) + KV grants + Foundry account/project/deployments + SWA shell.
2. RBAC: Cognitive Services User on the Foundry account for CA managed identity + you.
3. Seed AI Search (`adpc index` x2 knowledge dirs).
4. Fabric: provision + load + portal items (ontology, Data Agent: tick tables, publish) + MI workspace access.
5. Backend: env vars per 5.1, publish (gated) -> acr build -> containerapp update.
6. Frontend: edit `.env.production` (new API URL!), build, SWA deploy, bundle-hash check.
7. Sync intake to Fabric; restart the CA revision (fresh Data Agent assistant).
8. Walk the Phase 6 checklist end to end.
