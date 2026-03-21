# Runbook: Database Connection Pool Exhaustion

**ID:** RB-001
**Severity:** P1
**Category:** Infrastructure
**Owner:** Platform Engineering
**Last Updated:** 2026-03-03

---

## Symptoms

- Application returns 500 errors with "connection pool exhausted" or "too many clients"
- Console → System Health shows DB health check failing
- Latency spikes across all routes
- `platform_metrics.db_pool_active` at or near `db_pool_max`

## Impact

- All orgs on affected database cluster experience degraded or unavailable service
- Writes may fail, causing DLQ backlog growth

## Diagnosis

1. **Console → System Health**: Check DB connection status card.
2. **Query active connections:**
   ```sql
   SELECT count(*), state, usename, application_name
   FROM pg_stat_activity
   GROUP BY state, usename, application_name
   ORDER BY count DESC;
   ```
3. **Check for long-running queries:**
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
   ORDER BY duration DESC;
   ```
4. Check if a specific app or org is monopolizing connections.

## Remediation

1. **Kill long-running queries** (if safe):
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE duration > interval '10 minutes'
     AND state != 'idle';
   ```
2. **Restart affected app** to reset connection pool:
   ```bash
   # In Azure / Docker
   az webapp restart --name <app> --resource-group <rg>
   # Or locally
   docker compose restart <service>
   ```
3. **Scale connection pool** (temporary):
   - Update `DATABASE_POOL_MAX` env var (default 20 → 40).
   - Redeploy.
4. **Enable PgBouncer** if not already active.

## Prevention

- Set `statement_timeout` to 30s in production.
- Ensure all queries use parameterized queries (enforced by `@nzila/db`).
- Monitor `db_pool_active` metric with alert at 80% threshold.

## Audit

- Log all `pg_terminate_backend` calls in audit trail.
- Create incident ticket and link to postmortem.
