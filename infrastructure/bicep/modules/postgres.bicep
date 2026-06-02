// ──────────────────────────────────────────────────────────────────────────────
// Nzila OS — Azure Database for PostgreSQL Flexible Server
//
// Production-grade PostgreSQL with:
//   - Built-in PgBouncer connection pooling
//   - Read replicas for horizontal read scaling
//   - Zone-redundant HA with automatic failover
//   - Geo-redundant backups (within Canada — PIPEDA)
//   - Parameterized SKU for 10K → 1M+ user scaling
//
// Usage:
//   az deployment group create -g nzila-prod-rg \
//     -f main.bicep -p env=prod dbSku=GP_Standard_E8ds_v5
// ──────────────────────────────────────────────────────────────────────────────

param serverName string
param location string
param env string

@description('PostgreSQL Flexible Server SKU. Scale path: B1ms → D4ds_v5 → E8ds_v5 → E16ds_v5 → E32ds_v5')
@allowed([
  'B_Standard_B1ms'         // Dev: 1 vCore, 2 GiB
  'GP_Standard_D4ds_v5'     // Prod 10K: 4 vCores, 16 GiB
  'GP_Standard_E8ds_v5'     // Prod 100K: 8 vCores, 64 GiB
  'GP_Standard_E16ds_v5'    // Prod 500K: 16 vCores, 128 GiB
  'GP_Standard_E32ds_v5'    // Prod 1M+: 32 vCores, 256 GiB
])
param sku string = 'GP_Standard_D4ds_v5'

@description('Storage in GB. Range: 32–32768')
@minValue(32)
@maxValue(32768)
param storageGb int = 512

@description('Backup retention in days. Range: 7–35')
@minValue(7)
@maxValue(35)
param backupRetentionDays int = 35

@description('Enable zone-redundant HA (automatic failover)')
param highAvailability bool = true

@description('Standby zone for HA replica')
param standbyZone string = '2'

@description('Enable geo-redundant backups (canadacentral ↔ canadaeast)')
param geoRedundantBackup bool = true

@description('Enable built-in PgBouncer connection pooler')
param enablePgBouncer bool = true

@description('PgBouncer pool mode: transaction (recommended for serverless) or session')
@allowed(['transaction', 'session'])
param pgBouncerPoolMode string = 'transaction'

@description('PgBouncer default pool size per user/database pair')
@minValue(10)
@maxValue(5000)
param pgBouncerDefaultPoolSize int = 50

@description('PgBouncer max client connections')
@minValue(50)
@maxValue(10000)
param pgBouncerMaxClientConnections int = 5000

@description('PgBouncer min pool size (keeps connections warm)')
@minValue(0)
@maxValue(100)
param pgBouncerMinPoolSize int = 10

@description('Number of read replicas (0–5)')
@minValue(0)
@maxValue(5)
param readReplicaCount int = 0

@description('Administrator login')
param adminLogin string = 'nzilaadmin'

@secure()
@description('Administrator password')
param adminPassword string

@description('Application database name created on the server')
param appDatabaseName string = 'nzila'

@description('Resource ID of the delegated subnet for VNet integration. Required for private deployments.')
param delegatedSubnetResourceId string = ''

@description('Resource ID of the private DNS zone for the PostgreSQL server. Required when delegatedSubnetResourceId is set.')
param privateDnsZoneResourceId string = ''

@description('Object ID of an Entra ID principal to add as PostgreSQL AAD administrator. Leave empty to skip AAD admin setup.')
param aadAdminObjectId string = ''

@description('Principal name for the AAD administrator (e.g. user UPN or SP display name).')
param aadAdminPrincipalName string = ''

@description('Principal type for AAD administrator')
@allowed(['User', 'Group', 'ServicePrincipal'])
param aadAdminPrincipalType string = 'ServicePrincipal'

param tags object = {}

// Computed: Burstable SKUs do not support zone-redundant HA or geo-redundant backups.
var isBurstable = startsWith(sku, 'B_')
var effectiveHa = highAvailability && !isBurstable
var effectiveGeoBackup = geoRedundantBackup && !isBurstable
var useVnet = !empty(delegatedSubnetResourceId)

// ── Primary Server ────────────────────────────────────────────────────────

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: serverName
  location: location
  tags: union(tags, {
    environment: env
    service: 'nzila-os'
    component: 'database'
  })
  sku: {
    name: sku
    tier: startsWith(sku, 'B_') ? 'Burstable' : 'GeneralPurpose'
  }
  properties: {
    version: '16'
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: storageGb
      autoGrow: 'Enabled'
      tier: storageGb >= 1024 ? 'P30' : (storageGb >= 256 ? 'P20' : 'P15')
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: effectiveGeoBackup ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: effectiveHa ? 'ZoneRedundant' : 'Disabled'
      standbyAvailabilityZone: effectiveHa ? standbyZone : ''
    }
    network: useVnet ? {
      delegatedSubnetResourceId: delegatedSubnetResourceId
      privateDnsZoneArmResourceId: privateDnsZoneResourceId
      publicNetworkAccess: 'Disabled'
    } : {
      publicNetworkAccess: 'Disabled'
    }
    authConfig: empty(aadAdminObjectId) ? {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    } : {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled'
      tenantId: subscription().tenantId
    }
    maintenanceWindow: {
      dayOfWeek: 0    // Sunday
      startHour: 2    // 2 AM ET
      startMinute: 0
      customWindow: 'Enabled'
    }
  }
}

// ── PgBouncer Configuration ──────────────────────────────────────────────
// Built into Azure PostgreSQL Flexible Server — no separate container needed.
// Eliminates N+1 connection overhead, supports 5000+ client connections
// with only ~50 real server connections per pool.

resource pgBouncerEnabled 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (enablePgBouncer) {
  parent: server
  name: 'pgbouncer.enabled'
  properties: {
    value: 'True'
    source: 'user-override'
  }
}

resource pgBouncerMode 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (enablePgBouncer) {
  parent: server
  name: 'pgbouncer.default_pool_size'
  properties: {
    value: string(pgBouncerDefaultPoolSize)
    source: 'user-override'
  }
  dependsOn: [pgBouncerEnabled]
}

resource pgBouncerMaxClients 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (enablePgBouncer) {
  parent: server
  name: 'pgbouncer.max_client_conn'
  properties: {
    value: string(pgBouncerMaxClientConnections)
    source: 'user-override'
  }
  dependsOn: [pgBouncerEnabled]
}

resource pgBouncerMinPool 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (enablePgBouncer) {
  parent: server
  name: 'pgbouncer.min_pool_size'
  properties: {
    value: string(pgBouncerMinPoolSize)
    source: 'user-override'
  }
  dependsOn: [pgBouncerEnabled]
}

resource pgBouncerPoolModeConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (enablePgBouncer) {
  parent: server
  name: 'pgbouncer.pool_mode'
  properties: {
    value: pgBouncerPoolMode
    source: 'user-override'
  }
  dependsOn: [pgBouncerEnabled]
}

// ── Performance tuning ───────────────────────────────────────────────────
// Skip explicit overrides on Burstable SKUs — Azure already auto-tunes them and
// applying large values to a B1ms instance prevents the server from starting.

resource sharedBuffers 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (!isBurstable) {
  parent: server
  name: 'shared_buffers'
  properties: {
    // 25% of instance memory — sized for E8+. Smaller GP SKUs will still accept it.
    value: '4194304'  // 4GB in 8KB pages
    source: 'user-override'
  }
}

resource effectiveCacheSize 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (!isBurstable) {
  parent: server
  name: 'effective_cache_size'
  properties: {
    value: '12582912'  // 12GB in 8KB pages
    source: 'user-override'
  }
  dependsOn: [sharedBuffers]
}

resource workMem 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = if (!isBurstable) {
  parent: server
  name: 'work_mem'
  properties: {
    value: '65536'  // 64MB — supports large sort/hash operations
    source: 'user-override'
  }
  dependsOn: [effectiveCacheSize]
}

resource maxConnections 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: server
  name: 'max_connections'
  properties: {
    // With PgBouncer, actual server connections ≪ client connections
    value: enablePgBouncer ? '500' : '200'
    source: 'user-override'
  }
}

// ── Application database ─────────────────────────────────────────────────
// Apps connect to this database; without it, `psql ... /nzila` would fail.

resource appDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: server
  name: appDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ── AAD administrator (passwordless auth path) ───────────────────────────
resource aadAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2023-12-01-preview' = if (!empty(aadAdminObjectId)) {
  parent: server
  name: aadAdminObjectId
  properties: {
    principalType: aadAdminPrincipalType
    principalName: aadAdminPrincipalName
    tenantId: subscription().tenantId
  }
}

// ── Read Replicas ────────────────────────────────────────────────────────
// Read replicas offload analytics/reporting queries from the primary.
// App routing handled by DATABASE_READ_URL environment variable.

resource readReplicas 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = [
  for i in range(0, readReplicaCount): {
    name: '${serverName}-replica-${i + 1}'
    location: location
    tags: union(tags, {
      environment: env
      service: 'nzila-os'
      component: 'database-replica'
      replicaIndex: string(i + 1)
    })
    sku: {
      name: sku
      tier: startsWith(sku, 'B_') ? 'Burstable' : 'GeneralPurpose'
    }
    properties: {
      createMode: 'Replica'
      sourceServerResourceId: server.id
      version: '16'
    }
  }
]

// ── Outputs ──────────────────────────────────────────────────────────────

output serverId string = server.id
output serverFqdn string = server.properties.fullyQualifiedDomainName
// PgBouncer port: 6432 (standard); direct port: 5432
output connectionPort int = enablePgBouncer ? 6432 : 5432
output adminLogin string = adminLogin
output databaseName string = appDatabaseName
output replicaFqdns array = [
  for i in range(0, readReplicaCount): readReplicas[i].properties.fullyQualifiedDomainName
]
