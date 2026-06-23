using '../main.bicep'

param location = 'eastus2'
param envSlug = 'v1'
param tags = {
  project: 'adp-v1'
  environment: 'dev'
  owner: 'anand-track'
  managedBy: 'bicep'
}
