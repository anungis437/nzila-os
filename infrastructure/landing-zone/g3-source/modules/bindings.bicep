targetScope = 'resourceGroup'
@allowed([false])
param rbacAuthorized bool = false
param vaultName string
param runtimePrincipalId string
resource vault 'Microsoft.KeyVault/vaults@2024-11-01' existing = { name: vaultName }
resource secret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' existing = {
  parent: vault
  name: 'g3-proof-secret'
}
resource runtimeGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (rbacAuthorized) {
  scope: secret
  name: guid(secret.id, runtimePrincipalId, '4633458b-17de-408a-b874-0445c86b69e6')
  properties: {
    principalId: runtimePrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
  }
}
output status string = 'PROPOSED_NOT_AUTHORIZED'
output externalRegistryBinding string = 'EXTERNAL_G2_MUTATION_DEPENDENCY;EXACT_REPOSITORY_ABAC_READER_AND_OPERATOR_WRITER;NO_ACRPULL_FALLBACK'
