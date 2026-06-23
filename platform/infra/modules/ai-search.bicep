// modules/ai-search.bicep
// Azure AI Search instance backing Foundry IQ knowledge base (per ADR-0009).
// Pinned to eastus because eastus2 reported InsufficientResourcesAvailable for basic SKU on 2026-05-26.
// Cross-region resources within one RG are supported; the rest of the platform stays in eastus2.

targetScope = 'resourceGroup'

param envSlug string
param tags object
@description('Region for AI Search. eastus2 was out of basic-SKU capacity; eastus is the fallback.')
param searchLocation string = 'eastus'

resource search 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: 'srch-adp-${envSlug}'
  location: searchLocation
  tags: tags
  sku: { name: 'basic' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    semanticSearch: 'free'
    disableLocalAuth: false   // v0 — identity-only auth in v1
  }
}

output name string = search.name
output endpoint string = 'https://${search.name}.search.windows.net'
output resourceId string = search.id
output location string = search.location
