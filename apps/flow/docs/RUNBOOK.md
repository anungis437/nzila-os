# Flow — Operational Runbook

## Overview

Operational procedures for maintaining and troubleshooting the Flow application
in staging and production environments.

## Health Checks

| Endpoint | Expected Response | Notes |
|----------|-------------------|-------|
| `GET /api/health` | `200 { "status": "ok" }` | Basic liveness |
| `GET /api/health/db` | `200 { "status": "ok", "latency_ms": <n> }` | Database connectivity |
| `GET /api/health/ready` | `200` | Readiness probe (all dependencies up) |

## Common Issues

### Stuck Orders

**Symptom**: Order remains in `confirmed` state despite all production jobs completed.

**Cause**: Job completion event was not processed (dead letter, race condition).

**Resolution**:
1. Verify all jobs for the order: `SELECT * FROM production_jobs WHERE order_id = '<id>';`
2. If all jobs are `completed`, manually advance the order:
   ```sql
   UPDATE orders SET status = 'fulfilled', updated_at = now() WHERE id = '<id>' AND status = 'confirmed';
   ```
3. Investigate the event log for missed events.

### Payment Sync Failures

**Symptom**: Payment recorded in payment provider but order still `created`.

**Cause**: Webhook delivery failure or payload mismatch.

**Resolution**:
1. Check webhook logs in the payment provider dashboard.
2. Replay the webhook event if available.
3. As a last resort, manually confirm the order after verifying payment.

### Quote Expiry Not Firing

**Symptom**: Quotes past `expires_at` still show as `sent`.

**Cause**: Scheduled expiry job is not running or is behind.

**Resolution**:
1. Check the cron job / scheduled task status.
2. Run the expiry sweep manually: `pnpm flow:expire-quotes`
3. Verify `expires_at` values are stored in UTC.

## Troubleshooting Steps

1. Check application logs: `az containerapp logs show -n nzila-os-flow -g <rg>`
2. Verify database connectivity from the app container.
3. Check event processing queue depth.
4. Review recent deployments for configuration changes.

## Database Queries

```sql
-- Orders stuck in a state for more than 24 hours
SELECT id, status, created_at, updated_at
FROM orders
WHERE updated_at < now() - interval '24 hours'
  AND status NOT IN ('delivered', 'cancelled');

-- Quote expiry candidates
SELECT id, status, expires_at
FROM quotes
WHERE status = 'sent' AND expires_at < now();

-- Production job summary by status
SELECT status, count(*) as total
FROM production_jobs
GROUP BY status;

-- Recent failed jobs
SELECT id, order_id, error_message, updated_at
FROM production_jobs
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 20;
```

## Deployment Notes

- Flow is deployed as a container app in the staging environment.
- Environment variables are managed via Azure Container Apps configuration.
- Database migrations must be run before deploying a new version with schema changes.
- Rollback: redeploy the previous container image tag.

## Related Docs

- [WORKFLOW_MODEL.md](WORKFLOW_MODEL.md) — State machine definitions
- [DOMAIN_MODEL_HARDENED.md](DOMAIN_MODEL_HARDENED.md) — Invariants and access control
- [STAGING_SEED_GUIDE.md](STAGING_SEED_GUIDE.md) — Staging data setup
