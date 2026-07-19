// ──────────────────────────────────────────────────────────────────────────────
// Nzila OS — VNet with delegated subnets + private DNS for PostgreSQL
//
// Provides:
//   - Single VNet for Container Apps + PostgreSQL Flexible Server
//   - `aca-infra` subnet for Container Apps Environment (workload profiles)
//     with Microsoft.KeyVault service endpoint so the platform MI can
//     resolve KV-backed secrets even when KV is firewalled.
//   - `pg` subnet delegated to Microsoft.DBforPostgreSQL/flexibleServers
//   - Private DNS zone for VNet-integrated PostgreSQL hostname resolution
// ──────────────────────────────────────────────────────────────────────────────

param vnetName string
param location string
param env string

@description('CIDR for the VNet')
param addressSpace string = '10.20.0.0/16'

@description('Subnet for Container Apps Environment (workload profiles). /23 minimum recommended.')
param acaSubnetPrefix string = '10.20.0.0/23'

@description('Subnet delegated to PostgreSQL Flexible Server. /28 minimum.')
param pgSubnetPrefix string = '10.20.4.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: vnetName
  location: location
  tags: {
    environment: env
    service: 'nzila-os'
    component: 'network'
  }
  properties: {
    addressSpace: {
      addressPrefixes: [addressSpace]
    }
    subnets: [
      {
        name: 'aca-infra'
        properties: {
          addressPrefix: acaSubnetPrefix
          serviceEndpoints: [
            { service: 'Microsoft.KeyVault' }
          ]
        }
      }
      {
        name: 'pg'
        properties: {
          addressPrefix: pgSubnetPrefix
          delegations: [
            {
              name: 'pg-flexible-server-delegation'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

// Private DNS zone used by PostgreSQL Flexible Server VNet integration.
// Must end in `.postgres.database.azure.com` for the server to resolve.
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'nzila-${env}.private.postgres.database.azure.com'
  location: 'global'
  tags: {
    environment: env
    service: 'nzila-os'
    component: 'network'
  }
}

resource zoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: privateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
output acaSubnetId string = vnet.properties.subnets[0].id
output pgSubnetId string = vnet.properties.subnets[1].id
output privateDnsZoneId string = privateDnsZone.id
output privateDnsZoneName string = privateDnsZone.name
