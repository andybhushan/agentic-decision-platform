// modules/sql.bicep
// Azure SQL Server + Database hosting the v0 semantic layer (dim_policyholder, dim_vehicle, fact_claims).
//
// v0 sized for the demo: Basic SKU (~$5/month). v1 migrates to Fabric Lakehouse per ADR-0011;
// the schema + SqlSemanticLayerSource interface stay; only the storage backend changes.
//
// Auth: SQL authentication for v0 simplicity. v1+ moves to Entra-only.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object
@secure()
param sqlAdminPassword string
param sqlAdminLogin string = 'adpadmin'

resource sqlServer 'Microsoft.Sql/servers@2024-11-01-preview' = {
  name: 'sql-adp-${envSlug}'
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: '1.2'
    version: '12.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2024-11-01-preview' = {
  parent: sqlServer
  name: 'adp-semantic'
  location: location
  tags: tags
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648   // 2 GB — plenty for v0 semantic-layer data
  }
}

// Allow Azure services (Functions, Container Apps) to connect.
resource allowAzure 'Microsoft.Sql/servers/firewallRules@2024-11-01-preview' = {
  parent: sqlServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Allow local dev (Anand's machine) — broad rule for v0; private endpoints in v1.
resource allowAll 'Microsoft.Sql/servers/firewallRules@2024-11-01-preview' = {
  parent: sqlServer
  name: 'AllowAllForV0'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output serverName string = sqlServer.name
output databaseName string = sqlDatabase.name
output sqlAdminLogin string = sqlAdminLogin
