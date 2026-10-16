targetScope = 'subscription'

@allowed([false])
param provisionResources bool = false
@allowed(['canadacentral'])
param location string = 'canadacentral'
param names object
param tags object
param networkRules object
param g2VnetId string
param keyVaultPurgeProtection bool
param discoveredEndpointIps array = []
param approvedPlatformPrefixes array = []
param immutableImage string = ''
param quotaEvidenceId string = ''
param availableConsumptionMilliCores int = 0
@allowed([false])
param workloadActivationAuthorized bool = false
@allowed([false])
param rbacAuthorized bool = false

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = if (provisionResources) {
  name: names.resourceGroup
  location: location
  tags: tags
}

module network './modules/network.bicep' = if (provisionResources) {
  name: 'g3-network'
  scope: group
  params: {
    provisionResources: provisionResources
    location: location
    names: names
    tags: tags
    networkRules: networkRules
    g2VnetId: g2VnetId
    discoveredEndpointIps: discoveredEndpointIps
    approvedPlatformPrefixes: approvedPlatformPrefixes
  }
}
module foundation './modules/identities.bicep' = if (provisionResources) {
  name: 'g3-identities'
  scope: group
  params: {
    provisionResources: provisionResources
    location: location
    names: names
    tags: tags
  }
}
module observability './modules/observability.bicep' = if (provisionResources) {
  name: 'g3-observability'
  scope: group
  params: {
    provisionResources: provisionResources
    location: location
    names: names
    tags: tags
  }
}
module vault './modules/vault.bicep' = if (provisionResources) {
  name: 'g3-private-vault'
  scope: group
  params: {
    provisionResources: provisionResources
    location: location
    names: names
    tags: tags
    vnetId: network!.outputs.vnetId
    endpointSubnetId: network!.outputs.endpointSubnetId
    purgeProtection: keyVaultPurgeProtection
  }
}
module environment './modules/environment.bicep' = if (provisionResources) {
  name: 'g3-empty-environment'
  scope: group
  params: {
    provisionResources: provisionResources
    location: location
    names: names
    tags: tags
    acaSubnetId: network!.outputs.acaSubnetId
    vnetId: network!.outputs.vnetId
    workspaceId: observability!.outputs.workspaceId
  }
}
module bindings './modules/bindings.bicep' = if (provisionResources && rbacAuthorized) {
  name: 'g3-runtime-secret-binding'
  scope: group
  params: {
    rbacAuthorized: rbacAuthorized
    vaultName: names.keyVault
    runtimePrincipalId: foundation!.outputs.runtimePrincipalId
  }
}
module workload './modules/workload.bicep' = if (provisionResources && workloadActivationAuthorized && !empty(quotaEvidenceId) && availableConsumptionMilliCores >= 250) {
  name: 'g3-synthetic-workload'
  scope: group
  params: {
    workloadActivationAuthorized: workloadActivationAuthorized
    location: location
    names: names
    tags: tags
    environmentId: environment!.outputs.environmentId
    buildIdentityId: foundation!.outputs.buildIdentityId
    runtimeIdentityId: foundation!.outputs.runtimeIdentityId
    immutableImage: immutableImage
  }
}
output deploymentStatus string = 'NOT_AUTHORIZED_PROSPECTIVE_G3R2'
output g2MutationAllowed bool = false
output postCreateGate string = 'QUERY_ENVIRONMENT_CONSUMPTION_CORES_BEFORE_WORKLOAD_ACTIVATION'
output imageSourceAuthority string = 'G3_SYNTHETIC_PROOF_V1;FUTURE_REGISTRY_MANIFEST_REQUIRED'
