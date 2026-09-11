// Nzila Vertical App - Azure Infrastructure
//
// STALE — NOT the live deployment authority for Union Eyes staging/production.
// Confirmed 2026-09-01 (docs/union-eyes/reality-remediation/26, PR #751 /
// fix/ue-runtime-rls-foundation): the deployed nzila-os-union-eyes-* apps run
// on Azure Container Apps, provisioned/updated by
// .github/workflows/deploy-union-eyes.yml (dispatched by
// .github/workflows/auto-promote-union-eyes.yml). This file defines an App
// Service topology with a `postgresAdminPassword` parameter that recreates
// the exact admin-as-runtime anti-pattern the RLS foundation fix removes —
// do not deploy this file as-is, and do not use it as a reference for how
// the current Container Apps environment is configured. Left in place only
// so its history isn't lost; a follow-up should either delete it or rewrite
// it to describe the actual Container Apps topology.

targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Product name')
param productName string

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

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
    administratorLoginPassword: postgresAdminPassword
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
  properties: {
    sku: {
      name: environment == 'prod' ? 'Standard' : 'Basic'
      family: 'C'
      capacity: environment == 'prod' ? 2 : 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
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
output postgresServerName string = postgresServer.name
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = productName
output postgresAdminUser string = 'nzilaadmin'
output redisHostName string = redisCache.properties.hostName
