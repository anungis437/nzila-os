# Union Eyes — Business Continuity Summary

> **Document type:** Business Continuity Summary  
> **Generated:** {{GENERATED_AT}} · Git SHA {{GIT_SHA}}  
> **Classification:** Buyer-shareable

---

## Recovery Objectives

| Metric | Target | Basis |
|--------|--------|-------|
| **RTO** (Recovery Time Objective) | ≤ 4 hours | Azure PITR + IaC rebuild + container registry |
| **RPO** (Recovery Point Objective) | ≤ 1 hour | Continuous PostgreSQL WAL (architectural target) |
| **MTTR** (Mean Time to Recovery) | ≤ 2 hours | Target average; measured after first live drill |

> Live RTO measurement is scheduled for {{BACKUP_TARGET}}. We will not claim
> a measured RTO until it is tested. Infrastructure analysis puts estimated
> actual RTO at 50–100 minutes.

---

## Backup Infrastructure

| System | Method | Redundancy | Retention |
|--------|--------|-----------|----------|
| PostgreSQL (primary) | Continuous PITR | Zone-HA + geo-redundant | 35 days |
| PostgreSQL (daily full) | pg_dump + encrypted upload | RA-GRS | 90 days |
| Document / evidence storage | Blob RA-GRS | Real-time geo-replication | 7 years |
| Application config | IaC (Git) | Version-controlled | Permanent |
| Container images | Azure Container Registry | Retained | 90 days |
| Redis session cache | RDB snapshot | LRS | 7 days |

---

## DR Runbooks Published

All five runbooks are version-controlled and publicly verifiable:

| Runbook | Location |
|---------|---------|
| Restore Drill | `docs/union-eyes/dr/restore-drill-runbook.md` |
| Database Restore | `docs/union-eyes/dr/database-restore.md` |
| Blob Recovery | `docs/union-eyes/dr/blob-recovery.md` |
| Rollback Procedure | `docs/union-eyes/dr/rollback-procedure.md` |
| Continuity Matrix | `docs/union-eyes/dr/continuity-matrix.md` |

---

## Drills & Evidence

| Drill | Date | Mode | Result |
|-------|------|------|--------|
| Evidence audit (infrastructure + procedure) | {{DRILL_DATE}} | Dry-run | Infrastructure confirmed; runbooks live |
| Live staging restore (measured RTO) | {{NEXT_DRILL_DATE}} | Full restore | Scheduled |

Evidence artifacts: `reports/dr/restore-drill-{{DRILL_DATE}}.json`  
Available under NDA for procurement review.

---

## Continuity Controls

| Control | Status |
|---------|--------|
| Continuous DB backup (PITR) | ✅ Implemented — IaC confirmed |
| Geo-redundant storage (RA-GRS) | ✅ Implemented |
| IaC for environment rebuild | ✅ `infrastructure/bicep/` |
| DR runbooks | ✅ 5 runbooks published |
| Reproducible drill procedure | ✅ `pnpm db:restore-drill` |
| Quarterly drill cadence | ✅ Automated |
| Credential rotation procedure | ✅ `docs/union-eyes/dr/continuity-matrix.md` |
| Live RTO measurement | ⏳ {{BACKUP_TARGET}} |

---

## Incident Response

Incident response plan: `docs/ops/incident-response.md`  
On-call runbook: `docs/ops/on-call.md`  
Escalation path: Platform Engineering → SRE → CTO

---

_Generated from source-of-truth on {{GENERATED_AT}} · Git SHA {{GIT_SHA}}_
