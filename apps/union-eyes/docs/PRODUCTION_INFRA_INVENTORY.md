# UnionEyes — Production Infrastructure Inventory (B1A)

Subscription: `5d819f33-d16f-429c-a3c0-5b0e94740ba3` (Azure subscription 1 Nzila)
Tenant: `onelabtech.com` (`5082b8be-b04d-4a13-b61c-b6397670177b`)
Primary RG: `nzila-canada-prod-rg` (Canada Central, `Succeeded`)

Live `az resource list` against `nzila-canada-prod-rg` returned the
resources below. Anything not enumerated by Azure is recorded as
`planned` or `deferred`, never `validated`.

## Compute

| Component | Provider | Resource | Region | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| Container App | Azure Container Apps | `nzila-os-union-eyes-prod` | canadacentral | configured | Platform | Single revision mode, 2/6 replicas, latest `--0000041` healthy |
| Managed env | Azure Container Apps | `nzila-canada-prod-env` | canadacentral | configured | Platform | Hosts UE prod app |
| Managed env (system) | ACA internal | `mc-nzila-canada-p-app-unioneyes-ap-1545` | canadacentral | configured | Azure | Auto-created managed component |

## Data

| Component | Provider | Resource | Region | Status | Notes |
|---|---|---|---|---|---|
| Postgres Flex | Azure Database for PostgreSQL Flexible Server | `nzila-os-union-eyes-prod-db` | canadacentral | configured | v16, `Standard_D2s_v3` GeneralPurpose, 256 GB P15 (1100 IOPS, auto-grow on), Zone-Redundant HA standby in AZ 1, 30-day backups, geo-redundant backup enabled, primary replication role |
| Postgres FQDN | — | `nzila-os-union-eyes-prod-db.postgres.database.azure.com` | canadacentral | configured | TLS required |

## Secrets

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| Key Vault | Azure Key Vault | `nzila-canada-prod-kv` | configured | RBAC auth enabled, soft delete on, purge protection on, no network ACLs (open to subscription). Caller (`appid 04b07795-…`) lacks `readMetadata` on secrets — confirms RBAC is enforced. See `SECRET_MANAGEMENT_VALIDATION.md` for secret inventory expectations. |

## Observability

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| Log Analytics | Azure Monitor | `nzila-canada-prod-law` | configured | PerGB2018 SKU, 90-day retention, `Succeeded` |
| Application Insights | Azure Monitor | — | **planned** | Not present in prod RG at scan time. Confirm whether UE telemetry is being routed via the LAW workspace directly or via an unmanaged App Insights resource. |
| Sentry | Sentry SaaS | n/a | configured (external) | DSN expected via env var; live ingestion not verified in this pass |

## Networking

| Component | Provider | Status | Notes |
|---|---|---|---|
| ACA platform FQDN | Azure Container Apps | configured | `nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io` — TLS via ACA |
| Custom domain | — | **planned** | Not bound |
| WAF / Front Door / Application Gateway | — | **planned** | Not bound to UE prod yet |
| HSTS / canonical redirects | — | **planned** | Pending custom domain |

## Image Registry

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| ACR | Azure Container Registry | `nzilacanadaacr` (in `nzila-canada-staging-rg`) | configured | Basic SKU. Cross-RG dependency for prod. Login server `nzilacanadaacr.azurecr.io`. UE prod pulls `nzila-os-union-eyes:4697daeee1d9a3e4393350159207429a5eb9044b` |

## Storage / Evidence

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| Blob storage | Azure Storage | — | **deferred** | No storage account in `nzila-canada-prod-rg`. Subscription contains `nzilacanadastore` (in canada staging RG, canadacentral) and `nzilastagingstore` (eastus — not for prod). Production evidence/blob path must be explicitly chosen before PRODUCTION READY. |

## Cache / Rate Limiting

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| Azure Cache for Redis | Azure | — | **deferred** | None in subscription. UE prod is configured for Upstash via `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars. Live Upstash connectivity not verified by this pass. Health check correctly reports `Redis not configured — optional for this deployment`, so this is honest amber, not green. |

## DR / Backup

| Component | Resource | Status | Notes |
|---|---|---|---|
| Postgres PITR | `nzila-os-union-eyes-prod-db` | configured | 30-day retention, earliest restore captured at scan time, geo-redundant backup enabled |
| DR region | canadaeast | **planned** | No DR resource enumerated in this scan; covered conceptually in `production.yml` but not provisioned in the prod RG |
| Restore rehearsal | — | **deferred** | See `BACKUP_RESTORE_VALIDATION.md` |

## Identity

| Component | Status | Notes |
|---|---|---|
| Postgres password / session auth | configured | `AUTH_SECRET` sourced via ACA secret `enc-key` |
| Entra External ID | configured | `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID` plaintext env; `AZURE_AD_CLIENT_SECRET` via KV-backed ACA secret |
| MFA / SSO buyer claims | **planned** | Only claim what is enforced in production; do not pre-claim |

## Summary

UE prod has real compute, real Postgres (HA + geo-redundant backup),
real Key Vault, and real Log Analytics. Missing in prod RG and explicitly
not green: dedicated prod storage account, prod-region Redis (Upstash
external is the design), custom domain + WAF, App Insights component.
Cross-RG ACR dependency is acceptable but recorded.
