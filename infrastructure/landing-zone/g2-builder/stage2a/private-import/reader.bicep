param assignmentName string
var principalId = 'c59571aa-66ea-47c5-83d5-59946b318ae2'
var roleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b93aa761-3e63-49ed-ac28-beffa264f7ac')
var condition = '((!(ActionMatches{\'Microsoft.ContainerRegistry/registries/repositories/metadata/read\'}) AND !(ActionMatches{\'Microsoft.ContainerRegistry/registries/repositories/content/read\'})) OR (@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase \'g2-tooling\'))'

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: 'nzilag2tzo75uuozprbo'
}

resource toolingReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: assignmentName
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: roleDefinitionId
    conditionVersion: '2.0'
    condition: condition
  }
}
