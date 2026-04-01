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
    maxReplicas: env == 'prod' ? 20 : (env == 'staging' ? 5 : 2)
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────
output acrLoginServer string = acr.outputs.loginServer
output keyVaultUri string = keyvault.outputs.vaultUri
output logAnalyticsWorkspaceId string = sentinel.outputs.workspaceId
output frontDoorEndpoint string = waf.outputs.frontDoorEndpoint
output containerEnvId string = containerApps.outputs.environmentId
