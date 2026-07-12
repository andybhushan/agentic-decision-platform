// modules/keyvault.bicep — Key Vault with RBAC model + soft-delete

param location string
param workloadName string
param environmentName string
param resourceToken string
param tags object

var keyVaultName = 'kv-${workloadName}-${environmentName}-${take(resourceToken, 8)}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

output name string = keyVault.name
output uri string = keyVault.properties.vaultUri
output id string = keyVault.id
