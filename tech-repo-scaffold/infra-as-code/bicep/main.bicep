// Nzila Platform — Azure Infrastructure
// Orchestrates all resource deployments

targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region')
param location string = 'canadacentral'

@description('Product name for resource naming')
param productName string

// ── Container Registry ──
module acr 'modules/container-registry.bicep' = {
  name: 'acr-${productName}'
  params: {
    name: 'acr${productName}${environment}'
    location: location
  }
}

// ── PostgreSQL ──
module postgres 'modules/postgres.bicep' = {
  name: 'pg-${productName}'
  params: {
    name: '${productName}-db-${environment}'
    location: location
    administratorLogin: 'nzilaadmin'
    administratorPassword: '' // Set via Key Vault
  }
}

// ── Redis Cache ──
module redis 'modules/redis.bicep' = {
  name: 'redis-${productName}'
  params: {
    name: '${productName}-cache-${environment}'
    location: location
  }
}

// ── Container Apps Environment ──
module containerEnv 'modules/container-app.bicep' = {
  name: 'cae-${productName}'
  params: {
    name: '${productName}-env-${environment}'
    location: location
    acrLoginServer: acr.outputs.loginServer
  }
}

// ── Key Vault ──
module keyVault 'modules/key-vault.bicep' = {
  name: 'kv-${productName}'
  params: {
    name: 'kv-${productName}-${environment}'
    location: location
  }
}

// ── Storage Account (evidence + minutebook + exports) ──
module storage 'modules/storage-account.bicep' = {
  name: 'st-${productName}'
  params: {
    name: 'st${productName}${environment}'
    location: location
    skuName: environment == 'prod' ? 'Standard_RAGRS' : 'Standard_LRS'
    enableVersioning: true
    softDeleteRetentionDays: environment == 'prod' ? 30 : 7
    tags: {
      product: productName
      environment: environment
    }
  }
}

// ── Monitoring ──
module monitoring 'modules/monitoring.bicep' = {
  name: 'mon-${productName}'
  params: {
    name: '${productName}-insights-${environment}'
    location: location
  }
}
