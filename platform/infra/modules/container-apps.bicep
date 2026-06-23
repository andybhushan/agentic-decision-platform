// modules/container-apps.bicep
// Container Apps environment. Apps themselves deferred to D5 when service images exist.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object
param logAnalyticsCustomerId string
@secure()
param logAnalyticsSharedKey string

#disable-next-line BCP081
resource env 'Microsoft.App/managedEnvironments@2024-10-02-preview' = {
  name: 'cae-adp-${envSlug}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    zoneRedundant: false
  }
}

output environmentId string = env.id
output environmentName string = env.name
output defaultDomain string = env.properties.defaultDomain
