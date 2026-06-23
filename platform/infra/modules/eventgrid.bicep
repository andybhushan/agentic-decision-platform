// modules/eventgrid.bicep
// Event Grid custom topic for low-volume fan-out signals (HITL opened, trace complete).
// Distinct from the decision bus on Event Hubs.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

resource topic 'Microsoft.EventGrid/topics@2024-12-15-preview' = {
  name: 'egt-adp-${envSlug}-fanout'
  location: location
  tags: tags
  properties: {
    inputSchema: 'CloudEventSchemaV1_0'
    publicNetworkAccess: 'Enabled'
  }
}

output name string = topic.name
output endpoint string = topic.properties.endpoint
output resourceId string = topic.id
