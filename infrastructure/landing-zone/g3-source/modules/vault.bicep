targetScope = 'resourceGroup'
@allowed([false])
param provisionResources bool = false
param location string
param names object
param tags object
param vnetId string
param endpointSubnetId string
param purgeProtection bool
resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = if (provisionResources) {
  name: names.keyVault
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: purgeProtection
    publicNetworkAccess: 'Disabled'
    networkAcls: { bypass: 'None', defaultAction: 'Deny' }
  }
}
resource zone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (provisionResources) {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}
resource link 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (provisionResources) {
  parent: zone
  name: names.keyVaultDnsLink
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnetId } }
}
resource endpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (provisionResources) {
  name: names.keyVaultEndpoint
  location: location
  tags: tags
  properties: {
    subnet: { id: endpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'g3-vault'
        properties: { privateLinkServiceId: vault.id, groupIds: ['vault'] }
      }
    ]
  }
}
resource zoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (provisionResources) {
  parent: endpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [{ name: 'vault', properties: { privateDnsZoneId: zone.id } }]
  }
}
output secretReference string = 'https://${names.keyVault}${environment().suffixes.keyvaultDns}/secrets/g3-proof-secret'
output secretSeeding string = 'EXTERNAL_EXPLICIT_AUTHORITY_REQUIRED;NO_SECRET_VALUE_PARAMETER_OR_RESOURCE'
