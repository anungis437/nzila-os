# Zonga — DR Restore Drill Runbook

> **Owner:** SRE Team  
> **Review Cadence:** Quarterly (drill), Annually (plan review)  
> **Controls Covered:** DR-01, DR-02  
> **Last Updated:** 2026-04-28  
> **Classification:** Internal

---

## Purpose

Define a repeatable, evidence-producing procedure for validating Zonga (music
distribution + royalty platform) disaster recovery capability. Each drill
produces a structured evidence artifact stored at
`reports/dr/restore-drill-YYYY-MM-DD.json` and a human-readable report at
`reports/dr/restore-drill-YYYY-MM-DD.md`.

This runbook satisfies the reproducible restore-drill evidence requirement for
the Zonga app and parallels the pattern established by Union Eyes
(`docs/union-eyes/dr/restore-drill-runbook.md`). The same shared
`scripts/db/restore-drill.ts` script is used; only the scratch database name
prefix differs.

---

## Recovery Objectives

| Metric | Target | Measured By |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | ≤ 4 hours | Time from disaster declaration to `/api/ready` returns HTTP 200 |
| **RPO** (Recovery Point Objective) | ≤ 1 hour | Maximum data loss window (Azure PITR provides continuous WAL) |

Royalty payouts and creator earnings are append-only ledgers — recovery beyond
the RPO window is satisfied by replaying audit events from the evidence pipeline.

---

## Drill Cadence

| Drill Type | Frequency | Scope | Evidence Required |
|-----------|-----------|-------|------------------|
| Dry-run evidence audit | Monthly | Procedure + infrastructure audit, no live restore | `reports/dr/restore-drill-YYYY-MM-DD.json` |
| Staging live restore | Quarterly | Full restore to scratch DB in staging, app health check | `reports/dr/restore-drill-YYYY-MM-DD.json` + `reports/dr/restore-drill-YYYY-MM-DD.md` |
| Full environment rebuild | Annually | Provision from IaC + restore + validate | Annual DR report, sign-off by CTO + CISO |

---

## Pre-Drill Checklist

Before starting any drill, confirm the following. Run `pnpm dr:drill:checklist`
to generate a printable version. For live staging drills, run
`pnpm dr:drill:checklist --live`.

- [ ] Confirmed drill is on staging or isolated environment (NEVER production)
- [ ] Informed on-call team via ops channel
- [ ] Azure PostgreSQL Flexible Server admin credentials available in Key Vault
- [ ] Scratch database name chosen (default: `zonga_drill_YYYYMMDD`)
- [ ] Operator identity recorded (name, role, timestamp)
- [ ] GitHub Actions secrets available if running via CI
- [ ] `pnpm install --frozen-lockfile` run successfully
- [ ] `scripts/db/restore-drill.ts` accessible
- [ ] For live execution, `DR_DB_HOST` and `DR_DB_USER` are set
- [ ] Optional but recommended: `DR_READY_URL` set for app readiness verification
  (point at the Zonga container app `/api/ready` endpoint)

---

## Trigger

This drill is triggered by any of the following:

- Quarterly schedule (first Monday of each quarter, 10:00 ET)
- Procurement or pilot-client request for evidence within 30 days
- Maturity gap closure review
- Post-incident verification

---

## Drill Execution

### Step 1 — Generate dry-run evidence (no DB required)

```bash
pnpm db:restore-drill
# or explicitly:
npx tsx scripts/db/restore-drill.ts
```

This checks:

1. Backup source availability (Azure PITR + Blob manifest)
2. Migration file integrity (count + checksum)
3. DR documentation completeness (RTO/RPO present)
4. `db:doctor` pass (migration ordering, destructive DDL audit)
5. `db:migration:safety` pass

Evidence output: `reports/db/restore-drill-YYYY-MM.json`

### Step 2 — Generate full evidence report (live staging restore)

> Requires: access to staging PostgreSQL and a scratch database slot.

```bash
pnpm db:restore-drill:execute
# or with custom scratch DB:
npx tsx scripts/db/restore-drill.ts --execute --scratch-db zonga_drill_$(date +%Y%m%d)
# with explicit staging DB/ready endpoint:
npx tsx scripts/db/restore-drill.ts --execute \
  --db-host "$DR_DB_HOST" \
  --db-port "${DR_DB_PORT:-5432}" \
  --db-user "$DR_DB_USER" \
  --db-admin-db "${DR_DB_ADMIN_DB:-postgres}" \
  --scratch-db "zonga_drill_$(date +%Y%m%d)" \
  --ready-url "$DR_READY_URL"
```

This additionally:

1. Creates a scratch database on the staging PostgreSQL instance
2. Applies all migration files sequentially
3. Verifies table count post-restore
4. Records `restoreDurationMs` → reported as RTO
5. Drops the scratch database on completion
6. Optionally validates the ready endpoint if `--ready-url` or `DR_READY_URL` is set

### Step 3 — Generate markdown evidence report

```bash
pnpm dr:drill:report
```

Reads the latest `reports/db/restore-drill-YYYY-MM.json` and produces a
human-readable `reports/dr/restore-drill-YYYY-MM-DD.md`.

### Step 4 — Post-drill verification (live restore only)

After a `--execute` drill, manually verify:

```bash
# Check restored DB table count
psql -h $PGHOST -p $PGPORT -U $PGUSER -d zonga_drill_YYYYMMDD \
  -c "SELECT schemaname, COUNT(*) FROM pg_tables GROUP BY schemaname;"

# Confirm royalty/payout integrity counts on the restored copy
psql -h $PGHOST -p $PGPORT -U $PGUSER -d zonga_drill_YYYYMMDD \
  -c "SELECT COUNT(*) FROM zonga_payout_requests; SELECT COUNT(*) FROM zonga_revenue_events;"

# App health check against staging
curl -s https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/ready | jq .
```

---

## Evidence Captured

| Artifact | Format | Location | Retention |
|---------|--------|---------|----------|
| Structured drill evidence | JSON | `reports/db/restore-drill-YYYY-MM.json` | 7 years |
| Human-readable evidence report | Markdown | `reports/dr/restore-drill-YYYY-MM-DD.md` | 7 years |
| JSON summary artifact | JSON | `reports/dr/restore-drill-YYYY-MM-DD.json` | 7 years |

Artifacts must include:

- `drillId` (unique identifier)
- `timestamp` (ISO 8601)
- `operator` (name or CI actor)
- `overallStatus` (pass/fail)
- `rtoActual` (null if live restore not executed)
- `rpoTarget` and `rpoActual`

---

## Responsible Owners

| Role | Responsibility |
|------|---------------|
| SRE On-Call | Execute drill, capture evidence |
| Platform Engineering | Maintain scripts, update runbooks |
| Zonga Product Owner | Validate royalty/payout ledger integrity post-restore |
| CISO | Review quarterly evidence, sign off annual drill |
| CTO | Sign off annual DR report |

---

## Rollback If Drill Fails

If the `--execute` drill fails mid-restore:

```bash
# Drop scratch database manually
psql -h $PGHOST -p $PGPORT -U $PGUSER -d postgres \
  -c "DROP DATABASE IF EXISTS zonga_drill_$(date +%Y%m%d);"

# Confirm staging primary is unaffected
curl -s https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | jq .
```

The drill operates on a scratch database only. The staging primary and all pilot
creator data are not touched.

---

## References

- [Union Eyes DR Restore Drill Runbook](../../union-eyes/dr/restore-drill-runbook.md) — sibling pattern this runbook mirrors
- Shared script: `scripts/db/restore-drill.ts`
- Shared SRE service tiers: `governance/sre/service-tiers.json`
