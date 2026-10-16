targetScope = 'resourceGroup'
@allowed([false])
param provisionResources bool = false
param environmentName string
param defaultDomain string
param staticIp string
param vnetId string
param tags object
resource zone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (provisionResources) {
  name: defaultDomain
  location: 'global'
  tags: tags
}
resource link 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (provisionResources) {
  parent: zone
  name: '${environmentName}-link'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnetId } }
}
resource apex 'Microsoft.Network/privateDnsZones/A@2020-06-01' = if (provisionResources) {
  parent: zone
  name: '@'
  properties: { ttl: 60, aRecords: [{ ipv4Address: staticIp }] }
}
resource wildcard 'Microsoft.Network/privateDnsZones/A@2020-06-01' = if (provisionResources) {
  parent: zone
  name: '*'
  properties: { ttl: 60, aRecords: [{ ipv4Address: staticIp }] }
}
