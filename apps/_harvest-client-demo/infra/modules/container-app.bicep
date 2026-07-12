// modules/container-app.bicep — Container Apps Environment + Backend API app
// Uses placeholder image on first deploy; azd deploy updates to ACR image

param location string
param workloadName string
param environmentName string
param resourceToken string
param tags object
param logAnalyticsCustomerId string
@secure()
param logAnalyticsPrimarySharedKey string
param applicationInsightsConnectionString string
param existingCosmosAccountName string

@description('Storage account connection string for evidence blob uploads')
@secure()
param storageConnectionString string

var caeName = 'cae-${workloadName}-${environmentName}-${resourceToken}'
var caName   = 'ca-${workloadName}-${environmentName}-${resourceToken}'

// ── Container Apps Environment ───────────────────────────────────────────────
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: caeName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsPrimarySharedKey
      }
    }
  }
}

// ── Existing Cosmos DB (for CORS/env reference) ──────────────────────────────
resource existingCosmos 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: existingCosmosAccountName
}

// ── Container App — Backend API ──────────────────────────────────────────────
// Starts with placeholder image; azd deploy replaces with ACR image
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: caName
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  identity: { type: 'SystemAssigned' }
  properties: {
    environmentId: containerAppsEnv.id
    configuration: {
      secrets: [
        {
          name: 'storage-connection-string'
          value: storageConnectionString
        }
        {
          name: 'cosmos-key'
          value: existingCosmos.listKeys().primaryMasterKey
        }
      ]
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
        }
      }
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
      containers: [
        {
          name: 'api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: applicationInsightsConnectionString }
            { name: 'COSMOS_ENDPOINT', value: existingCosmos.properties.documentEndpoint }
            { name: 'COSMOS_KEY', secretRef: 'cosmos-key' }
            { name: 'COSMOS_DB_NAME', value: 'project-imagine' }
            { name: 'COSMOS_STEWARD_DATABASE', value: 'agent-workflow-builder' }
            { name: 'COSMOS_STEWARD_CLAIMS_CONTAINER', value: 'claim-chunks' }
            { name: 'COSMOS_STEWARD_CONVERSATIONS_CONTAINER', value: 'conversations' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection-string' }
            { name: 'EVIDENCE_CONTAINER_NAME', value: 'evidence-uploads' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health', port: 3000 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
    }
  }
}

output uri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output name string = containerApp.name
output systemAssignedMIPrincipalId string = containerApp.identity.principalId
