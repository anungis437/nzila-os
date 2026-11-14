// ──────────────────────────────────────────────────────────────────────────────
// Union Eyes — Canonical Bootstrap V2 stack (PREPARED, NOT DEPLOYED)
//
// Scope: a NEW, network-isolated stack. The live production UE stack (legacy) is hand-built
// without a VNet and cannot be given one in place, so V2 gets its own Container Apps
// environment, PostgreSQL server, Key Vault, storage and Redis.
//
// One template, two environments (`env` = staging | prod). Every environment-dependent default is
// derived from `env`; with env=prod the defaults are the production values this template has always
// used, so a production deployment is unchanged. Staging defaults are cost-sized (see
// docs/union-eyes/production/STAGING_PARAMETERS.md and parameters/staging.parameters.example.json).
//
// Deploy (only after the required approvals and change record):
//   az deployment group create -g <rg> -f main.bicep -p @<parameters file> \
//     -p dbAdminPassword=<from a secure prompt, never from a file>
//
// No secret value appears in this template. Application secrets are Key Vault references
// resolved by the app's user-assigned identity (see docs/union-eyes/production/).
// Reuses ../modules/postgres.bicep (VNet-integrated; HA, geo backup and SKU are parameters).
// ──────────────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

@description('Required explicit deployment target; never inferred as production. Every environment-dependent default below is derived from it.')
@allowed(['staging', 'prod'])
param env string
@description('Staging only: provision infrastructure before the qualified database restore and role/secret bootstrap. Production always deploys workloads. Use incremental mode; existing workloads are never deleted by this switch.')
param bootstrapInfrastructureOnly bool = false
var deployApplications = env == 'prod' || !bootstrapInfrastructureOnly
param location string = resourceGroup().location
param prefix string = 'nzila-ue-v2-${env}'

param vnetAddressSpace string = '10.40.0.0/16'
param acaSubnetPrefix string = '10.40.0.0/23'
param pgSubnetPrefix string = '10.40.4.0/24'
param peSubnetPrefix string = '10.40.5.0/27'

@description('Log Analytics workspace used for application, platform and alert signals. Reused by name unless createLogAnalytics is true.')
param logAnalyticsName string
param logAnalyticsResourceGroup string
@description('Create the workspace (in logAnalyticsResourceGroup) instead of reusing an existing one. An existing workspace is never modified by this template.')
param createLogAnalytics bool = false
@description('Daily ingestion cap in GB for a workspace this template creates. -1 = no cap. Ignored when the workspace is reused.')
param logAnalyticsDailyCapGb int = -1
@description('Retention in days for a workspace this template creates. Ignored when the workspace is reused.')
@minValue(30)
@maxValue(730)
param logAnalyticsRetentionDays int = 30

@description('Existing action group that notifies the on-call owner. Leave empty when createActionGroup is true.')
param actionGroupId string = ''
@description('Create an action group in this resource group (for a subscription that has none yet). Its id replaces actionGroupId.')
param createActionGroup bool = false
@description('Email receivers for a template-created action group: [{ name, emailAddress }].')
param actionGroupEmailReceivers array = []

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
param appDatabaseName string = env == 'prod' ? 'ue_v2_prod' : 'ue_v2_staging'
@description('PostgreSQL SKU (allowed values are enforced by ../modules/postgres.bicep). Burstable SKUs get no HA and no geo backup.')
param dbSku string = env == 'prod' ? 'Standard_D4ds_v5' : 'Standard_B1ms'
param dbStorageGb int = env == 'prod' ? 256 : 32
param dbBackupRetentionDays int = env == 'prod' ? 35 : 7
param dbHighAvailability bool = env == 'prod'
param dbGeoRedundantBackup bool = env == 'prod'
@description('Let Azure apply the default (cheapest) storage performance tier for dbStorageGb instead of the module\'s fixed P15/P20/P30 mapping.')
param dbUseDefaultStorageTier bool = env != 'prod'
@description('max_connections override. 0 keeps the module default (200 without PgBouncer). Burstable B1ms supports 50.')
param dbMaxConnections int = startsWith(dbSku, 'Standard_B') ? 50 : 0

@description('Application replica bounds. Staging scales to zero; raise them for an acceptance run.')
param appMinReplicas int = env == 'prod' ? 2 : 0
param appMaxReplicas int = env == 'prod' ? 6 : 2
@description('Container Apps revision mode for the application. Multiple enables a pinned-traffic, health-gated rollout (a new revision is created at 0% traffic until explicitly promoted); Single (the default) keeps the immediate-cutover behavior unchanged for any caller that does not opt in.')
@allowed(['Single', 'Multiple'])
param appRevisionMode string = 'Single'
@description('When appRevisionMode is Multiple, pins ingress traffic to this existing revision name while a new revision is created at 0% traffic for a controlled, health-gated promotion. Empty means traffic follows the latest revision (today\'s behavior) -- used for the first deployment under Multiple mode or whenever Single mode is in effect.')
param appPinnedRevisionName string = ''
@description('Deterministic suffix for the revision this deployment creates (e.g. a short source SHA), so a controlled-promotion step knows the new revision\'s exact name without discovery. Empty lets Azure generate one.')
param appRevisionSuffix string = ''
@description('Malware scanner replica bounds. The scanner now actually becomes healthy and usable once warm (it previously never did); scaling to zero in staging meant the FIRST upload after idle had to cold-start both the container and clamd itself (~20-25s measured locally) before it could answer, which exceeded real client/test request timeouts as a slow hang rather than the fast, clean fail-closed response scaling-to-zero was originally meant to produce. Keep it warm in both environments, matching the bound production already used.')
param clamavMinReplicas int = 1
param clamavMaxReplicas int = 2
@description('Internal Container Apps environment (reachable only through Private Link, e.g. Front Door). Staging has no Front Door, so its environment is external.')
param acaInternal bool = env == 'prod'
@description('Optional ingress IP allow-list for the app (CIDR strings). Empty = no restriction.')
param ingressAllowedIpRanges array = []

@description('Custom host name for the app. Empty = the Container Apps default FQDN.')
param publicHostName string = env == 'prod' ? 'app.unioneyes.app' : ''
@description('Marketing/site URL. Empty = the app URL.')
param siteUrl string = env == 'prod' ? 'https://unioneyes.app' : ''
@description('Sender and reply-to addresses. Required for staging (no production default); use a staging-verified sender.')
param emailFrom string = env == 'prod' ? 'noreply@unioneyes.app' : ''
param emailReplyTo string = env == 'prod' ? 'support@unioneyes.app' : ''
@description('Entra application registration identifiers. The secret stays in Key Vault as azure-ad-client-secret. Empty defaults preserve existing production configuration.')
param entraClientId string = ''
param entraTenantId string = ''
@description('Azure Managed Redis SKU. Balanced_B0 is the smallest SKU.')
param redisSkuName string = env == 'prod' ? 'Balanced_B1' : 'Balanced_B0'
@description('Azure Managed Redis high availability (replica). Disabling it roughly halves the cost; not for production.')
param redisHighAvailability bool = env == 'prod'
param storageSkuName string = env == 'prod' ? 'Standard_GZRS' : 'Standard_LRS'
@minValue(7)
@maxValue(90)
param keyVaultSoftDeleteRetentionDays int = env == 'prod' ? 90 : 7
param documentsContainerName string = 'ue-v2-documents'
@description('Provision Stripe secret references. Off at initial launch; member dues payment is a separate dormant flag and is never set here.')
param enableStripe bool = false

@description('Cost-allocation tags (env, app, owner, costCenter) applied to every taggable resource outside production.')
param owner string = ''
param costCenter string = ''

@description('Monthly budget amount in the billing currency for this resource group. 0 = no budget.')
param budgetAmount int = 0
@description('Budget start date, first day of a month (yyyy-MM-01). Required when budgetAmount > 0.')
param budgetStartDate string = ''
@description('Three actual-spend alert thresholds in percent of the budget (a forecast alert at 100 % is always added).')
@minLength(3)
@maxLength(3)
param budgetThresholds array = [50, 80, 100]
@description('Extra email recipients for budget alerts (the action group is always notified).')
param budgetContactEmails array = []

var baseTags = {
  environment: env
  service: 'union-eyes-v2'
  managedBy: 'bicep'
}
var costTags = env == 'prod' ? {} : {
  env: env
  app: 'union-eyes-v2'
  owner: owner
  costCenter: costCenter
}
var tags = union(baseTags, costTags)
// Child resources that were untagged in production stay untagged there.
var childTags = env == 'prod' ? null : tags
var kvName = take('${prefix}-kv', 24)
var storageName = take(replace('${prefix}st', '-', ''), 24)
var redisName = '${prefix}-redis'
// PostgreSQL names are global. Keep the established production name while
// binding the isolated staging server name to this subscription.
var pgName = env == 'prod' ? '${prefix}-db' : '${prefix}-db-${take(subscription().subscriptionId, 8)}'

// Optional: create the workspace (with a daily cap). An existing workspace is only referenced.
module logAnalytics 'modules/log-analytics.bicep' = if (createLogAnalytics) {
  name: 'log-analytics'
  scope: resourceGroup(logAnalyticsResourceGroup)
  params: {
    name: logAnalyticsName
    location: location
    dailyCapGb: logAnalyticsDailyCapGb
    retentionDays: logAnalyticsRetentionDays
    tags: tags
  }
}
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsName
  scope: resourceGroup(logAnalyticsResourceGroup)
}

// ── Action group (optional: the target subscription may have none yet) ─────
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (createActionGroup) {
  name: '${prefix}-ops'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: take(replace('uev2${env}', '-', ''), 12)
    enabled: true
    emailReceivers: [
      for r in actionGroupEmailReceivers: {
        name: r.name
        emailAddress: r.emailAddress
        useCommonAlertSchema: true
      }
    ]
  }
}
var effectiveActionGroupId = createActionGroup ? actionGroup.id : actionGroupId

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
  tags: childTags
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource linkBlob 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zoneBlob
  name: 'vnet'
  location: 'global'
  tags: childTags
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource linkVault 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zoneVault
  name: 'vnet'
  location: 'global'
  tags: childTags
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource linkRedis 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: zoneRedis
  name: 'vnet'
  location: 'global'
  tags: childTags
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
    softDeleteRetentionInDays: keyVaultSoftDeleteRetentionDays
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
    skuName: storageSkuName
    containerName: documentsContainerName
    peSubnetId: peSubnetId
    blobDnsZoneId: zoneBlob.id
    logAnalyticsId: law.id
    tags: tags
  }
  dependsOn: [linkBlob, logAnalytics]
}

// ── Azure Managed Redis (rate limiting is a required runtime dependency) ───
module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    name: redisName
    location: location
    skuName: redisSkuName
    highAvailability: redisHighAvailability
    peSubnetId: peSubnetId
    redisDnsZoneId: zoneRedis.id
    tags: tags
  }
  dependsOn: [linkRedis]
}

// ── PostgreSQL (VNet-injected; prod: zone-redundant HA, PITR 35 d, geo backup) ─
module database '../modules/postgres.bicep' = {
  name: 'database'
  params: {
    serverName: pgName
    location: location
    env: env
    sku: dbSku
    storageGb: dbStorageGb
    backupRetentionDays: dbBackupRetentionDays
    highAvailability: dbHighAvailability
    geoRedundantBackup: dbGeoRedundantBackup
    useDefaultStorageTier: dbUseDefaultStorageTier
    maxConnectionsOverride: dbMaxConnections
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
// Production retains its existing scope. Staging uses named runtime-secret
// scopes so its app identity cannot retrieve operator/bootstrap passwords.
resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (env == 'prod') {
  name: guid(kv.id, appIdentity.id, roleKvSecretsUser)
  scope: kv
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
  }
}
var stagingRuntimeSecretNames = concat([
  'database-url'
  'system-database-url'
  'auth-database-url'
  'auth-system-database-url'
  'nar-signing-secret'
  'auth-secret'
  'mfa-encryption-key'
  'voting-secret'
  'cron-secret'
  'redis-url'
  'resend-api-key'
  'storage-account-key'
], !empty(entraClientId) && !empty(entraTenantId) ? ['azure-ad-client-secret'] : [], enableStripe ? ['stripe-secret-key', 'stripe-webhook-secret'] : [])
resource stagingRuntimeSecrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = [for secretName in stagingRuntimeSecretNames: {
  parent: kv
  name: secretName
}]
resource stagingKvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (secretName, i) in stagingRuntimeSecretNames: if (env == 'staging' && deployApplications) {
  name: guid(stagingRuntimeSecrets[i].id, appIdentity.id, roleKvSecretsUser)
  scope: stagingRuntimeSecrets[i]
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsUser)
  }
}]
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

// Staging traces remain in Canada Central and use the staging-selected workspace.
resource stagingInsights 'Microsoft.Insights/components@2020-02-02' = if (env == 'staging') {
  name: '${prefix}-insights'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
    IngestionMode: 'LogAnalytics'
    RetentionInDays: 30
    DisableLocalAuth: false
  }
  dependsOn: [logAnalytics]
}

// ── Container Apps environment (VNet-integrated; internal in prod) and workloads ─
// The production API contract stays unchanged. Managed telemetry is supported
// by the staging API below, not by the legacy 2024-03-01 contract.
var acaEnvironmentProperties = {
  appLogsConfiguration: {
    destination: 'log-analytics'
    logAnalyticsConfiguration: {
      customerId: law.properties.customerId
      sharedKey: law.listKeys().primarySharedKey
    }
  }
  vnetConfiguration: { infrastructureSubnetId: acaSubnetId, internal: acaInternal }
  workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
  zoneRedundant: true
}

resource acaEnv 'Microsoft.App/managedEnvironments@2024-03-01' = if (env == 'prod') {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: acaEnvironmentProperties
  dependsOn: [logAnalytics]
}

resource stagingAcaEnv 'Microsoft.App/managedEnvironments@2026-07-01' = if (env == 'staging') {
  name: '${prefix}-env'
  location: location
  tags: tags
  // ARM evaluates reference() even on conditional resources. Keep the
  // reference itself conditional so production never reads stagingInsights.
  properties: union(acaEnvironmentProperties, env == 'staging' ? {
    appInsightsConfiguration: {
      connectionString: stagingInsights!.properties.ConnectionString
    }
    openTelemetryConfiguration: {
      tracesConfiguration: { destinations: ['appInsights'] }
      logsConfiguration: { destinations: ['appInsights'] }
    }
  } : {})
  dependsOn: [logAnalytics]
}

var acaEnvironmentId = env == 'staging' ? stagingAcaEnv!.id : acaEnv!.id
var acaEnvironmentDefaultDomain = env == 'staging' ? stagingAcaEnv!.properties.defaultDomain : acaEnv!.properties.defaultDomain

module apps 'modules/apps.bicep' = if (deployApplications) {
  name: 'apps'
  params: {
    location: location
    deploymentEnvironment: env
    environmentId: acaEnvironmentId
    environmentDefaultDomain: acaEnvironmentDefaultDomain
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
    entraClientId: entraClientId
    entraTenantId: entraTenantId
    minReplicas: appMinReplicas
    maxReplicas: appMaxReplicas
    clamavMinReplicas: clamavMinReplicas
    clamavMaxReplicas: clamavMaxReplicas
    appRevisionMode: appRevisionMode
    appPinnedRevisionName: appPinnedRevisionName
    appRevisionSuffix: appRevisionSuffix
    ingressAllowedIpRanges: ingressAllowedIpRanges
    prefix: prefix
    enableStripe: enableStripe
    tags: tags
  }
  dependsOn: [kvSecretsUser, stagingKvSecretsUser, kvCryptoUser, acrPull, kvPe]
}

// ── Alerts ──────────────────────────────────────────────────────────────────
module alerts 'modules/alerts.bicep' = if (deployApplications) {
  name: 'alerts'
  params: {
    location: location
    logAnalyticsId: law.id
    actionGroupId: effectiveActionGroupId
    appName: apps!.outputs.appName
    appId: apps!.outputs.appId
    clamavAppId: apps!.outputs.clamavAppId
    pgServerId: database.outputs.serverId
    // A scale-to-zero workload legitimately has no replica; only alert when a minimum is configured.
    appReplicaAlert: appMinReplicas > 0
    clamavReplicaAlert: clamavMinReplicas > 0
    prefix: prefix
    tags: tags
  }
  dependsOn: [logAnalytics]
}

// ── Budget (optional, resource-group scope) ─────────────────────────────────
module budget 'modules/budget.bicep' = if (budgetAmount > 0) {
  name: 'budget'
  params: {
    name: '${prefix}-budget'
    amount: budgetAmount
    startDate: budgetStartDate
    thresholds: budgetThresholds
    contactEmails: budgetContactEmails
    actionGroupId: effectiveActionGroupId
  }
}

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output storageAccountName string = storageName
output redisName string = redisName
output postgresFqdn string = database.outputs.serverFqdn
output appInternalFqdn string = deployApplications ? apps!.outputs.appFqdn : ''
output bootstrapInfrastructureOnly bool = env == 'staging' && bootstrapInfrastructureOnly
output appIdentityClientId string = appIdentity.properties.clientId
output environmentId string = acaEnvironmentId
