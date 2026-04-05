// ──────────────────────────────────────────────────────────────────────────────
// Nzila OS — Production Parameters (1M+ users, multi-region)
//
// Use this file when scaling beyond 500K users.
// Enables multi-region deployment with active-active container environments.
//
// Deploy:
//   az deployment group create -g nzila-prod-rg \
//     -f infrastructure/bicep/main.bicep \
//     -p @infrastructure/bicep/parameters/prod-global.bicepparam
// ──────────────────────────────────────────────────────────────────────────────

using '../main.bicep'

param env = 'prod'

// ── Database (Maximum vertical + horizontal) ─────────────────────────────
param dbSku = 'GP_Standard_E32ds_v5'           // 32 vCores, 256 GiB RAM
param dbStorageGb = 4096                       // 4 TB with auto-grow
param dbReadReplicas = 5                       // 5 read replicas (analytics, reporting, per-region)
param pgBouncerMaxClients = 10000              // 10K client connections

// ── Containers (high-density) ────────────────────────────────────────────
param containerMaxReplicas = 100               // 100 replicas × 50 req = 5000 concurrent
param containerCpu = '4.0'                     // 4 CPU cores per replica
param containerMemory = '8Gi'                  // 8 GiB — headroom for SSR + GC
param scaleConcurrency = '50'

// ── Multi-Region (active-active) ─────────────────────────────────────────
param enableMultiRegion = true
param secondaryLocation = 'eastus'             // US East for Americas latency
