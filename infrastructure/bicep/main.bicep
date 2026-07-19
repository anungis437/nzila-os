// ──────────────────────────────────────────────────────────────────────────────
// Nzila OS — Main Bicep Orchestrator
// iSSDLC W1-1, W1-5, W1-7, W2-6
//
// Deploy: az deployment group create -g <rg> -f main.bicep -p env=staging
// Validate: checkov -f main.bicep --framework bicep
// ──────────────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

@allowed(['dev', 'staging', 'prod'])
param env string

param location string = resourceGroup().location
param acr_name string = 'nzila${env}acr'
param kv_name string = 'nzila-${env}-kv'
param sentinel_workspace_name string = 'nzila-${env}-logs'
param frontdoor_name string = 'nzila-${env}-fd'
param container_env_name string = 'nzila-${env}-env'

// ── Scaling profiles ─────────────────────────────────────────────────────
// Parameterized for incremental scale-up: 10K → 100K → 500K → 1M+ users
// Change these values in .bicepparam files — no code changes needed.

@description('Database SKU — scale path: B1ms → D4 → E8 → E16 → E32')
param dbSku string = env == 'prod' ? 'GP_Standard_E8ds_v5' : (env == 'staging' ? 'GP_Standard_D4ds_v5' : 'B_Standard_B1ms')

@description('Database storage in GB')
param dbStorageGb int = env == 'prod' ? 1024 : (env == 'staging' ? 256 : 32)

@description('Number of read replicas (0 for dev/staging, 1-5 for prod)')
param dbReadReplicas int = env == 'prod' ? 2 : 0

@description('PgBouncer max client connections (scales with user count)')
param pgBouncerMaxClients int = env == 'prod' ? 5000 : 500

@description('Container App max replicas — scale with user base')
param containerMaxReplicas int = env == 'prod' ? 50 : (env == 'staging' ? 5 : 2)

@description('Container CPU cores per app (prod: 2-4 for 100K+)')
param containerCpu string = env == 'prod' ? '2.0' : (env == 'staging' ? '0.5' : '0.25')

@description('Container memory per app')
param containerMemory string = env == 'prod' ? '4Gi' : (env == 'staging' ? '1Gi' : '0.5Gi')

@description('HTTP concurrent requests per replica before scale-out')
param scaleConcurrency string = '50'

@description('Secondary region for multi-region deployment (empty = single region)')
param secondaryLocation string = ''

@description('Enable multi-region active-active deployment')
param enableMultiRegion bool = false

@secure()
@description('Database administrator password')
param dbAdminPassword string = ''

@description('Object ID of an Entra ID principal to add as PostgreSQL AAD administrator. Leave empty to skip AAD admin setup.')
param aadAdminObjectId string = ''

@description('Principal name for the AAD administrator (e.g. user UPN or SP display name).')
param aadAdminPrincipalName string = ''

@allowed(['User', 'Group', 'ServicePrincipal'])
param aadAdminPrincipalType string = 'ServicePrincipal'

var appDatabaseName = 'nzila'
var pgAdminLogin = 'nzilaadmin'
var managedIdentityName = 'nzila-${env}-aca-mi'
var vnetName = 'nzila-${env}-vnet'
// Built-in role: Key Vault Secrets User
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
// Built-in role: AcrPull
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

@description('Container image tag deployed to every Container App. Override per release.')
param imageTag string = 'latest'

@description('Expiration applied to Key Vault connection secrets, as Unix epoch seconds. Defaults to two years from deployment time.')
param secretExpiryEpoch int = dateTimeToEpoch(dateTimeAdd(utcNow(), 'P2Y'))

// ── Network (VNet + delegated subnets + private DNS) ────────────────────
module network 'modules/network.bicep' = {
  name: 'network-${env}'
  params: {
    vnetName: vnetName
    location: location
    env: env
  }
}

// ── User-assigned managed identity used by all Container Apps for KV access ───
resource acaIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: location
  tags: {
    environment: env
    service: 'nzila-os'
  }
}

// ── Container Registry ────────────────────────────────────────────────────
module acr 'modules/container-registry.bicep' = {
  name: 'acr-${env}'
  params: {
    name: acr_name
    location: location
    sku: env == 'prod' ? 'Premium' : 'Basic'
  }
}

// ── Key Vault (W2-6: auto-rotation) ──────────────────────────────────────
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault-${env}'
  params: {
    name: kv_name
    location: location
    enableAutoRotation: env == 'prod'
    rotationIntervalDays: 90
    // Allow the Container Apps infrastructure subnet to reach KV through its
    // Microsoft.KeyVault service endpoint so platform MI can resolve secrets.
    allowedSubnetIds: [network.outputs.acaSubnetId]
  }
}

// Grant the shared ACA managed identity 'Key Vault Secrets User' on the vault
// so Container Apps can resolve KV-backed secrets at deploy and refresh time.
resource kvExisting 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: kv_name
  dependsOn: [keyvault]
}

resource acaKvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kvExisting
  name: guid(kvExisting.id, acaIdentity.id, kvSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: acaIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant the shared ACA managed identity 'AcrPull' on the registry so Container
// Apps can pull images without admin credentials.
resource acrExisting 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acr_name
  dependsOn: [acr]
}

resource acaAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acrExisting
  name: guid(acrExisting.id, acaIdentity.id, acrPullRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: acaIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Log Analytics + Sentinel (W1-7) ──────────────────────────────────────
module sentinel 'modules/sentinel.bicep' = {
  name: 'sentinel-${env}'
  params: {
    workspaceName: sentinel_workspace_name
    location: location
    retentionDays: env == 'prod' ? 90 : 30
    enableSentinel: env == 'prod' || env == 'staging'
  }
}

// ── Front Door + WAF (W1-7) ──────────────────────────────────────────────
module waf 'modules/waf.bicep' = {
  name: 'waf-${env}'
  params: {
    frontDoorName: frontdoor_name
    wafPolicyName: 'nzila${env}waf'
    enableBotProtection: env == 'prod'
    enableRateLimiting: true
    rateLimitThreshold: env == 'prod' ? 1000 : 5000
  }
}

// ── Container Apps Environment (W1-1: mTLS, VNet-integrated) ─────────────
module containerApps 'modules/container-apps.bicep' = {
  name: 'container-apps-${env}'
  params: {
    envName: container_env_name
    location: location
    logAnalyticsId: sentinel.outputs.workspaceId
    logAnalyticsKey: sentinel.outputs.workspaceKey
    enableMtls: true  // W1-1: enforce mTLS between all container apps
    minReplicas: env == 'prod' ? 3 : (env == 'staging' ? 2 : 1)
    maxReplicas: containerMaxReplicas
    containerCpu: containerCpu
    containerMemory: containerMemory
    httpConcurrency: scaleConcurrency
    infrastructureSubnetId: network.outputs.acaSubnetId
    userAssignedIdentityId: acaIdentity.id
    keyVaultUri: keyvault.outputs.vaultUri
    databaseUrlSecretName: 'database-url'
    databaseReadUrlSecretName: dbReadReplicas > 0 ? 'database-read-url' : ''
    acrLoginServer: acr.outputs.loginServer
    imageTag: imageTag
  }
  dependsOn: [acaKvSecretsUser, dbUrlSecret]
}

// ── PostgreSQL with PgBouncer + Read Replicas (VNet-integrated) ──────────
module database 'modules/postgres.bicep' = if (dbAdminPassword != '') {
  name: 'postgres-${env}'
  params: {
    serverName: 'nzila-${env}-pg'
    location: location
    env: env
    sku: dbSku
    storageGb: dbStorageGb
    backupRetentionDays: env == 'prod' ? 35 : 7
    highAvailability: env == 'prod'
    geoRedundantBackup: env == 'prod'
    enablePgBouncer: env != 'dev'
    pgBouncerMaxClientConnections: pgBouncerMaxClients
    pgBouncerDefaultPoolSize: env == 'prod' ? 100 : 20
    pgBouncerMinPoolSize: env == 'prod' ? 10 : 0
    readReplicaCount: dbReadReplicas
    adminLogin: pgAdminLogin
    adminPassword: dbAdminPassword
    appDatabaseName: appDatabaseName
    delegatedSubnetResourceId: network.outputs.pgSubnetId
    privateDnsZoneResourceId: network.outputs.privateDnsZoneId
    aadAdminObjectId: aadAdminObjectId
    aadAdminPrincipalName: aadAdminPrincipalName
    aadAdminPrincipalType: aadAdminPrincipalType
  }
}

// ── Write database connection secrets to Key Vault ───────────────────────
var pgFqdn = database.?outputs.?serverFqdn ?? ''
var pgPort = database.?outputs.?connectionPort ?? 5432
var pgReplicas = database.?outputs.?replicaFqdns ?? []
var pgReadFqdn = !empty(pgReplicas) ? pgReplicas[0] : pgFqdn
var databaseUrl = 'postgresql://${pgAdminLogin}:${uriComponent(dbAdminPassword)}@${pgFqdn}:${pgPort}/${appDatabaseName}?sslmode=require'
var databaseReadUrl = 'postgresql://${pgAdminLogin}:${uriComponent(dbAdminPassword)}@${pgReadFqdn}:${pgPort}/${appDatabaseName}?sslmode=require'

module pgPasswordSecret 'modules/keyvault-secret.bicep' = if (dbAdminPassword != '') {
  name: 'kv-secret-pg-password-${env}'
  params: {
    keyVaultName: kv_name
    secretName: 'pg-admin-password'
    secretValue: dbAdminPassword
    expiryEpoch: secretExpiryEpoch
  }
  dependsOn: [keyvault, database]
}

module dbUrlSecret 'modules/keyvault-secret.bicep' = if (dbAdminPassword != '') {
  name: 'kv-secret-database-url-${env}'
  params: {
    keyVaultName: kv_name
    secretName: 'database-url'
    secretValue: databaseUrl
    expiryEpoch: secretExpiryEpoch
  }
  dependsOn: [keyvault, database]
}

module dbReadUrlSecret 'modules/keyvault-secret.bicep' = if (dbAdminPassword != '' && dbReadReplicas > 0) {
  name: 'kv-secret-database-read-url-${env}'
  params: {
    keyVaultName: kv_name
    secretName: 'database-read-url'
    secretValue: databaseReadUrl
    expiryEpoch: secretExpiryEpoch
  }
  dependsOn: [keyvault, database]
}

// ── Azure Monitor Alerts (operational health) ────────────────────────────
module alerts 'modules/alerts.bicep' = {
  name: 'alerts-${env}'
  params: {
    location: location
    logAnalyticsWorkspaceId: sentinel.outputs.workspaceId
    env: env
    alertEmails: env == 'prod' ? ['ops@nzila.io'] : []
  }
}

// ── Secondary Region (Multi-Region Active-Active) ────────────────────────
// Deploy a mirror container environment in the secondary region for global reach.
// Traffic routing handled by Front Door origin groups (see waf.bicep).
module containerAppsSecondary 'modules/container-apps.bicep' = if (enableMultiRegion && secondaryLocation != '') {
  name: 'container-apps-${env}-secondary'
  params: {
    envName: '${container_env_name}-secondary'
    location: secondaryLocation
    logAnalyticsId: sentinel.outputs.workspaceId
    logAnalyticsKey: sentinel.outputs.workspaceKey
    enableMtls: true
    minReplicas: env == 'prod' ? 2 : 1
    maxReplicas: containerMaxReplicas
    containerCpu: containerCpu
    containerMemory: containerMemory
    httpConcurrency: scaleConcurrency
    infrastructureSubnetId: network.outputs.acaSubnetId
    userAssignedIdentityId: acaIdentity.id
    keyVaultUri: keyvault.outputs.vaultUri
    databaseUrlSecretName: 'database-url'
    databaseReadUrlSecretName: dbReadReplicas > 0 ? 'database-read-url' : ''
    acrLoginServer: acr.outputs.loginServer
    imageTag: imageTag
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────
output acrLoginServer string = acr.outputs.loginServer
output keyVaultUri string = keyvault.outputs.vaultUri
output logAnalyticsWorkspaceId string = sentinel.outputs.workspaceId
output frontDoorEndpoint string = waf.outputs.frontDoorEndpoint
output containerEnvId string = containerApps.outputs.environmentId
output dbServerFqdn string = database.?outputs.?serverFqdn ?? ''
output dbConnectionPort int = database.?outputs.?connectionPort ?? 5432
output dbReplicaFqdns array = database.?outputs.?replicaFqdns ?? []
output secondaryContainerEnvId string = containerAppsSecondary.?outputs.?environmentId ?? ''
output alertActionGroupId string = alerts.outputs.actionGroupId
