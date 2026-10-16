targetScope = 'resourceGroup'
param name string
param location string
param tags object
param subnetId string
param targetId string
@allowed(['vault', 'blob', 'managedEnvironments', 'registry'])
param groupId string
param dnsZoneId string

resource endpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    subnet: {id: subnetId}
    privateLinkServiceConnections: [
      {
        name: name
        properties: {
          privateLinkServiceId: targetId
          groupIds: [groupId]
        }
      }
    ]
  }
}
resource dns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: endpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {name: 'service', properties: {privateDnsZoneId: dnsZoneId}}
    ]
  }
}
