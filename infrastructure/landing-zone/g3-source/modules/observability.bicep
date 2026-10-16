targetScope = 'resourceGroup'
@allowed([false])
param provisionResources bool = false
param location string
param names object
param tags object
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (provisionResources) {
  name: names.workspace
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: 1 }
    features: { disableLocalAuth: true, enableLogAccessUsingOnlyResourcePermissions: true }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}
output workspaceId string = resourceId('Microsoft.OperationalInsights/workspaces', names.workspace)
