# Azure Resource Naming Conventions

> Based on IBM-Project-Imagine org standards (`imagine-neo/skills/bicep-iac/SKILL.md`) and the [Azure Cloud Adoption Framework](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations).

## Naming Pattern

```
{abbreviation}-{workload}-{environment}-{token}
```

| Segment | Source | Example |
|---------|--------|---------|
| `abbreviation` | `abbreviations.json` — standard Azure CAF prefix | `cosmos-`, `app-`, `st` |
| `workload` | `workloadName` param (2–10 chars) | `imagine` |
| `environment` | `environmentName` param | `dev`, `test`, `prod` |
| `token` | `uniqueString(subscription().id, resourceGroup().id, environmentName)` | `a1b2c3d4` |

### Example Names

```
rg-imagine-dev                          # Resource Group
cosmos-imagine-dev-x7k2m4               # Cosmos DB Account
app-imagine-dev-x7k2m4                  # App Service
stimaginedevx7k2m4                      # Storage Account (no hyphens, 24 char limit)
appi-imagine-dev-x7k2m4                 # Application Insights
kv-imagine-dev-x7k2m4                   # Key Vault
crimaginedev                            # Container Registry (alphanumeric only)
```

## Resource Abbreviations

| Resource Type | Abbreviation | Constraints |
|---------------|-------------|-------------|
| Resource Group | `rg-` | 1–90 chars |
| App Service / Web App | `app-` | 2–60 chars |
| App Service Plan | `asp-` | 1–40 chars |
| Function App | `func-` | 2–60 chars |
| Static Web App | `stapp-` | 2–60 chars |
| Cosmos DB Account | `cosmos-` | 3–44 chars, lowercase + hyphens |
| Storage Account | `st` | 3–24 chars, **lowercase alphanumeric only** |
| Blob Container | (no prefix) | 3–63 chars, lowercase + hyphens |
| Key Vault | `kv-` | 3–24 chars |
| Application Insights | `appi-` | 1–260 chars |
| Log Analytics Workspace | `log-` | 4–63 chars |
| Container Registry | `cr` | 5–50 chars, **alphanumeric only** |
| Container Apps Environment | `cae-` | 1–60 chars |
| Container App | `ca-` | 2–32 chars, lowercase |
| API Management | `apim-` | 1–50 chars |
| Virtual Network | `vnet-` | 2–64 chars |
| Subnet | `snet-` | 1–80 chars |
| Network Security Group | `nsg-` | 1–80 chars |
| Managed Identity | `id-` | 3–128 chars |
| AI Services (Foundry) | `ai-` | 2–64 chars |

## Rules

1. **All names derived from parameters** — no magic strings in Bicep/Terraform
2. **Single `abbreviations.json`** in `infra/` provides prefixes
3. **Deterministic uniqueness** via `uniqueString()` — same inputs always produce same output
4. **Storage accounts and container registries** have special constraints (no hyphens, short limits)
5. **Lowercase everywhere** except Resource Group display names
6. **No secrets in names** — no customer data, internal project codes, or PII

## Mandatory Tags

Every resource must have:

```bicep
var tags = {
  environment: environmentName       // dev | test | prod
  workload: workloadName             // 'imagine'
  owner: 'IBM-Project-Imagine'       // org owner
  costCenter: '<cost-center>'        // billing allocation
  'managed-by': 'bicep'             // IaC tool
}
```

## Environment Separation

| Environment | Suffix | Purpose |
|-------------|--------|---------|
| `dev` | `-dev-` | Development / local integration |
| `test` | `-test-` | QA / staging |
| `prod` | `-prod-` | Production |

Each environment gets its own:
- Resource Group
- Parameter file (`main.dev.bicepparam`, `main.prod.bicepparam`)
- Unique token (derived from RG + sub + env)

## Project Imagine — Expected Resources

For this application's deployment:

```
rg-imagine-{env}
├── cosmos-imagine-{env}-{token}         # Claims data, FNOL sessions, steward chunks
├── app-imagine-{env}-{token}            # Backend API (Express)
├── stapp-imagine-{env}-{token}          # Frontend (Static Web App) — OR —
├── stimagine{env}{token}                # Blob storage (evidence uploads)
├── appi-imagine-{env}-{token}           # Application Insights
├── log-imagine-{env}-{token}            # Log Analytics
├── kv-imagine-{env}-{token}             # Key Vault (secrets, connection strings)
├── ai-imagine-{env}-{token}             # AI Foundry (GPT-4o, embeddings, vision)
└── id-imagine-{env}-{token}             # Managed Identity (RBAC for Cosmos, Blob, AI)
```

## Infrastructure File Layout

```
infra/
  main.bicep                  # Composition root
  main.dev.bicepparam         # Dev environment parameters
  main.prod.bicepparam        # Production parameters
  abbreviations.json          # Naming prefixes (this convention)
  modules/
    cosmos.bicep
    app-service.bicep
    storage.bicep
    ai-services.bicep
    monitoring.bicep
    keyvault.bicep
    identity.bicep
```

## References

- [Azure CAF Resource Abbreviations](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
- [Azure Naming Rules & Restrictions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules)
- `IBM-Project-Imagine/imagine-neo` — `skills/bicep-iac/SKILL.md`
