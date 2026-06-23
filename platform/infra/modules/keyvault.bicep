// modules/keyvault.bicep
// Key Vault with RBAC authorisation enabled.
// Role assignments to workload identities are GRANTED POST-DEPLOY via az role assignment create —
// the deploying user (Anand) does not hold Microsoft.Authorization/roleAssignments/write at the
// vault scope on this subscription. See docs/DEPLOY.md "Post-deploy role grants".

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: 'kv-adp-${envSlug}'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'  // v0 — private endpoints in v1
  }
}

output uri string = vault.properties.vaultUri
output name string = vault.name
output resourceId string = vault.id
