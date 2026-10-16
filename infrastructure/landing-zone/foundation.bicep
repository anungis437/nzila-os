targetScope = 'resourceGroup'

@allowed(['union-eyes', 'cora'])
param product string
@allowed(['development', 'integration-test', 'staging', 'production'])
param environment string
@allowed(['canadacentral'])
param location string = 'canadacentral'
@minLength(1)
param owner string
@minLength(1)
param costCenter string
@allowed(['product-runtime', 'infrastructure-proof'])
param purpose string
@allowed(['synthetic', 'internal', 'confidential', 'institutional'])
param dataClassification string
@minLength(1)
param databaseAdminGroupName string
@minLength(36)
@maxLength(36)
param databaseAdminGroupObjectId string
@description('Canadian shared operations workspace resource ID; no workspace keys.')
param operationsWorkspaceId string
@description('Canadian shared security workspace resource ID; audited independently.')
param securityWorkspaceId string
@minLength(1)
param workloadName string

var production = environment == 'production'
var prefix = 'nzila-${product}-${environment}'
var unique = uniqueString(subscription().subscriptionId, resourceGroup().id, product, environment)
var environmentIndex = indexOf(['development', 'integration-test', 'staging', 'production'], environment)
var networkIndex = (product == 'union-eyes' ? 32 : 48) + environmentIndex
var tags = {
  product: product
  environment: environment
  service: 'foundation'
  purpose: purpose
  owner: owner
  cost_center: costCenter
  data_classification: dataClassification
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
    ]
  }
}

var privateZones = [
  '${prefix}.postgres.database.azure.com'
  'privatelink.vaultcore.azure.net'
  'privatelink.blob.${az.environment().suffixes.storage}'
  'privatelink.${location}.azurecontainerapps.io'
  'privatelink.azurecr.io'
]
resource dns 'Microsoft.Network/privateDnsZones@2024-06-01' = [for zone in privateZones: {
  name: zone
  location: 'global'
  tags: union(tags, {service: 'private-dns'})
}]
resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [for (zone, index) in privateZones: {
  parent: dns[index]
  name: '${prefix}-link'
  location: 'global'
  tags: union(tags, {service: 'private-dns'})
  properties: {
    registrationEnabled: false
    virtualNetwork: {id: network.id}
  }
}]

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-${workloadName}-identity'
  location: location
  tags: union(tags, {service: 'workload-identity'})
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${prefix}-pg'
  location: location
  tags: union(tags, {service: 'postgresql'})
  sku: {
    name: production ? 'Standard_D2s_v3' : 'Standard_B2s'
    tier: production ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    version: '16'
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: tenant().tenantId
    }
    storage: {
      storageSizeGB: production ? 256 : 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: production ? 35 : 7
      geoRedundantBackup: production ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: production ? 'ZoneRedundant' : 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'database')
      privateDnsZoneArmResourceId: dns[0].id
      publicNetworkAccess: 'Disabled'
    }
  }
  dependsOn: [dnsLink]
}
resource databaseAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: database
  name: databaseAdminGroupObjectId
  properties: {
    principalName: databaseAdminGroupName
    principalType: 'Group'
    tenantId: tenant().tenantId
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'nzl-${unique}-kv'
  location: location
  tags: union(tags, {service: 'key-vault'})
  properties: {
    tenantId: tenant().tenantId
    sku: {family: 'A', name: 'standard'}
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
    }
  }
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'nzl${unique}'
  location: location
  tags: union(tags, {service: 'evidence-storage'})
  kind: 'StorageV2'
  sku: {name: production ? 'Standard_GRS' : 'Standard_LRS'}
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Disabled'
    networkAcls: {bypass: 'None', defaultAction: 'Deny'}
  }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {enabled: true, days: 30}
    containerDeleteRetentionPolicy: {enabled: true, days: 30}
    isVersioningEnabled: true
  }
}

module vaultEndpoint 'private-endpoint.bicep' = {
  name: 'vault-endpoint'
  params: {
    name: '${prefix}-kv-pe'
    location: location
    tags: union(tags, {service: 'key-vault-network'})
    subnetId: resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'private-endpoints')
    targetId: vault.id
    groupId: 'vault'
    dnsZoneId: dns[1].id
  }
}
module storageEndpoint 'private-endpoint.bicep' = {
  name: 'blob-endpoint'
  params: {
    name: '${prefix}-blob-pe'
    location: location
    tags: union(tags, {service: 'storage-network'})
    subnetId: resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'private-endpoints')
    targetId: storage.id
    groupId: 'blob'
    dnsZoneId: dns[2].id
  }
}

resource vaultRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, 'secrets-user')
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'blob-contributor')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource vaultAudit 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'institutional-audit'
  scope: vault
  properties: {
    workspaceId: securityWorkspaceId
    logs: [{category: 'AuditEvent', enabled: true}]
  }
}
resource databaseLogs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'institutional-database'
  scope: database
  properties: {
    workspaceId: operationsWorkspaceId
    logs: [{category: 'PostgreSQLLogs', enabled: true}]
    metrics: [{category: 'AllMetrics', enabled: true}]
  }
}
resource storageAudit 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'institutional-storage'
  scope: blobs
  properties: {
    workspaceId: securityWorkspaceId
    logs: [
      {category: 'StorageRead', enabled: true}
      {category: 'StorageWrite', enabled: true}
      {category: 'StorageDelete', enabled: true}
    ]
  }
}

output appSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'apps')
output endpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', network.name, 'private-endpoints')
output appPrivateDnsZoneId string = dns[3].id
output databaseHost string = database.properties.fullyQualifiedDomainName
output vaultUri string = vault.properties.vaultUri
output storageAccountName string = storage.name
output workloadIdentityId string = identity.id
output workloadPrincipalId string = identity.properties.principalId
output workloadClientId string = identity.properties.clientId
output registryPrivateDnsZoneId string = dns[4].id
