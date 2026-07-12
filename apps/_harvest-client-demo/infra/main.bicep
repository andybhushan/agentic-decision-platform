// main.bicep — PROJECT IMAGINE infrastructure composition root
// Naming: {abbreviation}-imagine-{env}-{token} per docs/azure-naming-conventions.md

targetScope = 'resourceGroup'

@description('Environment name (demo, dev, prod)')
param environmentName string = 'demo'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Azure region for Static Web App (not available in all regions, e.g. uksouth). Defaults to westeurope.')
param staticWebAppLocation string = 'westeurope'

@description('Cosmos DB account name (pre-existing, do not recreate)')
param existingCosmosAccountName string = 'cosmos-project-imagine'

// AI Search name kept for future use (currently accessed via env vars set at deploy time)
// param existingSearchServiceName string = 'search-project-imagine'

// ── Naming token ────────────────────────────────────────────────────────────
var resourceToken = toLower(uniqueString(subscription().subscriptionId, resourceGroup().id, environmentName))
var workloadName  = 'imagine'

var tags = {
  environment: environmentName
  workload: workloadName
  owner: 'IBM-Project-Imagine'
  costCenter: 'project-imagine'
  'managed-by': 'bicep'
}

// ── Monitoring ───────────────────────────────────────────────────────────────
module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
  }
}

// ── Key Vault ────────────────────────────────────────────────────────────────
module keyVault './modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    location: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
  }
}

// ── Managed Identity ─────────────────────────────────────────────────────────
module identity './modules/identity.bicep' = {
  name: 'identity'
  params: {
    location: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
    keyVaultName: keyVault.outputs.name
  }
}

// ── Storage (evidence blobs) ─────────────────────────────────────────────────
module storage './modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
    managedIdentityPrincipalId: identity.outputs.principalId
  }
}

// ── Container Registry ───────────────────────────────────────────────────────
module containerRegistry './modules/container-registry.bicep' = {
  name: 'containerRegistry'
  params: {
    location: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
  }
}

// ── Container Apps Environment + API ────────────────────────────────────────
module api './modules/container-app.bicep' = {
  name: 'api'
  params: {
    location: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsPrimarySharedKey: monitoring.outputs.logAnalyticsPrimarySharedKey
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    existingCosmosAccountName: existingCosmosAccountName
    storageConnectionString: storage.outputs.connectionStringSecretUri
  }
}

// ── AcrPull role (phase 2 — no circular dependency) ─────────────────────────
module acrPullRole './modules/acr-pull-role.bicep' = {
  name: 'acrPullRole'
  params: {
    acrName: containerRegistry.outputs.name
    principalId: api.outputs.systemAssignedMIPrincipalId
  }
}

// ── Static Web App (frontend) ────────────────────────────────────────────────
module staticWebApp './modules/static-web-app.bicep' = {
  name: 'staticWebApp'
  params: {
    location: staticWebAppLocation
    backendLocation: location
    workloadName: workloadName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: tags
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output BACKEND_API_URL string = api.outputs.uri
output FRONTEND_URL string = staticWebApp.outputs.defaultHostname
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.outputs.name
output AZURE_KEY_VAULT_NAME string = keyVault.outputs.name
output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.accountName
