# Flow — Staging Validation Flow

> Step-by-step procedure to validate Flow in the staging environment.

## Prerequisites

- Azure Container App `nzila-os-flow` deployed and running
- Database seeded with demo data (`pnpm -C apps/flow demo:seed`)
- Environment variables set (Clerk, DB, Shopify, Zoho keys)

## Validation Steps

### 1. Health Check
```bash
curl https://nzila-os-flow.delightfulisland-0d503d3c.eastus.azurecontainerapps.io/api/health
```
**Expected:** HTTP 200, `{ "status": "ok", "service": "flow", "dependencies": { "db": "ok", "storage": "ok", ... } }`

### 2. Metrics Endpoint
```bash
curl https://nzila-os-flow.delightfulisland-0d503d3c.eastus.azurecontainerapps.io/api/metrics
```
**Expected:** HTTP 200, JSON with `order_count`, `quote_conversion_rate`, `avg_order_value`, `production_cycle_time`, `payment_blocked_orders`, `vendor_delay_count`

### 3. Governance Telemetry
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://nzila-os-flow.delightfulisland-0d503d3c.eastus.azurecontainerapps.io/api/governance/telemetry
```
**Expected:** HTTP 200 with `policy_denied_count`, `anomaly_count`, `audit_event_volume`, `payment_gate_blocks`

### 4. Evidence Export
```bash
curl https://nzila-os-flow.delightfulisland-0d503d3c.eastus.azurecontainerapps.io/api/evidence/export
```
**Expected:** HTTP 200, `{ "app": "flow", "version": "..." }`

### 5. Operational Summary
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://nzila-os-flow.delightfulisland-0d503d3c.eastus.azurecontainerapps.io/api/ops/summary
```
**Expected:** HTTP 200 with `active_orders`, `blocked_orders`, `production_backlog`, `vendor_delay_flags`

### 6. Demo Data Verification
- Navigate to the app in browser
- Verify ShopMoiCa org loads with quotes across all lifecycle stages
- Verify PromoNorth org loads with USD-priced quotes
- Check that order-centric data (orders, POs, production jobs) appears in appropriate views

### 7. Integration Dependencies
- Health endpoint should report shopify, zoho, canva dependency status
- If credentials are not configured, dependencies show as `degraded` (not `down`)

## Rollback

If validation fails:
1. Check container logs: `az containerapp logs show --name nzila-os-flow -g nzila-staging-rg`
2. Verify environment variables: `az containerapp show --name nzila-os-flow -g nzila-staging-rg --query "properties.template.containers[0].env"`
3. Redeploy previous image if needed
