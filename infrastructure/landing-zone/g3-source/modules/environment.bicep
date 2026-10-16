targetScope = 'resourceGroup'
@allowed([false])
param provisionResources bool = false
param location string
param names object
param tags object
param acaSubnetId string
param vnetId string
param workspaceId string
resource environment 'Microsoft.App/managedEnvironments@2025-07-01' = if (provisionResources) {
  name: names.environment
  location: location
  tags: tags
  properties: {
    vnetConfiguration: { internal: true, infrastructureSubnetId: acaSubnetId }
    publicNetworkAccess: 'Disabled'
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
    appLogsConfiguration: { destination: 'azure-monitor' }
    zoneRedundant: false
  }
}
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (provisionResources) {
  name: 'g3-console-system-logs'
  scope: environment
  properties: {
    workspaceId: workspaceId
    logs: [
      { category: 'ContainerAppConsoleLogs', enabled: true }
      { category: 'ContainerAppSystemLogs', enabled: true }
    ]
  }
}
module dns './internal-dns.bicep' = if (provisionResources) {
  name: 'g3-internal-dns'
  params: {
    provisionResources: provisionResources
    environmentName: names.environment
    defaultDomain: environment!.properties.defaultDomain
    staticIp: environment!.properties.staticIp
    vnetId: vnetId
    tags: tags
  }
}
output environmentId string = resourceId('Microsoft.App/managedEnvironments', names.environment)
output quotaGate string = 'POST_CREATE_PRE_WORKLOAD_ACTIVATION;NO_ASSUMED_QUOTA'
