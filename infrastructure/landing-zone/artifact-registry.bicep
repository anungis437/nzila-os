targetScope = 'resourceGroup'

@minLength(5)
@maxLength(50)
@description('Globally unique ACR name; lowercase letters and numbers only.')
param registryName string
@allowed(['canadacentral'])
param location string = 'canadacentral'
param tags object
param endpointSubnetId string
param registryPrivateDnsZoneId string
param workloadIdentityName string
@minLength(36)
@maxLength(36)
param workloadPrincipalId string

resource registry 'Microsoft.ContainerRegistry/registries@2025-04-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {name: 'Premium'}
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: 'Disabled'
    networkRuleBypassOptions: 'None'
  }
}

resource builderIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${registryName}-build-identity'
  location: location
  tags: union(tags, {service: 'artifact-builder-identity'})
}

module endpoint 'private-endpoint.bicep' = {
  name: 'registry-endpoint'
  params: {
    name: '${registryName}-pe'
    location: location
    tags: union(tags, {service: 'artifact-registry-network'})
    subnetId: endpointSubnetId
    targetId: registry.id
    groupId: 'registry'
    dnsZoneId: registryPrivateDnsZoneId
  }
}

resource workloadPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(
    registry.id,
    resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', workloadIdentityName),
    'acr-pull'
  )
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: workloadPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource builderPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, builderIdentity.id, 'acr-push')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '8311e382-0749-4cb8-b61a-304f252e45ec'
    )
    principalId: builderIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output registryId string = registry.id
output loginServer string = registry.properties.loginServer
output builderIdentityId string = builderIdentity.id
output builderPrincipalId string = builderIdentity.properties.principalId
