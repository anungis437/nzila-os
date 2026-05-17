# UnionEyes — Production Topology

> **Status: PLANNED — not yet deployed**
> This document defines the intended production topology.
> Do NOT mark UE as PRODUCTION READY until each section is validated against a live deployment.

## Domain

| Property | Value |
|---|---|
| Primary domain | `app.unioneyes.ca` (planned) |
| Alias | `unioneyes.nzila.app` (planned) |
| SSL | Azure-managed certificate (auto-renew) |
| DNS | Azure DNS Zone or Cloudflare (TBD) |
| CDN | Azure Front Door (optional — assess latency benefit first) |

## Hosting Platform

| Component | Technology | Status |
|---|---|---|
| Compute | Azure Container Apps (Canada Central) | Planned |
| Container registry | Azure Container Registry | Planned |
| CI/CD | GitHub Actions → ACR push → Container Apps deploy | Planned |
| Scale | Min 1 replica, max 5 replicas (CPU: 0.5 vCPU, Mem: 1Gi baseline) | Planned |
| Health probe | `GET /api/health` → `200 { status: "ok" }` | Implemented |

## Database

| Property | Value |
|---|---|
| Provider | Azure Database for PostgreSQL Flexible Server | Planned |
| Region | Canada Central | Planned |
| SKU | Standard_D2ds_v4 (production) / Burstable_B2s (staging) | Planned |
| HA | Zone-redundant standby (production) | Planned |
| Backup | 7-day point-in-time restore | Planned |
| TLS | Required — no plain-text connections | Planned |
| Connection pooling | PgBouncer (built-in Azure Flex) or Prisma Accelerate | TBD |

### Row-Level Security
- RLS context set per request via `withRLSContext(orgId)` middleware
- Drizzle ORM handles parameterized queries — no raw string interpolation in org IDs
- All tenant-bound tables verified by `ue-org-column-audit.test.ts` and `ue-rls-org-context.test.ts`

## Redis / Caching

| Property | Value |
|---|---|
| Provider | Upstash Redis (serverless) | Planned |
| Region | US-East-1 closest to Canada Central | Planned |
| Purpose | Rate limiting, session metadata, metrics cache | Planned |
| Fallback | All cache reads are optional — direct DB fallback implemented | ✅ Implemented |

## Blob Storage

| Property | Value |
|---|---|
| Provider | Azure Blob Storage (Canada Central) | Planned |
| Container name | `union-eyes-evidence` | Planned |
| Access | Private — SAS tokens per file, short TTL | Planned |
| Backup | Soft delete + 7-day retention | Planned |
| Max file size | 50MB per upload | Planned |

## Key Management

| Property | Value |
|---|---|
| Provider | Azure Key Vault | Planned |
| Secrets stored | DB connection string, Clerk secret, Blob SAS key, Sentry DSN | Planned |
| Access | Container Apps managed identity → Key Vault RBAC | Planned |

## Authentication

| Component | Value |
|---|---|
| Provider | Clerk | ✅ Implemented (staging) |
| Production app | `unioneyes-production` (Clerk dashboard — to be created) | Planned |
| Auth strategy | Clerk JWT → Next.js middleware validation | ✅ Implemented |
| Org-based access | Clerk Organizations — maps 1:1 to UE org_id | ✅ Implemented |
| MFA | Clerk default (OTP + optional TOTP) | Planned |
| Allowed domains | `app.unioneyes.ca` + `unioneyes.nzila.app` | Planned |

## Error Tracking

| Component | Value |
|---|---|
| Provider | Sentry | ✅ Wired (staging) |
| Project | `union-eyes-production` (to be created) | Planned |
| DSN | TBD — via Key Vault at deploy time | Planned |
| Environment tag | `production` | Planned |
| Source maps | Uploaded via Sentry GitHub Actions integration | Planned |

## Observability

| Component | Value |
|---|---|
| Provider | Azure Application Insights + OTEL | ✅ Wired (staging) |
| Dashboard | Azure Monitor Workbook — UE Ops | Planned |
| Metrics endpoint | `GET /api/metrics/operational` | ✅ Implemented |
| Governance telemetry | `GET /api/governance/telemetry` | ✅ Implemented |
| Health endpoint | `GET /api/health` | ✅ Implemented |
| Log routing | Azure Log Analytics workspace | Planned |
| Alert rules | P95 > 2s dashboard, error rate > 5%, health probe fail | Planned |

## Environment Variables (Production)

The following variables must exist in Key Vault and be injected by Container Apps before any production deployment:

| Variable | Source | Required |
|---|---|---|
| `DATABASE_URL` | Key Vault | ✅ Critical |
| `CLERK_SECRET_KEY` | Key Vault (Clerk prod app) | ✅ Critical |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Build-time env | ✅ Critical |
| `NEXT_PUBLIC_APP_URL` | `https://app.unioneyes.ca` | ✅ Critical |
| `STORAGE_ACCOUNT_NAME` | Key Vault | ✅ Critical |
| `STORAGE_ACCOUNT_KEY` | Key Vault | ✅ Critical |
| `UPSTASH_REDIS_REST_URL` | Key Vault | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Key Vault | Optional |
| `SENTRY_DSN` | Key Vault | ✅ Critical |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Key Vault | ✅ Critical |
| `NEXT_PUBLIC_POSTHOG_KEY` | Build-time env | Optional |
| `APP_ENV` | `production` | ✅ Critical |

## Deployment Flow

```
1. PR merged to main
2. GitHub Actions: build Docker image → push to ACR
3. GitHub Actions: deploy to staging (Azure Container App: union-eyes-staging)
4. Automated: pnpm --filter union-eyes test:ci (staging health check)
5. Manual gate: staging sign-off by founder / release engineer
6. GitHub Actions: promote to production (Azure Container App: union-eyes-prod)
7. Azure: traffic gradually shifted (10% → 50% → 100% over 5 min)
8. Automated: production health probe verified (3 consecutive OK)
9. Release tagged in GitHub
```

## Backup and Restore

| Backup | Method | RPO |
|---|---|---|
| PostgreSQL | Azure automated PITR (7 days) | 5 min |
| Blob storage | Azure soft delete (7 days) | 0 (soft delete) |
| Clerk data | Clerk-managed — not in our DB | N/A |

Restore procedure:
1. Trigger PITR from Azure Portal → restore to new server
2. Update `DATABASE_URL` in Key Vault to point to restored server
3. Restart Container App to pick up new connection string
4. Verify health probe: `GET /api/health` returns `{ status: "ok" }`
5. Run smoke tests: `pnpm --filter union-eyes test:smoke`

## Rollback Procedure

1. Azure Portal → Container App `union-eyes-prod` → Revisions
2. Activate previous revision
3. Set traffic weight: previous = 100%, current = 0%
4. Monitor health probe for 2 minutes
5. If stable: deactivate current revision
6. Post-rollback: file incident in GitHub Issues with `[INCIDENT]` label

## Incident Ownership

| Role | Responsibility |
|---|---|
| Primary on-call | Founder / Lead Engineer |
| Escalation | Nzila OS ops channel |
| Runbook | `apps/union-eyes/docs/DEMO_RUNBOOK.md` |
| Status page | TBD (GitHub Issues `[INCIDENT]` label in interim) |

## Pre-Production Gate Checklist

Before marking production topology as LIVE (see `PRODUCTION_CUTOVER_CHECKLIST.md`):

- [ ] All required env vars defined in Key Vault
- [ ] Health probe returns `200 { status: "ok" }` from prod URL
- [ ] Clerk production app created and domain allowlisted
- [ ] Rollback tested (deploy → revert → health check)
- [ ] Evidence pipeline verified end-to-end
- [ ] Staging release candidate validated for 48h
- [ ] No critical/high Sentry errors in prior 24h staging run
