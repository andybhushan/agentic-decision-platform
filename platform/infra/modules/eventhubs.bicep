// modules/eventhubs.bicep
// Event Hubs namespace (Kafka API enabled) + the adp-v1-decisions topic.
// Decision bus per ADR-0004.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

resource ns 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: 'evh-adp-${envSlug}'
  location: location
  tags: tags
  sku: { name: 'Standard', tier: 'Standard', capacity: 1 }
  properties: {
    isAutoInflateEnabled: false
    kafkaEnabled: true
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource topic 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: ns
  name: 'adp-${envSlug}-decisions'
  properties: {
    partitionCount: 4
    messageRetentionInDays: 7
  }
}

resource consumerGroupConsole 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: topic
  name: 'console'
  properties: {}
}

resource consumerGroupIngest 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: topic
  name: 'decision-ingest'
  properties: {}
}

output namespaceName string = ns.name
output topicName string = topic.name
output endpoint string = ns.properties.serviceBusEndpoint
