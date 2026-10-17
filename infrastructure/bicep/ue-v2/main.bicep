// ──────────────────────────────────────────────────────────────────────────────
// Union Eyes — Canonical Bootstrap V2 production stack (PREPARED, NOT DEPLOYED)
//
// Scope: a NEW, network-isolated stack. The live production UE stack (legacy) is hand-built
// without a VNet and cannot be given one in place, so V2 gets its own Container Apps
// environment, PostgreSQL server, Key Vault, storage and Redis.
//
// Deploy (only after the human go-live decision):
//   az deployment group create -g <rg> -f main.bicep -p @main.parameters.example.json \
//     -p dbAdminPassword=<from a secure prompt, never from a file>
//
// No secret value appears in this template. Application secrets are Key Vault references
// resolved by the app's user-assigned identity (see docs/union-eyes/production/).
// Reuses ../modules/postgres.bicep (VNet-integrated, zone-redundant, PITR, geo backup).
// ──────────────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

param env string = 'prod'
param location string = resourceGroup().location
param prefix string = 'nzila-ue-v2-${env}'

param vnetAddressSpace string = '10.40.0.0/16'
param acaSubnetPrefix string = '10.40.0.0/23'
param pgSubnetPrefix string = '10.40.4.0/24'
param peSubnetPrefix string = '10.40.5.0/27'

@description('Existing Log Analytics workspace used for application, platform and alert signals.')
param logAnalyticsName string
param logAnalyticsResourceGroup string

@description('Existing action group that notifies the on-call owner.')
param actionGroupId string

@description('Registry that holds the digest-pinned images. Pull uses the app identity (AcrPull); admin credentials are never used.')
param acrName string
param acrResourceGroup string
@description('Image repository path inside the registry for the UE V2 app image.')
param appImageRepository string = 'nzila-os-union-eyes-v2'
@description('sha256 digest of the release-built app image, e.g. sha256:abc...')
param appImageDigest string
param clamavImageRepository string = 'ue-clamav-http-adapter'
param clamavImageDigest string
param cronImageRepository string = 'ue-cron-curl'
param cronImageDigest string

@secure()
param dbAdminPassword string
param dbAdminLogin string = 'uev2admin'
param appDatabaseName string = 'ue_v2_prod'
param dbSku string = 'GP_Standard_D4ds_v5'
param dbStorageGb int = 256
param dbBackupRetentionDays int = 35

param appMinReplicas int = 2
param appMaxReplicas int = 6
param publicHostName string = 'app.unioneyes.app'
param siteUrl string = 'https://unioneyes.app'
param emailFrom string = 'noreply@unioneyes.app'
param emailReplyTo string = 'support@unioneyes.app'
param redisSkuName string = 'Balanced_B1'
param documentsContainerName string = 'ue-v2-documents'
@description('Provision Stripe secret references. Off at initial launch; member dues payment is a separate dormant flag and is never set here.')
param enableStripe bool = false

var tags = {
  environment: env
  service: 'union-eyes-v2'
  managedBy: 'bicep'
}
var kvName = take('${prefix}-kv', 24)
var storageName = take(replace('${prefix}st', '-', ''), 24)
var redisName = '${prefix}-redis'
var pgName = '${prefix}-db'

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsName
  scope: resourceGroup(logAnalyticsResourceGroup)
}

// ── Identity ────────────────────────────────────────────────────────────────
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-id'
  location: location
  tags: tags
}

// ── Network (VNet, delegated subnets, private DNS) ──────────────────────────
resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: '${prefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [vnetAddressSpace] }
    subnets: [
      {
        name: 'aca-infra'
        properties: {
          addressPrefix: acaSubnetPrefix
          delegations: [
            { name: 'aca-delegation', properties: { serviceName: 'Microsoft.App/environments' } }
          ]
        }
      }
      {
        name: 'pg'
        properties: {
          addressPrefix: pgSubnetPrefix
          delegations: [
            { name: 'pg-delegation', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: peSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}
var acaSubnetId = '${vnet.id}/subnets/aca-infra'
var pgSubnetId = '${vnet.id}/subnets/pg'
var peSubnetId = '${vnet.id}/subnets/private-endpoints'

var dnsZones = {
  postgres: 'nzila-ue-v2-${env}.private.postgres.database.azure.com'
  blob: 'privatelink.blob.${environment().suffixes.storage}'
  vault: 'privatelink.vaultcore.azure.net'
  redis: 'privatelink.redis.azure.net'
}
resource zonePg 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: dnsZones.postgres
  location: 'global'
  tags: tags
}
resource zoneBlob 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: dnsZones.blob
  location: 'global'
  tags: tags
}
resource zoneVault 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: dnsZones.vault
  location: 'global'
  tags: tags
}
resource zoneRedis 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: dnsZones.redis
  location: 'global'
  tags: tags
}
resource linkPg 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zonePg
  name: 'vnet'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource linkBlob 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zoneBlob
  name: 'vnet'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource linkVault 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zoneVault
  name: 'vnet'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource linkRedis 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zoneRedis
  name: 'vnet'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}

// ── Key Vault (RBAC, purge protection, no public access, private endpoint) ──
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'None' }
  }
}
module kvPe 'modules/private-endpoint.bicep' = {
  name: 'kv-pe'
  params: {
    name: '${kvName}-pe'
    location: location
    subnetId: peSubnetId
    targetResourceId: kv.id
    groupId: 'vault'
    dnsZoneId: zoneVault.id
    tags: tags
  }
  dependsOn: [linkVault]
}

// ── Storage (documents: private, versioned, soft-delete, lifecycle) ─────────
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: storageName
    location: location
    containerName: documentsContainerName
    peSubnetId: peSubnetId
    blobDnsZoneId: zoneBlob.id
    logAnalyticsId: law.id
    tags: tags
  }
  dependsOn: [linkBlob]
}

// ── Azure Managed Redis (rate limiting is a required runtime dependency) ───
module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    name: redisName
    location: location
    skuName: redisSkuName
    peSubnetId: peSubnetId
    redisDnsZoneId: zoneRedis.id
    tags: tags
  }
  dependsOn: [linkRedis]
}

// ── PostgreSQL (VNet-injected, zone-redundant HA, PITR, geo backup) ─────────
module database '../modules/postgres.bicep' = {
  name: 'database'
  params: {
    serverName: pgName
    location: location
    env: env
    sku: dbSku
    storageGb: dbStorageGb
    backupRetentionDays: dbBackupRetentionDays
    highAvailability: true
    geoRedundantBackup: true
    // V2 relies on per-transaction SET LOCAL ROLE / session GUCs; keep a direct connection.
    enablePgBouncer: false
    readReplicaCount: 0
    adminLogin: dbAdminLogin
    adminPassword: dbAdminPassword
    appDatabaseName: appDatabaseName
    delegatedSubnetResourceId: pgSubnetId
    privateDnsZoneResourceId: zonePg.id
    tags: tags
  }
  dependsOn: [linkPg]
}
// The vector extension must be allow-listed before the bootstrap restore creates it.
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' existing = {
  name: pgName
}
resource pgExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: pgServer
  name: 'azure.extensions'
  properties: { value: 'VECTOR', source: 'user-override' }
  dependsOn: [database]
}

// ── Role assignments for the application identity ───────────────────────────
var roleKvSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleKvCryptoUser = '12338af0-0e69-4776-bea7-57ae8d297424'
resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, appIdentity.id, roleKvSecretsUser)
  scope: kv
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
  }
}
resource kvCryptoUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, appIdentity.id, roleKvCryptoUser)
  scope: kv
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvCryptoUser)
  }
}
module acrPull 'modules/acr-pull.bicep' = {
  name: 'acr-pull'
  scope: resourceGroup(acrResourceGroup)
  params: {
    acrName: acrName
    principalId: appIdentity.properties.principalId
  }
}

// ── Container Apps environment (VNet-integrated, internal) and workloads ───
resource acaEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: { infrastructureSubnetId: acaSubnetId, internal: true }
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
    zoneRedundant: true
  }
}

module apps 'modules/apps.bicep' = {
  name: 'apps'
  params: {
    location: location
    environmentId: acaEnv.id
    environmentDefaultDomain: acaEnv.properties.defaultDomain
    identityId: appIdentity.id
    identityClientId: appIdentity.properties.clientId
    acrLoginServer: '${acrName}.azurecr.io'
    appImage: '${acrName}.azurecr.io/${appImageRepository}@${appImageDigest}'
    clamavImage: '${acrName}.azurecr.io/${clamavImageRepository}@${clamavImageDigest}'
    cronImage: '${acrName}.azurecr.io/${cronImageRepository}@${cronImageDigest}'
    keyVaultUri: kv.properties.vaultUri
    storageAccountName: storageName
    documentsContainerName: documentsContainerName
    publicHostName: publicHostName
    siteUrl: siteUrl
    emailFrom: emailFrom
    emailReplyTo: emailReplyTo
    minReplicas: appMinReplicas
    maxReplicas: appMaxReplicas
    prefix: prefix
    enableStripe: enableStripe
    tags: tags
  }
  dependsOn: [kvSecretsUser, kvCryptoUser, acrPull, kvPe]
}

// ── Alerts ──────────────────────────────────────────────────────────────────
module alerts 'modules/alerts.bicep' = {
  name: 'alerts'
  params: {
    location: location
    logAnalyticsId: law.id
    actionGroupId: actionGroupId
    appName: apps.outputs.appName
    appId: apps.outputs.appId
    clamavAppId: apps.outputs.clamavAppId
    pgServerId: database.outputs.serverId
    prefix: prefix
    tags: tags
  }
}

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output storageAccountName string = storageName
output redisName string = redisName
output postgresFqdn string = database.outputs.serverFqdn
output appInternalFqdn string = apps.outputs.appFqdn
output appIdentityClientId string = appIdentity.properties.clientId
output environmentId string = acaEnv.id
