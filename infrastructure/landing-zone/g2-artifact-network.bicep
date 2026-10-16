targetScope = 'resourceGroup'

@allowed(['union-eyes'])
param product string
@allowed(['integration-test'])
param environment string
@allowed(['canadacentral'])
param location string
@minLength(1)
param owner string
@minLength(1)
param costCenter string

var prefix = 'nzila-${product}-${environment}'
var networkIndex = 33
var tags = {
  product: product
  environment: environment
  service: 'foundation'
  purpose: 'infrastructure-proof'
  owner: owner
  cost_center: costCenter
  data_classification: 'synthetic'
}

resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${prefix}-vnet'
  location: location
  tags: union(tags, {service: 'network'})
  properties: {
    addressSpace: {
      addressPrefixes: ['10.${networkIndex}.0.0/16']
    }
    subnets: [
      {
        name: 'apps'
        properties: {
          addressPrefix: '10.${networkIndex}.0.0/23'
          delegations: [
            {
              name: 'container-apps'
              properties: {serviceName: 'Microsoft.App/environments'}
            }
          ]
        }
      }
      {
        name: 'database'
        properties: {
          addressPrefix: '10.${networkIndex}.2.0/24'
          delegations: [
            {
              name: 'postgresql'
              properties: {serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'}
            }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.${networkIndex}.3.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'builders'
        properties: {
          addressPrefix: '10.${networkIndex}.4.0/24'
          defaultOutboundAccess: false
          networkSecurityGroup: {
            id: builderNetworkSecurityGroup.id
          }
        }
      }
    ]
  }
}

resource builderNetworkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: '${prefix}-builder-nsg'
  location: location
  tags: union(tags, {service: 'private-builder-network'})
  properties: {
    securityRules: [
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource registryDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.azurecr.io'
  location: 'global'
  tags: union(tags, {service: 'private-dns'})
}

resource registryDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: registryDns
  name: '${prefix}-link'
  location: 'global'
  tags: union(tags, {service: 'private-dns'})
  properties: {
    registrationEnabled: false
    virtualNetwork: {id: network.id}
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-proof-api-identity'
  location: location
  tags: union(tags, {service: 'workload-identity'})
}

output endpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'private-endpoints')
output builderSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'builders')
output registryPrivateDnsZoneId string = registryDns.id
output workloadIdentityId string = identity.id
output workloadPrincipalId string = identity.properties.principalId
