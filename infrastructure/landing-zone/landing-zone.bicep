targetScope = 'subscription'
@allowed(['union-eyes', 'cora'])
param product string
@allowed(['development', 'integration-test', 'staging', 'production'])
param environment string
@allowed(['canadacentral'])
param location string = 'canadacentral'
@minLength(1)
param owner string
@minLength(1)
param costCenter string
@allowed(['product-runtime', 'infrastructure-proof'])
param purpose string
@allowed(['synthetic', 'internal', 'confidential', 'institutional'])
param dataClassification string
param workloadName string
param databaseAdminGroupName string
param databaseAdminGroupObjectId string

resource operationsGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'nzila-shared-${environment}-operations-rg'
  location: location
  tags: {
    product: 'shared'
    environment: environment
    service: 'operations'
    purpose: purpose
    owner: owner
    cost_center: costCenter
    data_classification: 'confidential'
  }
}
resource securityGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'nzila-shared-${environment}-security-rg'
  location: location
  tags: {
    product: 'shared'
    environment: environment
    service: 'security'
    purpose: purpose
    owner: owner
    cost_center: costCenter
    data_classification: 'confidential'
  }
}
resource edgeGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'nzila-shared-${environment}-edge-rg'
  location: location
  tags: {
    product: 'shared'
    environment: environment
    service: 'edge'
    purpose: purpose
    owner: owner
    cost_center: costCenter
    data_classification: 'confidential'
  }
}
resource productGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'nzila-${product}-${environment}-rg'
  location: location
  tags: {
    product: product
    environment: environment
    service: 'foundation'
    purpose: purpose
    owner: owner
    cost_center: costCenter
    data_classification: dataClassification
  }
}
module operations 'operations.bicep' = {
  name: '${environment}-operations'
  scope: operationsGroup
  params: {
    service: 'operations'
    environment: environment
    location: location
    owner: owner
    costCenter: costCenter
    purpose: purpose
  }
}
module security 'operations.bicep' = {
  name: '${environment}-security'
  scope: securityGroup
  params: {
    service: 'security'
    environment: environment
    location: location
    owner: owner
    costCenter: costCenter
    purpose: purpose
  }
}
module foundation 'foundation.bicep' = {
  name: '${product}-${environment}-foundation'
  scope: productGroup
  params: {
    product: product
    environment: environment
    location: location
    owner: owner
    costCenter: costCenter
    dataClassification: dataClassification
    purpose: purpose
    workloadName: workloadName
    databaseAdminGroupName: databaseAdminGroupName
    databaseAdminGroupObjectId: databaseAdminGroupObjectId
    operationsWorkspaceId: operations.outputs.workspaceId
    securityWorkspaceId: security.outputs.workspaceId
  }
}
output operationsWorkspaceId string = operations.outputs.workspaceId
output securityWorkspaceId string = security.outputs.workspaceId
output productResourceGroupName string = productGroup.name
output edgeResourceGroupName string = edgeGroup.name
output appSubnetId string = foundation.outputs.appSubnetId
output endpointSubnetId string = foundation.outputs.endpointSubnetId
output appPrivateDnsZoneId string = foundation.outputs.appPrivateDnsZoneId
output registryPrivateDnsZoneId string = foundation.outputs.registryPrivateDnsZoneId
output workloadIdentityId string = foundation.outputs.workloadIdentityId
output workloadPrincipalId string = foundation.outputs.workloadPrincipalId
output databaseHost string = foundation.outputs.databaseHost
output vaultUri string = foundation.outputs.vaultUri
output storageAccountName string = foundation.outputs.storageAccountName
