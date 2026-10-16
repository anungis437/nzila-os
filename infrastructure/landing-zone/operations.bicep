targetScope = 'resourceGroup'
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

@allowed(['operations', 'security'])
param service string

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'nzila-shared-${environment}-${service}-law'
  location: location
  tags: {
    product: 'shared'
    environment: environment
    service: service
    purpose: purpose
    owner: owner
    cost_center: costCenter
    data_classification: 'confidential'
  }
  properties: {
    sku: {name: 'PerGB2018'}
    retentionInDays: environment == 'production' ? 90 : 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: false
    }
  }
}
output workspaceId string = workspace.id
