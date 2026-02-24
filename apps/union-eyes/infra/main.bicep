// Nzila Vertical App - Azure Infrastructure

targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Product name')
param productName string

@description('Azure region')
param location string = 'canadacentral'

// ── App Service Plan ──
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'asp-${productName}-${environment}'
  location: location
  sku: {
    name: environment == 'prod' ? 'P1v3' : 'B1'
    tier: environment == 'prod' ? 'PremiumV3' : 'Basic'
    capacity: environment == 'prod' ? 2 : 1
  }
}

// ── Web App ──
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'app-${productName}-${environment}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      alwaysOn: environment == 'prod'
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

// ── Database ──
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: 'pg-${productName}-${environment}'
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard_D2s_v3' : 'Standard_B1ms'
    tier: environment == 'prod' ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    administratorLogin: 'nzilaadmin'
    administratorPassword: ''
    storage: {
      storageSizeGB: environment == 'prod' ? 128 : 32
    }
    backup: {
      backupRetentionDays: environment == 'prod' ? 30 : 7
    }
  }
}

// ── Redis Cache ──
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'redis-${productName}-${environment}'
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Basic'
    family: 'C'
    capacity: environment == 'prod' ? 2 : 1
  }
}

// ── Key Vault ──
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: 'kv-${productName}-${environment}'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

// ── Application Insights ──
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-${productName}-${environment}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
    RetentionInDays: environment == 'prod' ? 90 : 30
  }
}

// Outputs
output webAppUrl string = webApp.properties.defaultHostName
output postgresConnectionString string = 'postgresql://nzilaadmin@${postgresServer.name}:${postgresServer.properties.administratorPassword}@${postgresServer.name}.postgres.database.azure.com:5432/${productName}'
output redisConnectionString string = redisCache.properties.hostName
