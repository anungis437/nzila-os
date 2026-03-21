# Runbook: Error Rate Spike

**ID:** RB-005
**Severity:** P1–P2
**Category:** Application
**Owner:** Platform Engineering / App Team
**Last Updated:** 2026-03-03

---

## Symptoms

- Console → Performance shows error rate above SLO threshold
- Console → Performance → Regressions shows error spike entries
- ChatOps alert: "Error rate spike: {app} at {rate}%"
- Health digest flags error anomaly
- User-reported errors / blank pages / 500 responses

## Impact

- Users unable to complete workflows
- Data integrity risk if writes partially succeed
- SLO violation may block next deploy

## Diagnosis

1. **Console → Performance → Regressions → Error Spikes**: Identify affected routes.
2. **Check error distribution:**
   ```sql
   SELECT route, status_code, COUNT(*) AS errors
   FROM request_metrics
   WHERE app = '{app}'
     AND status_code >= 400
     AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY route, status_code
   ORDER BY errors DESC;
   ```
3. **Check application logs** for stack traces:
   ```bash
   # Azure App Service
   az webapp log tail --name <app> --resource-group <rg>
   ```
4. **Check if deploy-correlated** (same as RB-004).
5. **Check for infrastructure issues** (DB, Redis, external services).

## Remediation

1. **If code regression:**
   - Rollback to last known-good version.
   - Fix and re-deploy with the fix.

2. **If data-related (bad input / migration issue):**
   - Identify affected records.
   - Apply data fix with audit trail.
   - Add input validation to prevent recurrence.

3. **If infrastructure:**
   - Follow appropriate runbook (RB-001 for DB, RB-003 for integrations).

4. **If specific to one org:**
   - Check org-specific configuration.
   - Isolate org if needed (`@nzila/platform-isolation`).
   - Investigate org-specific data.

## Prevention

- Error rate alerting at 50% of SLO max (early warning).
- Mandatory error boundary components in all apps.
- Contract tests verify error handling paths.
- Canary deploys for pilot/prod.

## Audit

- All rollbacks logged as deployment events.
- Data fixes must create audit events with before/after state.
