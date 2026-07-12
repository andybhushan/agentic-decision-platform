// modules/static-web-app.bicep — React frontend on Azure Static Web Apps

param location string
param backendLocation string
param workloadName string
param environmentName string
param resourceToken string
param tags object

var swaName = 'stapp-${workloadName}-${environmentName}-${resourceToken}'

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      outputLocation: 'dist'
      appBuildCommand: 'npm run build'
    }
  }
}

// Link backend Container App as the SWA backend (proxies /api/* calls)
resource swaBackend 'Microsoft.Web/staticSites/linkedBackends@2023-01-01' = {
  name: 'backend'
  parent: staticWebApp
  properties: {
    backendResourceId: resourceId('Microsoft.App/containerApps', 'ca-${workloadName}-${environmentName}-${resourceToken}')
    region: backendLocation
  }
}

output defaultHostname string = 'https://${staticWebApp.properties.defaultHostname}'
output name string = staticWebApp.name
output id string = staticWebApp.id
