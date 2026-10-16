targetScope = 'resourceGroup'
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
@minLength(1)
@maxLength(10)
param workloadName string
param appSubnetId string
param endpointSubnetId string
param appPrivateDnsZoneId string
param workloadIdentityId string
param operationsWorkspaceId string
@description('ACR login server from the proof-scoped private registry module.')
param imageRegistry string
param imageRepository string
@minLength(40)
@maxLength(40)
@description('Full lowercase source commit SHA used to build the deployed artifact.')
param sourceCommit string
@minLength(64)
@maxLength(64)
@description('Lowercase hex digest; validate with validate.mjs before any deployment. Tags have no fallback.')
param imageDigest string
@minValue(1)
@maxValue(65535)
param targetPort int
@description('Product-owned probe paths, never guessed by the platform.')
param readinessPath string
param livenessPath string

var naming = loadJsonContent('naming.json')
var prefix = 'nzila-${product}-${naming.environmentCodes[environment]}'
var tags = {
  product: product
  environment: environment
  service: 'runtime'
  purpose: purpose
  owner: owner
  cost_center: costCenter
  data_classification: dataClassification
}
resource managedEnvironment 'Microsoft.App/managedEnvironments@2025-07-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    publicNetworkAccess: 'Disabled'
    zoneRedundant: environment == 'production'
    vnetConfiguration: {
      infrastructureSubnetId: appSubnetId
      internal: true
    }
    workloadProfiles: [
      {name: 'Consumption', workloadProfileType: 'Consumption'}
    ]
    appLogsConfiguration: {destination: 'azure-monitor'}
  }
}
resource logs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'runtime-logs'
  scope: managedEnvironment
  properties: {
    workspaceId: operationsWorkspaceId
    logs: [
      {category: 'ContainerAppConsoleLogs', enabled: true}
      {category: 'ContainerAppSystemLogs', enabled: true}
    ]
    metrics: [{category: 'AllMetrics', enabled: true}]
  }
}
module endpoint 'private-endpoint.bicep' = {
  name: 'runtime-endpoint'
  params: {
    name: '${prefix}-runtime-pe'
    location: location
    tags: union(tags, {service: 'runtime-network'})
    subnetId: endpointSubnetId
    targetId: managedEnvironment.id
    groupId: 'managedEnvironments'
    dnsZoneId: appPrivateDnsZoneId
  }
}
resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: '${prefix}-${workloadName}'
  location: location
  tags: union(tags, {source_commit: sourceCommit})
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workloadIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [{server: imageRegistry, identity: workloadIdentityId}]
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: workloadName
          image: '${imageRegistry}/${imageRepository}@sha256:${imageDigest}'
          resources: {cpu: json('0.5'), memory: '1Gi'}
          env: [
            {name: 'AZURE_CLIENT_ID', value: reference(workloadIdentityId, '2023-01-31').clientId}
          ]
          probes: [
            {
              type: 'Readiness'
              httpGet: {path: readinessPath, port: targetPort}
              initialDelaySeconds: 10
              periodSeconds: 10
            }
            {
              type: 'Liveness'
              httpGet: {path: livenessPath, port: targetPort}
              initialDelaySeconds: 30
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'production' ? 2 : 0
        maxReplicas: environment == 'production' ? 5 : 2
        rules: [
          {name: 'http', http: {metadata: {concurrentRequests: '50'}}}
        ]
      }
    }
  }
}
output managedEnvironmentId string = managedEnvironment.id
output originHost string = app.properties.configuration.ingress.fqdn
