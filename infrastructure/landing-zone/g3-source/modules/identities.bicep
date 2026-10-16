targetScope = 'resourceGroup'
@allowed([false])
param provisionResources bool = false
param location string
param names object
param tags object
resource buildIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (provisionResources) {
  name: names.pullIdentity
  location: location
  tags: tags
}
resource runtimeIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (provisionResources) {
  name: names.runtimeIdentity
  location: location
  tags: tags
}
output buildIdentityId string = resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', names.pullIdentity)
output runtimeIdentityId string = resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', names.runtimeIdentity)
output runtimePrincipalId string = provisionResources ? runtimeIdentity!.properties.principalId : ''
output buildIdentityPurpose string = 'PLATFORM_PULL_ONLY_NONE;G3A_PUSH_REMAINS_SEPARATE_OPERATOR_NOT_THIS_UAMI'
