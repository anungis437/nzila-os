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

// ── Container Apps Environment (W1-1: mTLS) ──────────────────────────────
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
  }
}

// ── PostgreSQL with PgBouncer + Read Replicas ────────────────────────────
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
    adminPassword: dbAdminPassword
  }
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
