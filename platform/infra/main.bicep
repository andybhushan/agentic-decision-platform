// platform/infra/main.bicep
// Entry point for v0 Azure resources for adp-v1.
// Resource group is created out-of-band (az group create rg-adp-v1).
// Run: az deployment group create --resource-group rg-adp-v1 \
//      --template-file main.bicep --parameters parameters/dev.bicepparam
//
// IMPORTANT: per feedback_adp_portal_local_first, do NOT deploy without explicit user signal.

targetScope = 'resourceGroup'

@description('Azure region. Defaults to resource group location.')
param location string = resourceGroup().location

@description('Short environment slug used to make resource names unique. Lower-case, alphanumeric, <= 12 chars.')
@minLength(2)
@maxLength(12)
param envSlug string = 'v1'

@description('Common resource tags applied to every resource.')
param tags object = {
  project: 'adp-v1'
  environment: envSlug
  owner: 'anand-track'
  managedBy: 'bicep'
}

// ----- Foundational ---------------------------------------------------------

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

// ----- Data + Events --------------------------------------------------------

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

module eventhubs 'modules/eventhubs.bicep' = {
  name: 'eventhubs'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

module eventgrid 'modules/eventgrid.bicep' = {
  name: 'eventgrid'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

module aiSearch 'modules/ai-search.bicep' = {
  name: 'ai-search'
  params: {
    envSlug: envSlug
    tags: tags
  }
}

// ----- Compute --------------------------------------------------------------

module containerApps 'modules/container-apps.bicep' = {
  name: 'container-apps'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
    logAnalyticsCustomerId: logAnalytics.outputs.customerId
    logAnalyticsSharedKey: logAnalytics.outputs.sharedKey
  }
}

module functions 'modules/functions.bicep' = {
  name: 'functions'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
    storageAccountName: storage.outputs.accountName
    appInsightsConnectionString: logAnalytics.outputs.appInsightsConnectionString
  }
}

module swa 'modules/swa.bicep' = {
  name: 'swa'
  params: {
    location: location
    envSlug: envSlug
    tags: tags
  }
}

// ----- Outputs --------------------------------------------------------------

output cosmosAccountName string = cosmos.outputs.accountName
output cosmosEndpoint string = cosmos.outputs.endpoint
output eventHubNamespace string = eventhubs.outputs.namespaceName
output eventHubTopic string = eventhubs.outputs.topicName
output eventGridTopicEndpoint string = eventgrid.outputs.endpoint
output keyVaultUri string = keyvault.outputs.uri
output containerAppsEnvId string = containerApps.outputs.environmentId
output functionAppName string = functions.outputs.functionAppName
output staticWebAppName string = swa.outputs.name
output aiSearchEndpoint string = aiSearch.outputs.endpoint
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId
