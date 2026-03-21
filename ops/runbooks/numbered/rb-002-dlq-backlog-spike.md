# Runbook: DLQ / Outbox Backlog Spike

**ID:** RB-002
**Severity:** P2
**Category:** Infrastructure / Integration
**Owner:** Platform Engineering
**Last Updated:** 2026-03-03

---

## Symptoms

- Console → System Health shows outbox backlog status `critical` (>100 pending)
- DLQ count exceeds SLO threshold (`ops/slo-policy.yml → dlq.backlog_max`)
- ChatOps alert: "DLQ backlog exceeded threshold"
- Integration delivery delays reported by orgs

## Impact

- Event delivery to downstream systems delayed or stalled
- Org data may be stale in integrated systems (CRM, accounting, etc.)

## Diagnosis

1. **Console → System Health**: Review outbox backlog table.
2. **Check oldest pending event age:**
   ```sql
   SELECT domain, COUNT(*) AS pending, MIN(created_at) AS oldest
   FROM <domain>_outbox
   WHERE status = 'pending'
   GROUP BY domain;
   ```
3. **Check DLQ entries:**
   ```sql
   SELECT type, COUNT(*), MIN(created_at), MAX(retry_count)
   FROM automation_commands
   WHERE status = 'dlq'
   GROUP BY type;
   ```
4. **Check worker saturation** in Console → System Health (worker metrics table).

## Remediation

1. **If worker is saturated (>90%):**
   - Scale worker instances (increase replica count).
   - Temporarily increase concurrency limit.

2. **If downstream is failing:**
   - Check integration health: Console → Integrations.
   - Disable the failing provider temporarily (feature flag).
   - Events will queue and retry once provider recovers.

3. **Replay DLQ items** (after root cause is fixed):
   ```sql
   UPDATE automation_commands
   SET status = 'pending', retry_count = 0, updated_at = NOW()
   WHERE status = 'dlq'
     AND type = '<affected_type>';
   ```

4. **If backlog is from a single org:**
   - Check org-specific integration credentials.
   - Verify org-scoped rate limits.

## Prevention

- Alert on DLQ backlog at 50% of SLO max (early warning).
- Weekly review of DLQ trends in health digest.
- Ensure circuit breaker is configured for all integration adapters.

## Audit

- All DLQ replays must create audit event: `dlq.replay.initiated`.
- Document root cause in incident ticket.
