// Union Eyes — Phase B Environment Provisioning
//
// Provisions ONE isolated Union Eyes environment (staging | demo | pilot | prod).
// Deploy four times (once per env) into per-env resource groups:
//
//   # Production (KV-integrated — recommended):
//   az deployment group create \
//     --resource-group nzila-canada-<env>-rg \
//     --template-file apps/union-eyes/infra/environments/union-eyes-env.bicep \
//     --parameters environment=prod postgresAdminPassword=<pwd> \
//                  upstashRedisUrlKvUri=<versioned-kv-uri> \
//                  upstashRedisTokenKvUri=<versioned-kv-uri> \
//                  evidenceStorageKeyKvUri=<versioned-kv-uri>
//
//   # Non-prod / initial provisioning (inline secrets fallback):
//   az deployment group create \
//     --resource-group nzila-canada-<env>-rg \
//     --template-file apps/union-eyes/infra/environments/union-eyes-env.bicep \
//     --parameters environment=<env> postgresAdminPassword=<pwd> \
//                  upstashRedisUrl=<url> upstashRedisToken=<token>
//
// Each deployment provisions:
//   * Container Apps Environment   nzila-canada-<env>-env
//   * Container App                nzila-os-union-eyes-<env>
//   * PostgreSQL flexible server   nzila-os-union-eyes-<env>-db
//   * PostgreSQL database          nzila_os_<env>
//   * Key Vault                    nzila-canada-<env>-kv
//   * Log Analytics workspace      nzila-canada-<env>-law
//   * Storage account (prod)       nzilacanadaprod<env>
//   * Blob container (prod)        union-eyes-evidence
//
// Production receives PremiumV3 sizing, 30-day backup retention, HTTP autoscaling
// (10 concurrent req/replica, min 2 / max 6), and a dedicated evidence blob store.
// All non-production environments receive Burstable sizing and 7-day retention.
//
// Azure Front Door + WAF are provisioned separately:
//   apps/union-eyes/infra/waf-afd/waf-afd.bicep

targetScope = 'resourceGroup'

@description('Phase A canonical environment identity')
@allowed(['staging', 'demo', 'pilot', 'prod'])
param environment string

@description('PostgreSQL administrator password (rotate via Key Vault after creation)')
@secure()
param postgresAdminPassword string

@description('Azure region')
param location string = 'canadacentral'

@description('Container image to deploy (full ACR path with tag)')
param containerImage string = 'nzilacanadaacr.azurecr.io/nzila-os-union-eyes:production'

@description('ACR resource (managed identity must have AcrPull on this registry)')
param acrLoginServer string = 'nzilacanadaacr.azurecr.io'

@description('Upstash Redis REST URL — versioned Key Vault URI (e.g. https://nzila-canada-prod-kv.vault.azure.net/secrets/upstash-redis-url/<version>). Leave empty to use inline value.')
param upstashRedisUrlKvUri string = ''

@description('Upstash Redis REST token — versioned Key Vault URI. Leave empty to use inline value.')
param upstashRedisTokenKvUri string = ''

@description('Evidence blob storage account key — versioned Key Vault URI. Leave empty to use inline value.')
param evidenceStorageKeyKvUri string = ''

@description('Upstash Redis REST URL fallback inline value (used only when KV URI is empty; prefer KV URI for prod)')
@secure()
param upstashRedisUrl string = ''

@description('Upstash Redis REST token fallback inline value (used only when KV URI is empty; prefer KV URI for prod)')
@secure()
param upstashRedisToken string = ''

@description('Evidence blob storage account key fallback inline value (used only when KV URI is empty; prefer KV URI for prod)')
@secure()
param evidenceStorageKey string = ''

var useKvSecrets = isProd && upstashRedisUrlKvUri != ''

var isProd = environment == 'prod'
var dbName = 'nzila_os_${environment}'
var appName = 'nzila-os-union-eyes-${environment}'
var pgServerName = 'nzila-os-union-eyes-${environment}-db'
var kvName = 'nzila-canada-${environment}-kv'
var lawName = 'nzila-canada-${environment}-law'
var caEnvName = 'nzila-canada-${environment}-env'
var evidenceStorageAccountName = 'nzilacanadaprod${environment}'
var evidenceContainerName = 'union-eyes-evidence'

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: isProd ? 90 : 30
  }
}

resource caEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: caEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    zoneRedundant: isProd
  }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: isProd ? 'Standard_D2s_v3' : 'Standard_B2ms'
    tier: isProd ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: 'nzilaadmin'
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: isProd ? 256 : 64
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: isProd ? 30 : 7
      geoRedundantBackup: isProd ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: isProd ? 'ZoneRedundant' : 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: dbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow Azure-internal services (Container Apps) to reach the PG flexible server.
// Tighten with VNet integration in Phase B.
resource pgFwAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: pg
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: isProd ? true : null
    publicNetworkAccess: 'Enabled'
  }
}

// Evidence blob store (prod only). Non-prod uses DB-only evidence storage.
resource evidenceStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = if (isProd) {
  name: evidenceStorageAccountName
  location: location
  sku: { name: 'Standard_GRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource evidenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = if (isProd) {
  name: '${evidenceStorageAccountName}/default/${evidenceContainerName}'
  properties: {
    publicAccess: 'None'
  }
  dependsOn: [ evidenceStorage ]
}

resource ueApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: caEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: isProd ? (useKvSecrets ? [
        // KV-integrated secrets (prod standard — versioned URI + system identity)
        { name: 'upstash-redis-url', keyVaultUrl: upstashRedisUrlKvUri, identity: 'system' }
        { name: 'upstash-redis-token', keyVaultUrl: upstashRedisTokenKvUri, identity: 'system' }
        { name: 'evidence-storage-key', keyVaultUrl: evidenceStorageKeyKvUri, identity: 'system' }
      ] : [
        // Fallback inline values (used for non-KV environments or initial provisioning)
        { name: 'upstash-redis-url', value: upstashRedisUrl }
        { name: 'upstash-redis-token', value: upstashRedisToken }
        { name: 'evidence-storage-key', value: evidenceStorageKey }
      ]) : []
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: isProd ? json('1.0') : json('0.5')
            memory: isProd ? '2Gi' : '1Gi'
          }
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'UE_ENVIRONMENT', value: environment == 'prod' ? 'production' : environment }
            { name: 'NEXT_PUBLIC_APP_ENV', value: environment == 'prod' ? 'production' : environment }
            { name: 'NZILA_MODE', value: environment == 'prod' ? 'production' : environment }
            // Operational package deployment types only. Demo runtime lives in a
            // separate app (@nzila/union-eyes-demo) with its own Bicep template.
            { name: 'UE_DEPLOYMENT_TYPE', value: environment }
            { name: 'UE_FEATURE_PROFILE', value: (environment == 'prod' || environment == 'pilot') ? 'executive' : 'internal' }
            { name: 'NEXT_PUBLIC_UE_FEATURE_PROFILE', value: (environment == 'prod' || environment == 'pilot') ? 'executive' : 'internal' }
            { name: 'PGHOST', value: pg.properties.fullyQualifiedDomainName }
            { name: 'PGUSER', value: 'nzilaadmin' }
            { name: 'PGDATABASE', value: dbName }
            { name: 'PGSSLMODE', value: 'require' }
            // Lineage / runtime-fail-closed metadata vars
            { name: 'SECRET_TOPOLOGY', value: environment == 'prod' ? (useKvSecrets ? 'aca-kv-integrated' : 'aca-secrets-inline') : 'local' }
            { name: 'SECRET_AUTHORITY', value: environment == 'prod' ? 'azure-key-vault' : 'local' }
            { name: 'ENVIRONMENT_ISOLATION', value: environment == 'prod' || environment == 'pilot' ? 'full' : 'partial' }
            { name: 'DJANGO_API_URL', value: environment == 'pilot' ? 'http://nzila-os-union-eyes-django-pilot' : '' }
            { name: 'READY_REQUIRE_QUEUE', value: environment == 'pilot' ? 'true' : 'false' }
          ], isProd ? [
            { name: 'UPSTASH_REDIS_REST_URL', secretRef: 'upstash-redis-url' }
            { name: 'UPSTASH_REDIS_REST_TOKEN', secretRef: 'upstash-redis-token' }
            { name: 'AZURE_EVIDENCE_STORAGE_ACCOUNT', value: evidenceStorageAccountName }
            { name: 'AZURE_EVIDENCE_STORAGE_CONTAINER', value: evidenceContainerName }
            { name: 'AZURE_EVIDENCE_STORAGE_KEY', secretRef: 'evidence-storage-key' }
          ] : [])
        }
      ]
      scale: {
        minReplicas: isProd ? 2 : 1
        maxReplicas: isProd ? 6 : 3
        rules: isProd ? [
          {
            name: 'http-scaler'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ] : []
      }
    }
  }
  dependsOn: [
    pgDb
  ]
}

output containerAppName string = ueApp.name
output containerAppFqdn string = ueApp.properties.configuration.ingress.fqdn
output postgresFqdn string = pg.properties.fullyQualifiedDomainName
output postgresDatabaseName string = dbName
output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output containerAppPrincipalId string = ueApp.identity.principalId
output evidenceStorageAccountName string = isProd ? evidenceStorageAccountName : ''
