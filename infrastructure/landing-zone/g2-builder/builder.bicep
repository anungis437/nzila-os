param location string
param previewOnly bool
param approvedAptSources array
param ubuntuImageVersion string
param provisioningSshPublicKey string
param sourceCommit string
param sourceArchiveSha256 string
param tags object

var registryName = 'nzilag2${uniqueString(subscription().id, resourceGroup().id, 'synthetic-health')}'
var adminUsername = 'nzila${uniqueString(resourceGroup().id)}'
var registryWriterRoleId = '2a1e307c-b015-4ebd-883e-5b7698a07328'
var registryReaderRoleId = 'b93aa761-3e63-49ed-ac28-beffa264f7ac'
var packageRules = [
  for (source, index) in approvedAptSources: {
    name: 'apt-${index}'
    description: 'Exact pinned Ubuntu APT source FQDN.'
    sourceAddresses: [
      '10.90.1.0/24'
    ]
    protocols: [
      {
        protocolType: source.protocol
        port: source.protocol == 'Https' ? 443 : 80
      }
    ]
    targetFqdns: [
      toLower(source.fqdn)
    ]
  }
]
var discoveryScript = replace(
  replace(
    replace(loadTextContent('./discovery.py'), '__SOURCE_COMMIT__', sourceCommit),
    '__SOURCE_ARCHIVE_SHA256__',
    sourceArchiveSha256
  ),
  '__REGISTRY_LOGIN_SERVER__',
  '${registryName}.azurecr.io'
)
var discoveryScriptWithIdentity = replace(
  discoveryScript,
  '__BUILDER_CLIENT_ID__',
  builderIdentity.properties.clientId
)
var cloudConfig = replace(
  loadTextContent('./cloud-init.yaml'),
  '__DISCOVERY_SCRIPT_BASE64__',
  base64(discoveryScriptWithIdentity)
)

resource builderIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'nzila-g2-builder-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
}

resource runtimeIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'nzila-g2-runtime-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: registryName
  location: location
  sku: {
    name: 'Premium'
  }
  tags: tags
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: true
    networkRuleBypassOptions: 'None'
    publicNetworkAccess: 'Disabled'
    roleAssignmentMode: 'AbacRepositoryPermissions'
    zoneRedundancy: 'Disabled'
  }
}

resource registryWriterAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, builderIdentity.id, 'synthetic-health-writer')
  scope: registry
  properties: {
    principalId: builderIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', registryWriterRoleId)
    conditionVersion: '2.0'
    condition: '''
      (
        (
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'})
          AND
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'})
          AND
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/write'})
          AND
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/write'})
        )
        OR
        (
          @Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase 'synthetic-health'
        )
      )
    '''
    description: 'G2 synthetic builder write access limited to the synthetic-health repository.'
  }
}

resource registryReaderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, runtimeIdentity.id, 'synthetic-health-reader')
  scope: registry
  properties: {
    principalId: runtimeIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', registryReaderRoleId)
    conditionVersion: '2.0'
    condition: '''
      (
        (
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'})
          AND
          !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'})
        )
        OR
        (
          @Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase 'synthetic-health'
        )
      )
    '''
    description: 'Runtime identity read access limited to the synthetic-health repository.'
  }
}

resource packagePublicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: 'nzila-g2-egress-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  tags: tags
  properties: {
    ddosSettings: {
      protectionMode: 'VirtualNetworkInherited'
    }
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
  }
}

resource firewallManagementPublicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: 'nzila-g2-fw-management-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  tags: tags
  properties: {
    ddosSettings: {
      protectionMode: 'VirtualNetworkInherited'
    }
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
  }
}

resource builderNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nzila-g2-builder-nsg-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowVirtualNetworkOutbound'
        properties: {
          priority: 100
          direction: 'Outbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        name: 'AllowManagedIdentityEndpoint'
        properties: {
          priority: 120
          direction: 'Outbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '169.254.169.254'
          destinationPortRanges: [
            '80'
            '443'
          ]
        }
      }
      {
        name: 'AllowWebEgressViaFirewall'
        properties: {
          priority: 130
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'Internet'
          destinationPortRanges: [
            '80'
            '443'
          ]
        }
      }
      {
        name: 'DenyAllInbound'
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
      {
        name: 'DenyAllOtherOutbound'
        properties: {
          priority: 4096
          direction: 'Outbound'
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

resource builderRouteTable 'Microsoft.Network/routeTables@2024-05-01' = {
  name: 'nzila-g2-builder-rt-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    disableBgpRoutePropagation: true
    routes: [
      {
        name: 'DefaultToAzureFirewall'
        properties: {
          addressPrefix: '0.0.0.0/0'
          nextHopType: 'VirtualAppliance'
          nextHopIpAddress: '10.90.0.4'
        }
      }
    ]
  }
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-07-01' = {
  name: 'nzila-g2-builder-vnet-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    privateEndpointVNetPolicies: 'Disabled'
    addressSpace: {
      addressPrefixes: [
        '10.90.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'AzureFirewallSubnet'
        properties: {
          addressPrefix: '10.90.0.0/26'
        }
      }
      {
        name: 'AzureFirewallManagementSubnet'
        properties: {
          addressPrefix: '10.90.0.64/26'
        }
      }
      {
        name: 'BuilderSubnet'
        properties: {
          addressPrefix: '10.90.1.0/24'
          defaultOutboundAccess: false
          networkSecurityGroup: {
            id: builderNsg.id
          }
          routeTable: {
            id: builderRouteTable.id
          }
        }
      }
      {
        name: 'PrivateEndpointSubnet'
        properties: {
          addressPrefix: '10.90.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource packageFirewall 'Microsoft.Network/azureFirewalls@2025-09-01' = {
  name: 'nzila-g2-egress-fw-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'AZFW_VNet'
      tier: 'Basic'
    }
    applicationRuleCollections: length(approvedAptSources) == 0 ? [] : [
      {
        name: 'ApprovedUbuntuPackageSources'
        properties: {
          priority: 100
          action: {
            type: 'Allow'
          }
          rules: packageRules
        }
      }
    ]
    ipConfigurations: [
      {
        name: 'AzureFirewallIpConfiguration'
        properties: {
          subnet: {
            id: '${virtualNetwork.id}/subnets/AzureFirewallSubnet'
          }
          publicIPAddress: {
            id: packagePublicIp.id
          }
        }
      }
    ]
    managementIpConfiguration: {
      name: 'AzureFirewallManagementIpConfiguration'
      properties: {
        subnet: {
          id: '${virtualNetwork.id}/subnets/AzureFirewallManagementSubnet'
        }
        publicIPAddress: {
          id: firewallManagementPublicIp.id
        }
      }
    }
    threatIntelMode: 'Alert'
  }
}

resource registryPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.azurecr.io'
  location: 'global'
  tags: tags
}

resource registryPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: registryPrivateDnsZone
  name: 'nzila-g2-builder-vnet-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

resource registryPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'nzila-g2-acr-pe-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: '${virtualNetwork.id}/subnets/PrivateEndpointSubnet'
    }
    privateLinkServiceConnections: [
      {
        name: 'registry'
        properties: {
          privateLinkServiceId: registry.id
          groupIds: [
            'registry'
          ]
        }
      }
    ]
  }
}

resource registryPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: registryPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'acr'
        properties: {
          privateDnsZoneId: registryPrivateDnsZone.id
        }
      }
    ]
  }
}

resource builderNic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: 'nzila-g2-builder-nic-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    auxiliaryMode: 'None'
    auxiliarySku: 'None'
    disableTcpStateTracking: false
    enableAcceleratedNetworking: false
    ipConfigurations: [
      {
        name: 'primary'
        properties: {
          primary: true
          privateIPAllocationMethod: 'Dynamic'
          privateIPAddressVersion: 'IPv4'
          subnet: {
            id: '${virtualNetwork.id}/subnets/BuilderSubnet'
          }
        }
      }
    ]
    networkSecurityGroup: {
      id: builderNsg.id
    }
  }
}

resource builderVm 'Microsoft.Compute/virtualMachines@2024-11-01' = {
  name: 'nzila-g2-builder-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${builderIdentity.id}': {}
    }
  }
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_B2s'
    }
    osProfile: {
      computerName: 'nzila-g2-builder'
      adminUsername: adminUsername
      customData: base64(cloudConfig)
      linuxConfiguration: {
        disablePasswordAuthentication: true
        provisionVMAgent: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: provisioningSshPublicKey
            }
          ]
        }
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: ubuntuImageVersion
      }
      osDisk: {
        createOption: 'FromImage'
        diskSizeGB: 32
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: builderNic.id
          properties: {
            primary: true
          }
        }
      ]
    }
    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: true
      }
    }
  }
}

output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer
output registryId string = registry.id
output builderIdentityPrincipalId string = builderIdentity.properties.principalId
output runtimeIdentityPrincipalId string = runtimeIdentity.properties.principalId
output builderVmId string = builderVm.id
output sourceCommit string = sourceCommit
output sourceArchiveSha256 string = sourceArchiveSha256
output packageEgressStatus string = previewOnly || length(approvedAptSources) == 0 ? 'UNPROVEN_NO_EGRESS_RULES' : 'CONFIGURED_NOT_RUNTIME_VERIFIED'
