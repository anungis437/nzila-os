// ──────────────────────────────────────────────────────────────────────────────
// Nzila OS — Production Parameters (100K users)
//
// Scaling profile: GP_Standard_E8ds_v5, 2 read replicas, PgBouncer 5000 clients,
// 50 max container replicas, 2 CPU / 4Gi memory per app.
//
// Upgrade path:
//   100K → 500K: Change dbSku to E16ds_v5, dbReadReplicas to 3, containerMaxReplicas to 80
//   500K → 1M+:  Change dbSku to E32ds_v5, dbReadReplicas to 5, enableMultiRegion to true
//
// Deploy:
//   az deployment group create -g nzila-prod-rg \
//     -f infrastructure/bicep/main.bicep \
//     -p @infrastructure/bicep/parameters/prod.bicepparam
// ──────────────────────────────────────────────────────────────────────────────

using '../main.bicep'

param env = 'prod'

// ── Database (PgBouncer + HA + Read Replicas) ────────────────────────────
param dbSku = 'GP_Standard_E8ds_v5'           // 8 vCores, 64 GiB RAM
param dbStorageGb = 1024                       // 1 TB with auto-grow
param dbReadReplicas = 2                       // 2 read replicas for analytics/reporting
param pgBouncerMaxClients = 5000               // 5000 client connections via PgBouncer

// ── Containers ───────────────────────────────────────────────────────────
param containerMaxReplicas = 50                // 50 replicas × 50 req/replica = 2500 concurrent
param containerCpu = '2.0'                     // 2 CPU cores per replica
param containerMemory = '4Gi'                  // 4 GiB — avoids GC pressure
param scaleConcurrency = '50'                  // Scale out at 50 concurrent requests/replica

// ── Multi-Region (disabled until reaching global scale) ──────────────────
param enableMultiRegion = false
param secondaryLocation = ''                   // Set to 'eastus' or 'westeurope' when needed
