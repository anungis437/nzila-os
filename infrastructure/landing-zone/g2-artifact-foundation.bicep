targetScope = 'subscription'

@description('Required accountable owner for all resources in this isolated proof.')
@minLength(1)
param owner string

@description('Required approved cost center for the proof environment.')
@minLength(1)
param costCenter string

var registryName = 'nzila${uniqueString(subscription().subscriptionId, 'ue-g2-proof')}acr'

resource productGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'nzila-union-eyes-integration-test-rg'
  location: 'canadacentral'
  tags: {
    product: 'union-eyes'
    environment: 'integration-test'
    service: 'foundation'
    purpose: 'infrastructure-proof'
    owner: owner
    cost_center: costCenter
    data_classification: 'synthetic'
  }
}

module network 'g2-artifact-network.bicep' = {
  name: 'nzila-g2-proof-network'
  scope: productGroup
  params: {
    product: 'union-eyes'
    environment: 'integration-test'
    location: 'canadacentral'
    owner: owner
    costCenter: costCenter
  }
}

module registry 'artifact-registry.bicep' = {
  name: 'nzila-g2-proof-artifact-registry'
  scope: productGroup
  params: {
    registryName: registryName
    location: 'canadacentral'
    tags: {
      product: 'union-eyes'
      environment: 'integration-test'
      service: 'artifact-registry'
      purpose: 'infrastructure-proof'
      owner: owner
      cost_center: costCenter
      data_classification: 'synthetic'
    }
    endpointSubnetId: network.outputs.endpointSubnetId
    registryPrivateDnsZoneId: network.outputs.registryPrivateDnsZoneId
    workloadIdentityName: 'nzila-union-eyes-integration-test-proof-api-identity'
    workloadPrincipalId: network.outputs.workloadPrincipalId
  }
}

output productResourceGroupName string = productGroup.name
output registryId string = registry.outputs.registryId
output registryLoginServer string = registry.outputs.loginServer
output workloadIdentityId string = network.outputs.workloadIdentityId
output builderIdentityId string = registry.outputs.builderIdentityId
