// Union Eyes — Phase A Environment Provisioning
//
// Provisions ONE isolated Union Eyes environment (staging | demo | pilot | prod).
// Deploy four times (once per env) into per-env resource groups:
//
//   az deployment group create \
//     --resource-group nzila-canada-<env>-rg \
//     --template-file apps/union-eyes/infra/environments/union-eyes-env.bicep \
//     --parameters environment=<env> postgresAdminPassword=<pwd>
//
// Each deployment provisions:
//   * Container Apps Environment   nzila-canada-<env>-env
//   * Container App                nzila-os-union-eyes-<env>
//   * PostgreSQL flexible server   nzila-os-union-eyes-<env>-db
//   * PostgreSQL database          nzila_os_<env>
//   * Key Vault                    nzila-canada-<env>-kv
//   * Log Analytics workspace      nzila-canada-<env>-law
//
// Production receives PremiumV3 sizing and 30-day backup retention. All
// non-production environments receive Burstable sizing and 7-day retention.

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

var isProd = environment == 'prod'
var dbName = 'nzila_os_${environment}'
var appName = 'nzila-os-union-eyes-${environment}'
var pgServerName = 'nzila-os-union-eyes-${environment}-db'
var kvName = 'nzila-canada-${environment}-kv'
var lawName = 'nzila-canada-${environment}-law'
var caEnvName = 'nzila-canada-${environment}-env'

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
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'UE_ENVIRONMENT', value: environment == 'prod' ? 'production' : environment }
            { name: 'NEXT_PUBLIC_APP_ENV', value: environment == 'prod' ? 'production' : environment }
            { name: 'NZILA_MODE', value: environment == 'prod' ? 'prod' : environment }
            { name: 'UE_DEPLOYMENT_TYPE', value: environment == 'demo' ? 'clc-demo' : environment }
            { name: 'UE_FEATURE_PROFILE', value: environment == 'demo' ? 'clc' : (environment == 'prod' || environment == 'pilot' ? 'executive' : 'internal') }
            { name: 'PGHOST', value: pg.properties.fullyQualifiedDomainName }
            { name: 'PGUSER', value: 'nzilaadmin' }
            { name: 'PGDATABASE', value: dbName }
            { name: 'PGSSLMODE', value: 'require' }
          ]
        }
      ]
      scale: {
        minReplicas: isProd ? 2 : 1
        maxReplicas: isProd ? 6 : 3
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
