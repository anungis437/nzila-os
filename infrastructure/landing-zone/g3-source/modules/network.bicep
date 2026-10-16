targetScope = 'resourceGroup'
@allowed([false])
param provisionResources bool = false
param location string
param names object
param tags object
param networkRules object
param g2VnetId string
param discoveredEndpointIps array
param approvedPlatformPrefixes array

var acaPrefix = '10.91.1.0/24'
var builderPrefix = '10.91.3.0/24'
var rules = concat(
  networkRules.inbound,
  networkRules.outbound,
  !empty(discoveredEndpointIps) ? [] : [],
  !empty(approvedPlatformPrefixes)
    ? [
        {
          name: 'private-endpoints'
          properties: {
            priority: 120
            direction: 'Outbound'
            access: 'Allow'
            protocol: 'Tcp'
            sourceAddressPrefix: acaPrefix
            sourcePortRange: '*'
            destinationAddressPrefixes: discoveredEndpointIps
            destinationPortRange: '443'
          }
        }
        {
          name: 'bounded-platform-fqdns'
          properties: {
            priority: 140
            direction: 'Outbound'
            access: 'Allow'
            protocol: 'Tcp'
            sourceAddressPrefix: acaPrefix
            sourcePortRange: '*'
            destinationAddressPrefixes: approvedPlatformPrefixes
            destinationPortRange: '443'
          }
        }
      ]
    : []
)
resource acaNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = if (provisionResources) {
  name: names.nsg
  location: location
  tags: tags
  properties: { securityRules: rules }
}
resource builderNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = if (provisionResources) {
  name: '${names.nsg}-builder'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'deny-unapproved-ingress'
        properties: {
          priority: 900
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: builderPrefix
          sourcePortRange: '*'
          destinationPortRange: '*'
        }
      }
      {
        name: 'deny-unapproved-egress'
        properties: {
          priority: 900
          direction: 'Outbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: builderPrefix
          destinationAddressPrefix: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}
resource endpointNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = if (provisionResources) {
  name: '${names.nsg}-pe'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'private-vault-consumers'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefixes: [acaPrefix, builderPrefix]
          destinationAddressPrefix: '10.91.2.0/24'
          sourcePortRange: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'deny-other-pe-ingress'
        properties: {
          priority: 900
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '10.91.2.0/24'
          sourcePortRange: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}
resource route 'Microsoft.Network/routeTables@2024-05-01' = if (provisionResources) {
  name: names.routeTable
  location: location
  tags: tags
  properties: {
    disableBgpRoutePropagation: true
    routes: [
      {
        name: 'g3-default-to-g2-firewall'
        properties: {
          addressPrefix: '0.0.0.0/0'
          nextHopType: 'VirtualAppliance'
          nextHopIpAddress: '10.90.0.4'
        }
      }
    ]
  }
}
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = if (provisionResources) {
  name: names.vnet
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.91.0.0/16'] }
    subnets: [
      {
        name: names.acaSubnet
        properties: {
          addressPrefix: acaPrefix
          delegations: [{ name: 'aca', properties: { serviceName: 'Microsoft.App/environments' } }]
          networkSecurityGroup: { id: acaNsg.id }
          routeTable: { id: route.id }
        }
      }
      {
        name: names.privateEndpointSubnet
        properties: {
          addressPrefix: '10.91.2.0/24'
          privateEndpointNetworkPolicies: 'NetworkSecurityGroupEnabled'
          networkSecurityGroup: { id: endpointNsg.id }
        }
      }
      {
        name: names.builderSubnet
        properties: {
          addressPrefix: builderPrefix
          networkSecurityGroup: { id: builderNsg.id }
          routeTable: { id: route.id }
        }
      }
    ]
  }
}
resource peering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2024-05-01' = if (provisionResources) {
  parent: vnet
  name: 'g3-to-g2'
  properties: {
    remoteVirtualNetwork: { id: g2VnetId }
    allowVirtualNetworkAccess: true
    allowForwardedTraffic: true
    allowGatewayTransit: false
    useRemoteGateways: false
  }
}
output vnetId string = resourceId('Microsoft.Network/virtualNetworks', names.vnet)
output acaSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', names.vnet, names.acaSubnet)
output endpointSubnetId string = resourceId(
  'Microsoft.Network/virtualNetworks/subnets',
  names.vnet,
  names.privateEndpointSubnet
)
output externalG2Dependencies array = ['G2_SIDE_PEERING', 'G2_ACR_DNS_LINK', 'G2_FIREWALL_RULES']
output builderActivation string = 'DENY_UNTIL_EXACT_BUILD_MODEL_AND_NETWORK_BINDINGS_APPROVED'
