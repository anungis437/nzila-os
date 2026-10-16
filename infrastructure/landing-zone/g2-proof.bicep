targetScope = 'subscription'

@description('Required accountable owner for all resources in this isolated proof.')
@minLength(1)
param owner string

@description('Required approved cost center for the proof environment.')
@minLength(1)
param costCenter string

@description('Existing Entra security group authorized for synthetic database administration.')
@minLength(1)
param databaseAdminGroupName string

@minLength(36)
@maxLength(36)
param databaseAdminGroupObjectId string

param imageRepository string

@minLength(40)
@maxLength(40)
@description('Full lowercase source commit SHA used to build the deployed artifact.')
param sourceCommit string

@minLength(64)
@maxLength(64)
@description('Full lowercase SHA256 digest of the synthetic proof image; mutable tags are not accepted.')
param imageDigest string

@minValue(1)
@maxValue(65535)
param targetPort int

@description('Synthetic workload readiness endpoint. Required; no platform default.')
param readinessPath string

@description('Synthetic workload liveness endpoint. Required; no platform default.')
param livenessPath string

module foundation 'landing-zone.bicep' = {
  name: 'nzila-g2-proof-foundation'
  params: {
    product: 'union-eyes'
    environment: 'integration-test'
    location: 'canadacentral'
    owner: owner
    costCenter: costCenter
    purpose: 'infrastructure-proof'
    dataClassification: 'synthetic'
    workloadName: 'proof-api'
    databaseAdminGroupName: databaseAdminGroupName
    databaseAdminGroupObjectId: databaseAdminGroupObjectId
  }
}

var registryName = 'nzila${uniqueString(subscription().subscriptionId, 'ue-g2-proof')}acr'
module registry 'artifact-registry.bicep' = {
  name: 'nzila-g2-proof-artifact-registry'
  scope: resourceGroup(subscription().subscriptionId, 'nzila-union-eyes-integration-test-rg')
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
    endpointSubnetId: foundation.outputs.endpointSubnetId
    registryPrivateDnsZoneId: foundation.outputs.registryPrivateDnsZoneId
    workloadIdentityName: 'nzila-union-eyes-integration-test-proof-api-identity'
    workloadPrincipalId: foundation.outputs.workloadPrincipalId
  }
}

module runtime 'runtime.bicep' = {
  name: 'nzila-g2-proof-runtime'
  scope: resourceGroup(subscription().subscriptionId, 'nzila-union-eyes-integration-test-rg')
  params: {
    product: 'union-eyes'
    environment: 'integration-test'
    location: 'canadacentral'
    owner: owner
    costCenter: costCenter
    purpose: 'infrastructure-proof'
    dataClassification: 'synthetic'
    workloadName: 'proof-api'
    operationsWorkspaceId: foundation.outputs.operationsWorkspaceId
    imageRegistry: registry.outputs.loginServer
    imageRepository: imageRepository
    sourceCommit: sourceCommit
    imageDigest: imageDigest
    targetPort: targetPort
    readinessPath: readinessPath
    livenessPath: livenessPath
    appSubnetId: foundation.outputs.appSubnetId
    endpointSubnetId: foundation.outputs.endpointSubnetId
    appPrivateDnsZoneId: foundation.outputs.appPrivateDnsZoneId
    workloadIdentityId: foundation.outputs.workloadIdentityId
  }
}

module edge 'edge.bicep' = {
  name: 'nzila-g2-proof-edge'
  scope: resourceGroup(subscription().subscriptionId, 'nzila-shared-integration-test-edge-rg')
  params: {
    product: 'union-eyes'
    environment: 'integration-test'
    owner: owner
    costCenter: costCenter
    purpose: 'infrastructure-proof'
    managedEnvironmentId: runtime.outputs.managedEnvironmentId
    originHost: runtime.outputs.originHost
    readinessPath: readinessPath
    operationsWorkspaceId: foundation.outputs.operationsWorkspaceId
    securityWorkspaceId: foundation.outputs.securityWorkspaceId
    privateLinkLocation: 'canadacentral'
  }
}

output productResourceGroupName string = foundation.outputs.productResourceGroupName
output operationsResourceGroupName string = 'nzila-shared-integration-test-operations-rg'
output securityResourceGroupName string = 'nzila-shared-integration-test-security-rg'
output edgeResourceGroupName string = foundation.outputs.edgeResourceGroupName
output managedEnvironmentId string = runtime.outputs.managedEnvironmentId
output originHost string = runtime.outputs.originHost
output frontDoorEndpointHost string = edge.outputs.endpointHost
