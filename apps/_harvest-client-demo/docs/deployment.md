# PROJECT IMAGINE — Deployment Guide

> **Environment:** Demo (non-production)  
> **Subscription:** `sub-ibmc-projImagine-demo` (`de0fb07f-52a8-434a-9171-f18803bde9ee`)  
> **Resource group:** `rg-project-imagine` (UK South)

---

## Live Endpoints

| Surface | URL |
|---------|-----|
| **Frontend (SPA)** | https://black-meadow-047776203.7.azurestaticapps.net |
| **API via proxy** | https://black-meadow-047776203.7.azurestaticapps.net/api/v1 |
| Backend direct | https://ca-imagine-demo-nedhvcrebnrw6.greenstone-c2ab663b.uksouth.azurecontainerapps.io *(401 by design — use proxy)* |

---

## Architecture

```
User browser
  │
  └─► Azure Static Web Apps   (frontend React SPA, westeurope CDN)
        ├── /                 → serves React SPA (index.html fallback for all non-asset routes)
        └── /api/v1/*         → proxy → Azure Container App (backend API)
                                           │
                                           ├── Azure Cosmos DB  (cosmos-project-imagine, uksouth)
                                           ├── Azure Blob Storage  (evidence uploads)
                                           ├── Azure AI Foundry  (VITE_FOUNDRY_* env vars)
                                           ├── Azure AI Search  (claim document search)
                                           └── Application Insights  (telemetry)
```

**Key design decisions:**
- SWA's `/api` linkedBackend proxy means the frontend uses **relative** `/api/v1` paths — no CORS issues, and the backend URL never appears in client code.
- Container App has `minReplicas: 1` to avoid cold starts on a demo.
- The Container App direct URL returns 401 (EasyAuth is enabled by the SWA linked-backend). This is expected and correct — all API calls must go through the SWA proxy.

---

## Technology Stack

| Layer | Tech | Azure Target |
|-------|------|--------------|
| Frontend | React 18 + Vite + IBM Carbon (TypeScript) | Azure Static Web Apps (Standard) |
| Backend | Node.js 20 + Express + TypeScript | Azure Container Apps (Consumption) |
| Database | Azure Cosmos DB NoSQL | `cosmos-project-imagine` (existing) |
| Storage | Azure Blob Storage | `stimaginedemonedhvcrebnr` |
| Registry | Azure Container Registry | `crimaginedemonedhvcrebnrw6` |
| Monitoring | Application Insights + Log Analytics | `appi-imagine-demo-*` |

---

## CI/CD — How It Works

Every push to `master` triggers `.github/workflows/deploy.yml` automatically.

```
Push to master
  │
  ├── GitHub Actions runner (ubuntu-latest)
  │     ├── az login (OIDC — no passwords, token expires in ~1h)
  │     ├── azd provision   ← deploys / updates Bicep infrastructure
  │     └── azd deploy      ← builds Docker image in ACR + deploys to Container App
  │                            builds frontend dist + deploys to Static Web Apps
  │
  └── Done — ~8-12 minutes total
```

`azd` uses `azure.yaml` to know what to build and where to deploy:
- `api` service → builds `backend/Dockerfile` via `az acr build` (cloud build, no local Docker needed), updates Container App revision
- `web` service → runs `npm run build` in `frontend/`, deploys `dist/` to Static Web Apps

---

## One-Time GitHub Actions Setup

> **This must be done by someone with Entra/Azure AD permissions in `sub-ibmc-projImagine-demo`.**
> It only needs to be done once. After that, CI/CD is fully automatic.

### Step 1 — Create the app registration and service principal

```bash
# Create app registration
APP_ID=$(az ad app create --display-name "project-imagine-deploy" --query appId -o tsv)

# Create service principal
SP_OBJ_ID=$(az ad sp create --id $APP_ID --query id -o tsv)

echo "APP_ID=$APP_ID"
echo "SP_OBJ_ID=$SP_OBJ_ID"
```

### Step 2 — Assign Contributor role on the resource group

```bash
SUB_ID="de0fb07f-52a8-434a-9171-f18803bde9ee"

az role assignment create \
  --role Contributor \
  --assignee $SP_OBJ_ID \
  --scope /subscriptions/$SUB_ID/resourceGroups/rg-project-imagine
```

### Step 3 — Create the federated credential (OIDC trust for GitHub Actions)

```bash
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-master",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:richardichogan/agent-workflow-builder:ref:refs/heads/master",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### Step 4 — Get the tenant ID

```bash
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "TENANT_ID=$TENANT_ID"
```

### Step 5 — Add GitHub Secrets and Variables

In the repo: **Settings → Secrets and variables → Actions**

| Type | Name | Value |
|------|------|-------|
| **Secret** | `AZURE_CLIENT_ID` | `$APP_ID` from Step 1 |
| **Secret** | `AZURE_TENANT_ID` | `$TENANT_ID` from Step 4 |
| **Secret** | `AZURE_SUBSCRIPTION_ID` | `de0fb07f-52a8-434a-9171-f18803bde9ee` |
| Variable | `AZURE_ENV_NAME` | `demo` |
| Variable | `AZURE_LOCATION` | `uksouth` |

> Optionally create a GitHub **Environment** named `demo` (Settings → Environments) and add the secrets there for environment-level protection rules.

### Step 6 — Verify

Push any commit to `master` and watch the Actions tab. The workflow should complete in ~8-12 minutes with no errors.

---

## ⚡ Quick Deployment Decision Guide

**Before deploying, ask: what changed?**

| What changed | Run |
|---|---|
| Frontend only (UI, React, SCSS, TS) | **Option C only** |
| Backend only (routes, services, API logic) | **Option B only** |
| Both frontend and backend | **Option B first, then Option C** |
| Bicep / infra | Infra deploy, then **Option B** (infra resets container image) |

> ⚠️ **The #1 source of production issues:** deploying the frontend without deploying the backend when backend code has changed, or vice versa. If in doubt, deploy both — it takes ~3 minutes each.

> ⚠️ **`az containerapp update` with the same `:latest` tag does NOT create a new revision** if only the image content changed. Use the `--set-env-vars "DEPLOY_TS=..."` trick in Option B to force a new revision.

---

## Manual Deployment (without CI/CD)

Use this when you need to deploy a hotfix quickly, or when GitHub Actions isn't yet configured.

### Prerequisites

```bash
# Install Azure CLI (https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
# Install azd CLI (https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd)
# Install Node.js 20+

# Log in
az login
az account set --subscription de0fb07f-52a8-434a-9171-f18803bde9ee
azd auth login
```

### Option A — Full redeploy (infra + app) via azd

```bash
azd env select demo   # or: azd env new demo
azd env set AZURE_LOCATION uksouth
azd env set AZURE_SUBSCRIPTION_ID de0fb07f-52a8-434a-9171-f18803bde9ee
azd up                # provisions infra + deploys both services
```

> ⚠️ **Note:** `azd provision` resets the Container App to a placeholder image. `azd deploy` (called by `azd up`) then rebuilds and re-points the image. Run `azd up` (not `azd provision` alone) to avoid being left with the placeholder.

### Option B — Backend only (code change, no infra change)

> **Run from the repo root** (`agent-workflow-builder/` or worktree root)

```bash
SUB="de0fb07f-52a8-434a-9171-f18803bde9ee"
ACR="crimaginedemonedhvcrebnrw6"
CA="ca-imagine-demo-nedhvcrebnrw6"
RG="rg-project-imagine"
IMAGE="$ACR.azurecr.io/imagine-api:latest"

# Pin subscription (drifts to Alliance Tenant — do this every time)
az account set --subscription $SUB

# Build and push image to ACR (no local Docker required — cloud build)
az acr build \
  --registry $ACR \
  --image imagine-api:latest \
  --file backend/Dockerfile \
  --subscription $SUB \
  backend/

# Force a new Container App revision (same :latest tag doesn't trigger a revision on its own)
# The DEPLOY_TS env var bump forces Azure to pull the new image
az containerapp update \
  -n $CA -g $RG \
  --subscription $SUB \
  --set-env-vars "DEPLOY_TS=$(date +%Y%m%d%H%M%S)"

# Verify the new revision is active with 100% traffic
az containerapp revision list \
  -n $CA -g $RG --subscription $SUB \
  --query "[].{name:name,created:properties.createdTime,active:properties.active,traffic:properties.trafficWeight}" \
  -o table
```

**PowerShell equivalent (Windows):**

```powershell
$SUB = "de0fb07f-52a8-434a-9171-f18803bde9ee"
$ACR = "crimaginedemonedhvcrebnrw6"
$CA  = "ca-imagine-demo-nedhvcrebnrw6"
$RG  = "rg-project-imagine"

az account set --subscription $SUB
az acr build --registry $ACR --image imagine-api:latest --file backend/Dockerfile --subscription $SUB backend/
az containerapp update -n $CA -g $RG --subscription $SUB --set-env-vars "DEPLOY_TS=$(Get-Date -Format 'yyyyMMddHHmmss')"
az containerapp revision list -n $CA -g $RG --subscription $SUB --query "[].{name:name,created:properties.createdTime,active:properties.active,traffic:properties.trafficWeight}" -o table
```

> **Important:** `az containerapp update --image` with the same `:latest` tag does **not** create a new revision if the tag hasn't changed. The `--set-env-vars "DEPLOY_TS=..."` pattern forces a new revision, which causes the Container App to pull the freshly-built image.

# Re-attach managed identity to registry (only needed if infra was re-provisioned)
az containerapp registry set \
  -n $CA -g $RG \
  --subscription $SUB \
  --server "$ACR.azurecr.io" \
  --identity system
```

### Option C — Frontend only (UI change, no backend change)

```bash
# 1. Build the frontend
cd frontend
npm run build   # runs tsc -b (strict type check) then vite build → dist/

# 2. Deploy to Static Web Apps
SWA_TOKEN=$(az staticwebapp secrets list \
  --name stapp-imagine-demo-nedhvcrebnrw6 \
  -g rg-project-imagine \
  --subscription de0fb07f-52a8-434a-9171-f18803bde9ee \
  --query "properties.apiKey" -o tsv)

npx @azure/static-web-apps-cli@latest deploy ./dist \
  --deployment-token $SWA_TOKEN \
  --env production
```

> The `npm run build` step includes `tsc -b` as a strict TypeScript gate. Fix any type errors before deploying — they'll block the build.

---

## Infrastructure Changes

If you change any Bicep files in `infra/`:

```bash
# Validate first (surfaces ARM errors before spending time deploying)
az deployment group validate \
  --resource-group rg-project-imagine \
  --template-file infra/main.bicep \
  --parameters infra/main.demo.bicepparam \
  --subscription de0fb07f-52a8-434a-9171-f18803bde9ee

# Deploy
az deployment group create \
  --resource-group rg-project-imagine \
  --template-file infra/main.bicep \
  --parameters infra/main.demo.bicepparam \
  --subscription de0fb07f-52a8-434a-9171-f18803bde9ee \
  --name "deploy-$(Get-Date -Format yyyyMMdd-HHmm)"
```

> ⚠️ After any `az deployment group create`, **re-run the backend image update** (Option B above) — infra deploys reset the Container App to the placeholder image.

---

## Environment Variables Reference

All backend env vars are set as Container App configuration. Secrets use `secretref:`.

| Variable | Source | Value |
|----------|--------|-------|
| `NODE_ENV` | App setting | `production` |
| `PORT` | App setting | `3000` |
| `COSMOS_ENDPOINT` | Bicep (from Cosmos account) | `https://cosmos-project-imagine.documents.azure.com:443/` |
| `COSMOS_KEY` | Secret `cosmos-key` | Cosmos primary master key |
| `COSMOS_DB_NAME` | App setting | `project-imagine` |
| `COSMOS_STEWARD_DATABASE` | App setting | `agent-workflow-builder` |
| `COSMOS_STEWARD_CLAIMS_CONTAINER` | App setting | `claim-chunks` |
| `COSMOS_STEWARD_CONVERSATIONS_CONTAINER` | App setting | `conversations` |
| `AZURE_STORAGE_CONNECTION_STRING` | Secret `storage-connection-string` | Storage account connection string |
| `EVIDENCE_CONTAINER_NAME` | App setting | `evidence-uploads` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App setting | App Insights connection string |

Frontend env vars (Vite, baked into the build — see `frontend/.env.production`):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `/api/v1` (relative — routed through SWA proxy) |

---

## Monitoring & Logs

```bash
# Stream live backend logs
az containerapp logs show \
  -n ca-imagine-demo-nedhvcrebnrw6 \
  -g rg-project-imagine \
  --follow \
  --subscription de0fb07f-52a8-434a-9171-f18803bde9ee

# Query Application Insights (last 50 errors)
az monitor app-insights query \
  --app appi-imagine-demo-nedhvcrebnrw6 \
  -g rg-project-imagine \
  --subscription de0fb07f-52a8-434a-9171-f18803bde9ee \
  --analytics-query "exceptions | order by timestamp desc | take 50" \
  --offset 1h
```

---

## Troubleshooting

### "Subscription keeps switching to Alliance Tenant Reporting"

The az CLI default subscription can drift between sessions. Always re-pin:

```bash
az account set --subscription de0fb07f-52a8-434a-9171-f18803bde9ee
```

Or add `--subscription de0fb07f-52a8-434a-9171-f18803bde9ee` to every `az` command.

### "Backend returns 401 on direct URL"

This is **expected**. The SWA linked-backend enables EasyAuth on the Container App. Access the API through the SWA proxy: `https://black-meadow-047776203.7.azurestaticapps.net/api/v1/...`

### "Container App shows placeholder page after infra deploy"

Infra deploys (`az deployment group create` / `azd provision`) reset the container image to `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`. Fix by re-running Option B above (rebuild + update image).

### "Login returns 404 in production"

The backend Container App has a **stale image** — the auth routes (or other new routes) exist in the source code but were never deployed. This happens when the frontend is deployed (Option C) without deploying the backend after backend code changed.

**Fix:** Run Option B (rebuild + force new revision). Check the ACR build timestamp vs the Container App revision timestamp to confirm the mismatch:

```bash
# Check when the active Container App revision was created
az containerapp revision list -n ca-imagine-demo-nedhvcrebnrw6 -g rg-project-imagine \
  --subscription de0fb07f-52a8-434a-9171-f18803bde9ee \
  --query "[?properties.active].{name:name,created:properties.createdTime}" -o table

# Compare to the git log for the relevant backend file
git log --oneline -- backend/src/routes/authRoutes.ts
```

If the Container App revision was created *before* the git commit that added the route, the backend is stale — run Option B.

### "Frontend build fails with TypeScript errors"

`npm run build` runs `tsc -b` — a strict type-check gate. The dev server (`npm run dev`) skips this, so errors can accumulate silently. Run `npx tsc --noEmit` in `frontend/` to see all errors without building.

### "az deployment group create says 'content already consumed'"

This is an az CLI quirk that masks the real ARM preflight error. Use the Azure Portal → Resource Groups → `rg-project-imagine` → Deployments to see the actual error message, or use `az deployment group validate` (see Infrastructure Changes above).

### "Static Web Apps not available in uksouth"

SWA is deployed to `westeurope` (configured via `staticWebAppLocation` param in `infra/main.bicep`). The linkedBackend still points to the Container App in `uksouth`. This is correct and intentional.

---

## Adding a New Environment

1. Create a new parameter file: `infra/main.<env>.bicepparam`
2. Copy `infra/main.demo.bicepparam` and change `environmentName` to your env name
3. Create a new resource group: `az group create -n rg-project-imagine-<env> -l uksouth`
4. Deploy: `az deployment group create --resource-group rg-project-imagine-<env> --template-file infra/main.bicep --parameters infra/main.<env>.bicepparam`
5. For GitHub Actions: add a new job in `deploy.yml` targeting the new environment/branch

---

## Related Documents

- [`docs/azure-naming-conventions.md`](./azure-naming-conventions.md) — resource naming rules
- [`.azure/deployment-plan.md`](../.azure/deployment-plan.md) — original deployment plan and validation proof
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — CI/CD workflow
- [`azure.yaml`](../azure.yaml) — azd service configuration
- [`infra/main.bicep`](../infra/main.bicep) — Bicep composition root
