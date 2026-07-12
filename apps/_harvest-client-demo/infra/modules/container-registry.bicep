// modules/container-registry.bicep — Azure Container Registry
// Name: alphanumeric only (no hyphens), 5–50 chars

param location string
param workloadName string
param environmentName string
param resourceToken string
param tags object

// Alphanumeric only — no hyphens allowed in ACR names
#disable-next-line BCP334
var acrName = take(replace('cr${workloadName}${environmentName}${resourceToken}', '-', ''), 50)

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  #disable-next-line BCP334
  name: acrName
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false  // Use managed identity, not admin credentials
  }
}

output name string = containerRegistry.name
output id string = containerRegistry.id
output loginServer string = containerRegistry.properties.loginServer
