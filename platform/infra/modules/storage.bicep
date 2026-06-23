// modules/storage.bicep
// General-purpose storage account. Used by Functions runtime + general workloads.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

// Storage account names: 3-24 chars, lower-case alphanumeric only. No hyphens.
var accountName = 'stadp${toLower(envSlug)}'

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: accountName
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true   // Functions runtime still uses this; v1 will move to identity-only
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

output accountName string = storage.name
output resourceId string = storage.id
output primaryEndpoint string = storage.properties.primaryEndpoints.blob
