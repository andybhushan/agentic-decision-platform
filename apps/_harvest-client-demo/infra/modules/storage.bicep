// modules/storage.bicep — Storage account for evidence blob uploads
// Name: alphanumeric only, max 24 chars (no hyphens)

param location string
param workloadName string
param environmentName string
param resourceToken string
param tags object
param managedIdentityPrincipalId string

// Alphanumeric only — strip hyphens, truncate to 24 chars
#disable-next-line BCP334
var storageAccountName = take(replace('st${workloadName}${environmentName}${resourceToken}', '-', ''), 24)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  #disable-next-line BCP334
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  name: 'default'
  parent: storageAccount
}

resource evidenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  name: 'evidence-uploads'
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

// Grant "Storage Blob Data Contributor" to managed identity
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource blobContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentityPrincipalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output accountName string = storageAccount.name
output accountId string = storageAccount.id
#disable-next-line outputs-should-not-contain-secrets
output connectionStringSecretUri string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
