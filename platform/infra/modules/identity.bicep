// modules/identity.bicep
// User-assigned managed identities, one per workload (per ADR-0008).
// No shared service principals — each workload gets a distinct principal id.

targetScope = 'resourceGroup'

param location string
param envSlug string
param tags object

var workloads = [
  'orchestrator'
  'decision-ingest'
  'context-router'
  'mcp-claim-store'
  'mcp-policy-store'
  'console-api'
]

resource workloadIdentities 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = [for w in workloads: {
  name: 'id-adp-${envSlug}-${w}'
  location: location
  tags: tags
}]

output identityResourceIds array = [for (w, i) in workloads: workloadIdentities[i].id]
output workloadPrincipalIds array = [for (w, i) in workloads: workloadIdentities[i].properties.principalId]
output workloadClientIds array = [for (w, i) in workloads: workloadIdentities[i].properties.clientId]
output workloadNames array = workloads
