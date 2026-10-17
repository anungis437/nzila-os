param name string
param location string
param subnetId string
param targetResourceId string
@description('Sub-resource group id, e.g. vault, blob, redisEnterprise.')
param groupId string
param dnsZoneId string
param tags object = {}

resource pe 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [
      {
        name: name
        properties: {
          privateLinkServiceId: targetResourceId
          groupIds: [groupId]
        }
      }
    ]
  }
}

resource dnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: pe
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      { name: 'zone', properties: { privateDnsZoneId: dnsZoneId } }
    ]
  }
}
