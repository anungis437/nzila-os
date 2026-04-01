// ──────────────────────────────────────────────────────────────────────────────
// W2-6: Azure Key Vault with auto-rotation
// Manages secrets with automatic rotation policies for database passwords,
// API keys, and encryption keys.
// ──────────────────────────────────────────────────────────────────────────────

param name string
param location string
param enableAutoRotation bool = true
param rotationIntervalDays int = 90

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
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
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// ── Diagnostic settings (send to Sentinel) ──────────────────────────────

param logAnalyticsWorkspaceId string = ''

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  scope: keyVault
  name: '${name}-diagnostics'
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
  }
}

// ── Rotation policy for secrets ─────────────────────────────────────────
// Note: Actual rotation policies are set per-secret. This module creates
// the vault; rotation policies must be applied via az keyvault secret
// set-attributes or ARM per secret after creation.
//
// Example auto-rotation policy (applied via CLI after deploy):
//   az keyvault secret rotation-policy update \
//     --vault-name ${name} \
//     --name database-password \
//     --value /path/to/rotation-policy.json
//
// rotation-policy.json:
// {
//   "lifetimeActions": [{
//     "trigger": { "timeBeforeExpiry": "P30D" },
//     "action": { "type": "Notify" }
//   }, {
//     "trigger": { "timeAfterCreate": "P${rotationIntervalDays}D" },
//     "action": { "type": "Rotate" }
//   }],
//   "attributes": {
//     "expiryTime": "P${rotationIntervalDays + 30}D"
//   }
// }

output vaultUri string = keyVault.properties.vaultUri
output vaultId string = keyVault.id
