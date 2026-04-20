# Nzila OS — Disaster Recovery Plan

> **Version:** 1.0  
> **Last Updated:** 2026-03-04  
> **Owner:** Platform Engineering  
> **Classification:** Internal

---

## 1. Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime before full service restoration |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss window |
| **MTTR** (Mean Time to Recovery) | 2 hours | Target average recovery time |

---

## 2. Snapshot Strategy

### 2.1 Database Snapshots

| Component | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| PostgreSQL (primary) | Every 1 hour | 30 days | Automated point-in-time recovery (PITR) |
| PostgreSQL (daily full) | Every 24 hours | 90 days | pg_dump + encrypted upload |
| Redis cache | Every 6 hours | 7 days | RDB snapshot |

### 2.2 Application State Snapshots

| Component | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| Evidence packs | On generation | 7 years | Signed ZIP to blob storage |
| Compliance snapshots | Daily | 3 years | Hash-chained JSON |
| SBOM | On every release | 1 year | CycloneDX JSON artifact |
| Build attestation | On every build | 1 year | Ed25519 signed JSON |
| Configuration | On change | 90 days | Git-versioned + encrypted backup |

### 2.3 Infrastructure Snapshots

| Component | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| Container images | On deploy | 90 days | Container registry |
| Infrastructure-as-Code | Continuous | Indefinite | Git repository |
| DNS configuration | On change | 90 days | Exported zone files |
| Secret store | On change | 90 days | Key Vault versioning |

---

## 3. Backup Verification

### 3.1 Automated Verification

Backup integrity is verified via `pnpm verify:backup`, which checks:

1. **Lockfile integrity** — `pnpm-lock.yaml` hash consistency
2. **Evidence system** — Evidence pack generation + verification
3. **Build attestation** — Attestation file exists and is signed
4. **SBOM presence** — CycloneDX SBOM exists
5. **Configuration** — Critical config files present

### 3.2 Manual Verification Schedule

| Check | Frequency | Owner |
|-------|-----------|-------|
| Database restore test | Monthly | DBA / Platform team |
| Full DR simulation | Quarterly | Engineering + Ops |
| Evidence pack restore | Monthly | Compliance team |
| Container re-build from source | Monthly | Platform team |

---

## 4. Recovery Procedures

### 4.1 Database Recovery

1. Identify failure point and data loss window
2. Select most recent snapshot within RPO
3. Restore to staging environment first
4. Validate data integrity with checksums
5. Promote to production
6. Verify application connectivity

### 4.2 Application Recovery

1. Pull last known-good container image from registry
2. Deploy via infrastructure-as-code (revert to last good commit)
3. Verify all health checks pass: `HealthChecker.run()`
4. Re-generate evidence pack to confirm system integrity
5. Run platform health report: `pnpm health:report`

### 4.3 Full Environment Recovery

1. Provision infrastructure from IaC templates
2. Restore database from most recent snapshot
3. Deploy application containers
4. Restore configuration from Key Vault
5. Verify all integrations operational
6. Run full verification suite:
   - `pnpm verify:env`
   - `pnpm verify:security`
   - `pnpm validate:pack`
   - `pnpm health:report`

---

## 5. Communication During DR

| Audience | Channel | Frequency |
|----------|---------|-----------|
| Engineering team | War-room channel | Real-time |
| Leadership | Email + Slack | Every 30 minutes |
| Affected organisations | Status page + email | Every 1 hour |
| Compliance / Legal | Email | As needed |

---

## 6. DR Testing Schedule

| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| Tabletop exercise | Quarterly | Review procedures, identify gaps |
| Partial failover | Semi-annually | Fail over non-critical services |
| Full DR simulation | Annually | Complete environment recovery |
| Backup restore test | Monthly | Verify backup integrity |

---

## 7. Related Documents

- [Incident Response Plan](incident-response.md)
- [Enterprise Readiness Index](../governance/enterprise-readiness.md)
- [Business Continuity](../../ops/business-continuity/)
- [SLO Policy](../../ops/slo-policy.yml)
- [On-Call Runbooks](../../ops/runbooks/)
