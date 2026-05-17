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
| Container App | Azure Container Apps | `nzila-os-union-eyes-prod` | canadacentral | **validated** | Platform | 2/6 replicas, HTTP autoscaling (10 req/replica), active revision `--0000062` healthy |
| Managed env | Azure Container Apps | `nzila-canada-prod-env` | canadacentral | **validated** | Platform | Hosts UE prod app |
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
| ACA platform FQDN | Azure Container Apps | **validated** | `nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io` — TLS via ACA |
| Custom domain | Azure Container Apps | **validated** | `app.unioneyes.app` bound with `SniEnabled` + Azure managed certificate. HSTS `max-age=63072000; includeSubDomains; preload` (2-year) active. Full security header suite live (CSP, X-Frame-Options, COEP, COOP, CORP, Referrer-Policy, Permissions-Policy). Confirmed `2026-05-17T20:00:00Z`. |
| Azure Front Door | Azure CDN / AFD | **configured** | Profile `nzila-ue-afd-prod` (Standard_AzureFrontDoor). Endpoint `ue-prod` → `ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net`. Origin: ACA FQDN. Route: HTTP→HTTPS redirect, HTTPS-only forwarding, `/*`. WAF security policy linked (`Succeeded`). AFD propagation: `deploymentStatus: NotStarted` (propagating to PoPs at capture time). DNS change to route `app.unioneyes.app` → AFD endpoint not yet made — requires registrar access. |
| WAF | Azure Front Door WAF | **configured** | Policy `nzilauewafdprod` (Standard, Prevention mode). 2 custom rules: `RateLimitPerIP` (300 req/min → Block) + `BlockScanners` (path pattern → Block). Security policy `ue-prod-waf` linked to AFD endpoint (`Succeeded`). OWASP managed rule sets require Premium_AzureFrontDoor upgrade (deferred). |
| HSTS / canonical redirects | Application headers | **validated** | `max-age=63072000; includeSubDomains; preload` — 2-year HSTS with preload via Next.js `next.config.ts` headers. Confirmed live on `app.unioneyes.app`. |

## Image Registry

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| ACR | Azure Container Registry | `nzilacanadaacr` (in `nzila-canada-staging-rg`) | configured | Basic SKU. Cross-RG dependency for prod. Login server `nzilacanadaacr.azurecr.io`. UE prod pulls `nzila-os-union-eyes:4697daeee1d9a3e4393350159207429a5eb9044b` |

## Storage / Evidence

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| Blob storage | Azure Storage | `nzilacanadaprodev` | **configured** | Created `2026-05-17T20:30:00Z`. Standard_GRS, canadacentral, HTTPS-only, TLS 1.2+, public access off, deny-all network ACL + AzureServices bypass. Container `union-eyes-evidence` (private). Storage key stored as ACA secret `evidence-storage-key`. Wired via env vars on revision `--0000062`. **Gap**: key not yet in Key Vault (migration unblocked). |

## Cache / Rate Limiting

| Component | Provider | Resource | Status | Notes |
|---|---|---|---|---|
| Azure Cache for Redis | Azure | — | **deferred** | None in subscription. UE prod uses Upstash external Redis. |
| Upstash Redis | Upstash SaaS | `cuddly-mudfish-102231.upstash.io` | **validated** | Configured `2026-05-17T19:08:00Z`. URL + token stored as ACA secrets (`upstash-redis-url`, `upstash-redis-token`), wired via `secretRef` on revision `--0000049`. Health confirmed: `redis: {status:"ok", ms:37}`. **Gap**: token should be migrated to Key Vault before PRODUCTION READY stamp. |

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
| ACA system-assigned managed identity | **validated** | Principal `264f8347-4c8c-4732-983f-3bb06b563a0a`. Granted `Key Vault Secrets Officer` on `nzila-canada-prod-kv` `2026-05-17T20:45:00Z`. KV migration path for ACA secrets now unblocked. |
| MFA / SSO buyer claims | **planned** | Only claim what is enforced in production; do not pre-claim |

## Summary

UE prod has real compute, real Postgres (HA + geo-redundant backup),
real Key Vault, and real Log Analytics. Dedicated evidence blob store
`nzilacanadaprodev` is configured with GRS + deny-all network policy.
Custom domain `app.unioneyes.app` with 2-year HSTS + full security headers
is validated. Azure Front Door + WAF policy (Prevention mode, 2 custom rules)
are configured and security policy linked — DNS routing through AFD pending
registrar update. ACA managed identity has `Key Vault Secrets Officer` role
enabling secret migration from ACA secrets to KV. Cross-RG ACR dependency
is acceptable and recorded.
