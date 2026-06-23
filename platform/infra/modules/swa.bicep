// modules/swa.bicep
// Azure Static Web App that hosts the operator console.
// Matches the pattern used in adp-portal (per DEPLOYMENT_REFERENCE.md).

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'swa-adp-${envSlug}-console'
  location: location
  tags: tags
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    repositoryUrl: ''   // local deploy via swa CLI; no GitHub link
    branch: ''
    buildProperties: {
      appLocation: 'platform/console'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

output name string = swa.name
output defaultHostname string = swa.properties.defaultHostname
