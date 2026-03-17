# Flow — Runbook

> Operational runbook for the Flow commerce & production orchestration engine.

## Service Identity

| Field | Value |
|-------|-------|
| Name | `flow` |
| Package | `@nzila/flow` |
| Port | 3007 |
| Domain | commerce |
| Tier | PRODUCTION |
| Owner | commerce team |

## Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `/api/health` | Dependency health check | None |
| `/api/metrics` | Commerce KPIs | None |
| `/api/governance/telemetry` | Governance counters | Clerk |
| `/api/evidence/export` | Compliance evidence export | Clerk |
| `/api/ops/summary` | Operational summary | Clerk |
| `/api/quotes/*` | Quote CRUD | Clerk |

## Dependencies

| Dependency | Type | Failure Impact |
|------------|------|---------------|
| PostgreSQL | Database | Service-critical — returns 503 |
| Azure Blob | Storage | Degraded — evidence export fails |
| Shopify | External API | Degraded — sync stops |
| Zoho | External API | Degraded — accounting sync stops |
| Canva | External API | Degraded — design proofs unavailable |
| Clerk | Auth | Service-critical — auth fails |

## Common Issues

### 1. Database unreachable
- **Symptom:** Health returns 503, `dependencies.db = "down"`
- **Fix:** Check `DATABASE_URL` env var, verify PostgreSQL is running

### 2. Payment-blocked orders stuck
- **Symptom:** Orders in `DEPOSIT_REQUIRED` not advancing
- **Fix:** Verify payment records exist, check `order-payment-gating.ts` logic

### 3. Shopify sync failures
- **Symptom:** Products not syncing, health shows `shopify: "degraded"`
- **Fix:** Verify `SHOPIFY_ACCESS_TOKEN` and `SHOPIFY_SHOP_DOMAIN`

### 4. Zoho OAuth token expired
- **Symptom:** Zoho operations fail, health shows `zoho: "degraded"`
- **Fix:** Check refresh token validity, re-authorize if needed

## Deployment

```bash
# Build and push
docker build -t nzilastagingacr.azurecr.io/nzila/flow:latest -f Dockerfile .
docker push nzilastagingacr.azurecr.io/nzila/flow:latest

# Update container app
az containerapp update --name nzila-os-flow -g nzila-staging-rg \
  --image nzilastagingacr.azurecr.io/nzila/flow:latest
```

## Monitoring

- Health: `GET /api/health` (poll every 30s)
- Metrics: `GET /api/metrics` (scrape for dashboards)
- Governance: `GET /api/governance/telemetry` (audit pipeline)
- Ops: `GET /api/ops/summary` (control-plane dashboard)
