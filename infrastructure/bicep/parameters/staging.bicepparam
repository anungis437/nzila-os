// ──────────────────────────────────────────────────────────────────────────────
// Nzila OS — Staging Parameters
// ──────────────────────────────────────────────────────────────────────────────

using '../main.bicep'

param env = 'staging'

param dbSku = 'GP_Standard_D4ds_v5'
param dbStorageGb = 256
param dbReadReplicas = 0
param pgBouncerMaxClients = 500
param containerMaxReplicas = 5
param containerCpu = '0.5'
param containerMemory = '1Gi'
param scaleConcurrency = '30'
param enableMultiRegion = false
param secondaryLocation = ''
