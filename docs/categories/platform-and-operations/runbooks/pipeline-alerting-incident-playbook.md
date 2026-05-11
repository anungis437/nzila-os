# Pipeline Alerting Incident Playbook

> **Scope**: Decision-aggregate pipeline (`materialize-decision-aggregates`).  
> **Owner**: Platform / Data-Integrity squad.  
> **Last updated**: 2026-06-07

---

## 1. Alert Severity Reference

| Severity | HTTP status | Meaning | Typical action |
|----------|-------------|---------|----------------|
| `info`   | 200 OK      | Informational signal; no immediate action required | Monitor |
| `warning`| 200 `status: "warning"` | SLA lag approaching limit **or** integrity degraded but recoverable | Investigate within 1 hour |
| `critical`| 503 Service Unavailable | Freshness breached, run failed, integrity invalid, or retries exhausted | Page on-call immediately |

---

## 2. Alert Triggers

| Trigger constant | Severity | Condition |
|-----------------|----------|-----------|
| `freshness_sla_warning` | warning | Pipeline freshness lag exceeds warning threshold |
| `freshness_sla_breach` | critical | Pipeline freshness lag exceeds breach threshold |
| `latest_run_failed` | critical | Last pipeline run exited with `status: "failure"` |
| `aggregate_verification_failed` | warning / critical | Integrity check severity is `warning` / `critical` |
| `repeated_retry_failures` | critical | `retryAttempt >= maxAttempts` |
| `suspicious_record_drop` | warning | An org's record count dropped >50 % vs previous run |
| `checkpoint_not_advanced` | warning | Pipeline checkpoint timestamp did not advance |
| `missing_database_url` | critical | `DATABASE_URL` env var is absent at job startup |

---

## 3. Health Endpoint

`GET /api/pipeline-health` (control-plane, port 3010)

| Response | Meaning |
|---------|---------|
| `200 { status: "ok" }` | No unresolved alerts in the last 24 h |
| `200 { status: "warning", count: N }` | N warning-level unresolved alerts |
| `503 { status: "critical", count: N }` | N critical-level unresolved alerts |

**Escalation rule**: If `/api/pipeline-health` returns 503 for more than 5 minutes continuously, page the on-call engineer.

---

## 4. Diagnosing a Critical Alert

### Step 1 — Identify the trigger

```sql
SELECT pipeline_name, error_code, severity, message, created_at, metadata
FROM pipeline_alerts
WHERE resolved_at IS NULL
  AND severity = 'critical'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Step 2 — Check recent job output

```bash
# Staging: check container logs
az containerapp logs show \
  --name nzila-os-control-plane \
  --resource-group nzila-canada-staging-rg \
  --follow --tail 200
```

### Step 3 — Determine if a dry-run is safe

```bash
pnpm --filter @nzila/control-plane job:materialize
```

If job fails with a structural error (schema mismatch, DB unreachable) → see §5.

---

## 5. Repair Mode — Full Rebuild

Use repair mode only after confirming the underlying data issue is resolved.

```bash
pnpm --filter @nzila/control-plane job:repair-aggregates
```

This runs:
```
tsx jobs/materialize-decision-aggregates.ts --mode=repair --confirm-full-rebuild
```

**What it does**:
- Drops and re-materializes all decision aggregates from the canonical audit log
- Re-runs integrity checks and emits alerts if checks still fail after repair
- Takes longer than a standard incremental run (expect 2–10 min depending on data volume)

**When to use**:
- After a hotfix that changes aggregate calculation logic
- After schema migration introduces a breaking change to aggregate columns
- After a detected data gap that cannot be patched incrementally

**Safety guard**: The `--confirm-full-rebuild` flag must be present; the job will exit with code 1 if omitted.

---

## 6. Resolving Alerts Manually

After a successful repair, mark alerts resolved:

```sql
UPDATE pipeline_alerts
SET resolved_at = NOW()
WHERE resolved_at IS NULL
  AND pipeline_name = 'decision-aggregates'
  AND severity IN ('critical', 'warning');
```

Then verify `/api/pipeline-health` returns `200 { status: "ok" }`.

---

## 7. Error Code Quick Reference

| Error code | Likely cause | Fix |
|------------|-------------|-----|
| `MISSING_DB_URL` | `DATABASE_URL` not set in container env | Set env var, redeploy |
| `FRESHNESS_SLA_BREACH` | Pipeline not run in > 2 h | Check cron schedule, restart job |
| `INTEGRITY_FAIL_COMPLETENESS` | Fewer orgs in output than expected | Check new org onboarding, run repair |
| `INTEGRITY_FAIL_CONSISTENCY` | Zero output from non-zero input | Schema mismatch or DB write error |
| `INTEGRITY_WARN_ANOMALY` | Suspicious record-count drop | Compare with prior run; may be normal after data cleanup |
| `RETRY_EXHAUSTED` | Job retried `maxAttempts` times and still failing | Check DB connectivity and upstream audit-log table |
| `AGGREGATE_WRITE_FAILED` | Drizzle insert/upsert error | Check DB disk space, constraint violations |
| `CHECKPOINT_STALE` | Checkpoint not advanced after run | Manual checkpoint reset required |
| `WINDOW_BOUNDS_ERROR` | Invalid time-window parameters | Verify cron schedule and `--window` args |
| `ORG_LOOKUP_FAILED` | Cannot resolve org list from DB | Check `organizations` table access |
| `DECISION_QUERY_FAILED` | Error querying `decision_audit_log` | Check table existence and column schema |
| `CROSS_ORG_ANOMALY` | Aggregate totals inconsistent across orgs | Investigate cross-org data leakage |
| `NAR_CHAIN_MISMATCH` | NAR proof-chain hash mismatch | Potential audit-log tampering; escalate to security |

---

## 8. Escalation Path

1. **L1 (automated)** — `/api/pipeline-health` 503 triggers PagerDuty alert to `#platform-oncall`
2. **L2 (platform engineer)** — Run diagnosis steps (§4), attempt repair (§5)
3. **L3 (security)** — Escalate immediately if `NAR_CHAIN_MISMATCH` or `CROSS_ORG_ANOMALY` appears

---

## 9. Runbook Contacts

| Role | Slack handle |
|------|-------------|
| Platform on-call | `#platform-oncall` |
| Data integrity lead | `#data-integrity` |
| Security team | `#security-incidents` |
