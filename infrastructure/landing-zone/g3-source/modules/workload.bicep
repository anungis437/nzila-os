targetScope = 'resourceGroup'
@allowed([false])
param workloadActivationAuthorized bool = false
param location string
param names object
param tags object
param environmentId string
param buildIdentityId string
param runtimeIdentityId string
param immutableImage string

var imagePrefix = 'nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@sha256:'
var digest = last(split(immutableImage, '@sha256:'))
var immutableImageValid = startsWith(immutableImage, imagePrefix) && length(immutableImage) == length(imagePrefix) + 64 && length(digest) == 64 && length(filter(
  range(0, length(digest)),
  index => !contains('0123456789abcdef', substring(digest, index, 1))
)) == 0

resource app 'Microsoft.App/containerApps@2025-07-01' = if (workloadActivationAuthorized && immutableImageValid) {
  name: names.application
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${buildIdentityId}': {}
      '${runtimeIdentityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      identitySettings: [
        { identity: buildIdentityId, lifecycle: 'None' }
        { identity: runtimeIdentityId, lifecycle: 'Main' }
      ]
      registries: [{ server: 'nzilag2tzo75uuozprbo.azurecr.io', identity: buildIdentityId }]
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'g3-proof-secret'
          keyVaultUrl: 'https://${names.keyVault}${environment().suffixes.keyvaultDns}/secrets/g3-proof-secret'
          identity: runtimeIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'g3-synthetic-proof-v1'
          image: immutableImage
          env: [{ name: 'G3_PROOF_SECRET', secretRef: 'g3-proof-secret' }]
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          probes: [
            {
              type: 'Readiness'
              httpGet: { path: '/healthz', port: 3000 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
            {
              type: 'Liveness'
              httpGet: { path: '/healthz', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}
output authorityStatus string = 'DENY;PROSPECTIVE_SOURCE_ONLY'
output imageAuthorityId string = 'G3_SYNTHETIC_PROOF_V1'
output imageValidationStatus string = immutableImageValid
  ? 'VALID_IMMUTABLE_REFERENCE;NOT_EXECUTION_AUTHORITY'
  : 'DENY_MISSING_OR_INVALID_REGISTRY_DIGEST'
