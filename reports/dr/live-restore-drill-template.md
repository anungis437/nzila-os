# Union Eyes — Live Staging Restore Drill Evidence Report

> **Drill ID:** `live-drill-YYYY-MM-DD-XXXXXXXX`  
> **Date:** YYYY-MM-DD  
> **Mode:** EXECUTE (live staging restore)  
> **Environment:** staging  
> **Operator:** SRE Team  
> **Classification:** Internal — CISO / CTO Sign-Off Required

---

## Pre-Drill State

| Check | Value |
|-------|-------|
| Drill start time | HH:MM:SS UTC |
| Staging DB host | `nzila-staging-pg.postgres.database.azure.com` |
| Scratch DB name | `ue_drill_YYYYMMDD` |
| Migration count | 103 (or current count) |
| Pre-drill health check | `GET /api/ready` → HTTP 200 ✅ |

---

## 1. Executive Summary

> Fill in after execution.

This report documents the first live staging restore drill for Union Eyes,
measuring actual RTO (database restore → application healthy) against the
documented target of ≤ 4 hours.

**Overall verdict:** [PASS / FAIL]  
**Actual RTO:** [X minutes Y seconds]  
**RTO target:** ≤ 4 hours  
**RPO confirmed:** Continuous PITR — data loss window = [X minutes]

---

## 2. Procedure Executed

```bash
# Step 1: Pre-flight
pnpm dr:drill:checklist

# Step 2: Execute live restore drill
pnpm db:restore-drill:execute

# Step 3: Verify app health
curl -s https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/ready | jq .

# Step 4: Generate evidence report
pnpm dr:drill:report
```

---

## 3. Timings

| Phase | Start | End | Duration |
|-------|-------|-----|---------|
| Drill declared | HH:MM:SS | — | — |
| Scratch DB created | HH:MM:SS | HH:MM:SS | X min |
| Migrations applied | HH:MM:SS | HH:MM:SS | X min |
| Table count verified | HH:MM:SS | HH:MM:SS | X sec |
| App health check | HH:MM:SS | HH:MM:SS | X sec |
| Evidence generated | HH:MM:SS | HH:MM:SS | X sec |
| **Total RTO** | — | — | **X min Y sec** |

---

## 4. Check Results

| Check | Result | Notes |
|-------|--------|-------|
| Backup sources available | — | — |
| Scratch DB created | — | — |
| All migrations applied | — | — |
| Table count ≥ expected | — | — |
| Hash-chain spot check | — | — |
| `GET /api/ready` → 200 | — | — |
| `GET /api/health` → 200 | — | — |
| Cross-org query returns 0 rows | — | — |
| Evidence JSON written | — | — |
| Scratch DB dropped (cleanup) | — | — |

---

## 5. Post-Restore Verification

```bash
# Table count
psql -h $PGHOST -d ue_drill_YYYYMMDD \
  -c "SELECT schemaname, COUNT(*) FROM pg_tables GROUP BY schemaname;"

# Audit events check
psql -h $PGHOST -d ue_drill_YYYYMMDD \
  -c "SELECT COUNT(*), MAX(created_at) FROM audit_events;"

# App health
curl -s https://staging-url/api/ready | jq .
```

---

## 6. RTO Target vs Actual

| Metric | Target | Actual |
|--------|--------|--------|
| RTO (restore to app healthy) | ≤ 4 hours | **[MEASURED]** |
| RPO (data loss window) | ≤ 1 hour | **< 1 min (PITR continuous)** |

---

## 7. Issues Encountered

| # | Issue | Severity | Resolved During Drill |
|---|-------|----------|----------------------|
| — | — | — | — |

---

## 8. Corrective Actions

| # | Action | Owner | Target |
|---|--------|-------|--------|
| — | — | — | — |

---

## 9. maturity.json Update

After this drill, `apps/union-eyes/maturity.json` should be updated:

```json
{
  "backup_restore": "complete",
  "maturity_gaps": {
    "backup_restore": {
      "status": "closed",
      "severity": "none",
      "rtoActual": "[MEASURED]",
      "drillDate": "YYYY-MM-DD"
    }
  }
}
```

> The `pnpm db:restore-drill:execute` script auto-updates `maturity.json`
> on successful live execution.

---

## 10. Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| SRE Operator | — | — | ⬜ Pending |
| Platform Engineering | — | — | ⬜ Pending |
| CISO | — | — | ⬜ Pending |
| CTO | — | — | ⬜ Pending |

---

## 11. Next Scheduled Drill

**Next live restore drill:** [Next quarter, first Monday]

```bash
pnpm dr:drill:checklist
pnpm db:restore-drill:execute
pnpm dr:drill:report
```
