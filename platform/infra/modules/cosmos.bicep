// modules/cosmos.bicep
// Cosmos DB account + database + dw-state container.
// Partition key /subjectId per ADR-0004.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cdb-adp-${envSlug}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      { locationName: location, failoverPriority: 0, isZoneRedundant: false }
    ]
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: false
    capabilities: [
      { name: 'EnableServerless' }   // v0 cost discipline
    ]
    minimalTlsVersion: 'Tls12'
    publicNetworkAccess: 'Enabled'
  }
}

resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: account
  name: 'adp'
  properties: {
    resource: { id: 'adp' }
  }
}

resource dwStateContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-12-01-preview' = {
  parent: db
  name: 'dw-state'
  properties: {
    resource: {
      id: 'dw-state'
      partitionKey: {
        paths: [ '/subjectId' ]
        kind: 'Hash'
      }
      defaultTtl: -1
    }
  }
}

output accountName string = account.name
output endpoint string = account.properties.documentEndpoint
output resourceId string = account.id
output databaseName string = db.name
output dwStateContainerName string = dwStateContainer.name
