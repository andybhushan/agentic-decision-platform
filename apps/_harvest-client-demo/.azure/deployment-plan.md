# Deployment Plan — PROJECT IMAGINE

**Status:** Deployed

## Live Endpoints (demo)

| Surface | URL | Status |
|---------|-----|--------|
| Frontend (SWA) | https://black-meadow-047776203.7.azurestaticapps.net | 200 OK |
| API (via SWA `/api/v1` proxy) | https://black-meadow-047776203.7.azurestaticapps.net/api/v1 | Reaches backend → Cosmos (verified `GET /api/v1/claims` → `success:true`) |
| Backend Container App (direct) | https://ca-imagine-demo-nedhvcrebnrw6.greenstone-c2ab663b.uksouth.azurecontainerapps.io | 401 by design (EasyAuth; access via SWA proxy only) |

**Notes:**
- Backend image: `crimaginedemonedhvcrebnrw6.azurecr.io/imagine-api:latest` (built via `az acr build`).
- Cosmos auth: `COSMOS_KEY` wired as a Container App secret from the existing `cosmos-project-imagine` account (also persisted in `infra/modules/container-app.bicep`).
- Frontend deployed with `swa deploy ./dist --env production` (no Docker required).

---

## Overview

| Field | Value |
|-------|-------|
| App | PROJECT IMAGINE — AI-Powered Digital Workforce Platform |
| Mode | MODERNIZE (existing Node+React app, no Azure hosting config yet) |
| Subscription | sub-ibmc-projImagine-demo (`de0fb07f-52a8-434a-9171-f18803bde9ee`) |
| Resource Group | `rg-project-imagine` (existing, uksouth) |
| Region | UK South (`uksouth`) |
| Recipe | AZD (Bicep) |
| IaC | Bicep |
| Deploy command | `azd up` |

---

## Components

| Component | Type | Technology | Path | Azure Target |
|-----------|------|------------|------|--------------|
| `backend` | API Service | Node.js 20 / Express / TypeScript | `backend/` | Azure Container Apps |
| `frontend` | SPA (static) | React 18 / Vite / TypeScript | `frontend/` | Azure Static Web Apps |

---

## Architecture

```
Internet
  │
  ├─► Azure Static Web Apps (frontend React SPA)
  │       └─► API proxy: /api/* → backend Container App
  │
  └─► Azure Container Apps (backend Node.js API, port 3000)
          ├─► Azure Cosmos DB (existing: cosmos-project-imagine, uksouth)
          ├─► Azure AI Search (existing: search-project-imagine, uksouth)
          ├─► Azure AI Foundry (external — env-configured endpoint)
          ├─► Azure Blob Storage (evidence uploads)
          └─► Azure Key Vault (secrets: Foundry key, Cosmos key, Search key, Storage conn)
```

**Why Container Apps for backend:**
- Node.js Express app needs persistent process (not serverless)
- Containerised — no VMs to manage, scales to zero when idle
- Native HTTPS, managed ingress, built-in Dapr support if needed later

**Why Static Web Apps for frontend:**
- Vite builds to static assets — perfect fit
- Built-in CDN, free SSL, GitHub Actions CI/CD auto-generated
- Native `/api` proxy to backend Container App (linkedBackend)

---

## Existing Azure Resources (reuse, do not recreate)

| Resource | Type | Action |
|----------|------|--------|
| `cosmos-project-imagine` | Cosmos DB account | **Reuse** — wire via Key Vault secret |
| `search-project-imagine` | Azure AI Search | **Reuse** — wire via Key Vault secret |

---

## Naming Convention

Pattern: `{abbreviation}-{workload}-{environment}-{token}` per `docs/azure-naming-conventions.md`

| Parameter | Value |
|-----------|-------|
| `workloadName` | `imagine` |
| `environmentName` | `demo` |
| `token` | `uniqueString(subscription().id, resourceGroup().id, environmentName)` — Bicep-computed |

Special constraints:
- **Container Registry**: alphanumeric only → `crimagine{env}{token}` (truncated to 50 chars)
- **Storage Account**: alphanumeric only, max 24 → `stimagine{env}{token}` (truncated)

## New Resources to Provision

| Resolved Name | Type | SKU | Notes |
|---------------|------|-----|-------|
| `crimagine-demo-{token}` → `crimaginedev{token}` | Container Registry | Basic | Build & store backend image |
| `cae-imagine-demo-{token}` | Container Apps Environment | Consumption | Hosts backend container app |
| `ca-imagine-demo-{token}` | Container App | — | Backend API, ingress port 3000 |
| `stapp-imagine-demo-{token}` | Static Web App | Free | Frontend SPA + CDN |
| `kv-imagine-demo-{token}` | Key Vault | Standard | All secrets via Managed Identity |
| `id-imagine-demo-{token}` | Managed Identity (user-assigned) | — | Container App → Key Vault, Cosmos, Search |
| `log-imagine-demo-{token}` | Log Analytics Workspace | PerGB2018 | Container App + SWA diagnostics |
| `appi-imagine-demo-{token}` | Application Insights | — | Linked to Log Analytics |
| `stimaginedemo{token}` | Storage Account | LRS | Evidence blob uploads |

## Mandatory Tags (every resource)

```bicep
{
  environment: 'demo'
  workload: 'imagine'
  owner: 'IBM-Project-Imagine'
  costCenter: 'project-imagine'
  'managed-by': 'bicep'
}
```

---

## Environment Variables / Secrets

Secrets stored in Key Vault, injected via Managed Identity at runtime:

| Env Var | Source |
|---------|--------|
| `COSMOS_ENDPOINT` | Key Vault |
| `COSMOS_KEY` | Key Vault |
| `FOUNDRY_API_KEY` | Key Vault |
| `FOUNDRY_PROJECT_ENDPOINT` | Key Vault |
| `AISEARCH_ENDPOINT` | Key Vault |
| `AISEARCH_KEY` | Key Vault |
| `AZURE_STORAGE_CONNECTION_STRING` | Key Vault |
| `NODE_ENV` | App setting: `demouction` |
| `PORT` | App setting: `3000` |

---

## CI/CD

- **Frontend:** Azure Static Web Apps auto-generates a GitHub Actions workflow on `azd up`
- **Backend:** GitHub Actions workflow builds Docker image → pushes to ACR → deploys new Container App revision
- Zero-touch on every push to `master`

---

## Dockerfiles

- `backend/Dockerfile` — multi-stage: build TS → copy `dist/` + `node_modules` (demo only) → expose 3000
- Frontend does NOT need a Dockerfile (Static Web Apps builds from source)

---

## Infrastructure File Layout

Per `docs/azure-naming-conventions.md`:

```
infra/
  main.bicep                  # Composition root
  main.dev.bicepparam         # Dev environment parameters
  main.demo.bicepparam        # demouction parameters
  abbreviations.json          # Naming prefixes per convention
  modules/
    cosmos.bicep              # Wire existing cosmos-project-imagine
    container-app.bicep       # Backend Container App + Environment + ACR
    storage.bicep             # Evidence blob storage
    static-web-app.bicep      # Frontend SWA
    monitoring.bicep          # Log Analytics + App Insights
    keyvault.bicep            # Key Vault + secrets
    identity.bicep            # User-assigned Managed Identity + RBAC
```

- [x] Analyze workspace (MODERNIZE mode)
- [x] Gather requirements
- [x] Scan codebase
- [x] Select recipe (AZD + Bicep)
- [x] Plan architecture
- [x] **Approved**

## Section 7: Validation Proof

| Check | Command | Result |
|-------|---------|--------|
| Bicep compile (zero warnings) | `az bicep build --file infra/main.bicep` | ✅ Clean — 0 warnings, 0 errors |
| Backend TypeScript | `cd backend && npx tsc --noEmit` | ✅ Clean |
| Frontend TypeScript | `cd frontend && npx tsc --noEmit` | ✅ Clean |
| ARM What-If | `az deployment group what-if ...` | ✅ All `+ Create`, no deletes, correct naming (`ca-imagine-demo-nedhvcrebnrw6`) |
| Dockerfile fix | `npm ci` → `npm install` (monorepo root owns lock file) | ✅ Fixed |

## Phase 2 Steps (post-approval)

- [ ] Load service references
- [ ] Confirm Azure context
- [ ] Generate Bicep infra (`infra/`)
- [ ] Generate `azure.yaml`
- [ ] Generate `backend/Dockerfile`
- [ ] Generate GitHub Actions workflow for backend
- [ ] Harden security (Managed Identity, Key Vault refs)
- [ ] Functional verification (`tsc --noEmit`, health check)
- [ ] Update status → Ready for Validation
- [ ] Hand off to azure-validate
