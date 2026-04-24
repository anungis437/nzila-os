# Union Eyes — Restore Readiness Summary

> **Classification:** Public (buyer-safe)  
> **Last Updated:** 2026-04-24  
> **Maintained by:** Platform Engineering / SRE

---

## Overview

This document summarises Union Eyes disaster recovery and restore readiness for
procurement reviewers, IT governance committees, and insurance / business
continuity assessors. It is derived from our internal evidence package
(`reports/dr/restore-drill-2026-04-24.md`) with sensitive infrastructure
details removed.

---

## Recovery Objectives

| Objective | Target | Basis |
|-----------|--------|-------|
| **RTO** (Recovery Time Objective) | ≤ 4 hours | Documented in DR plan; IaC-backed infrastructure |
| **RPO** (Recovery Point Objective) | ≤ 1 hour | Azure PostgreSQL continuous WAL replication |

---

## Backup Infrastructure

| System | Backup Method | Redundancy | Retention |
|--------|--------------|-----------|----------|
| Primary database (PostgreSQL) | Continuous point-in-time recovery (PITR) | Zone-redundant HA + geo-redundant backup | 35 days |
| Document and evidence storage | Geo-redundant object storage (RA-GRS) | Real-time geo-replication | 7 years (evidence packs) |
| Application configuration | Infrastructure-as-Code (Git) | Version-controlled, permanent | Permanent |
| Container images | Container registry | Retained 90 days | 90 days |

---

## Drills Performed

| Drill | Date | Mode | Outcome |
|-------|------|------|---------|
| Evidence audit (procedure + infrastructure verification) | 2026-04-24 | Dry-run | Infrastructure controls confirmed; runbooks published |
| Live staging restore (RTO measurement) | Scheduled 2026-Q2 | Full restore | **Pending execution** |

---

## Achieved Recovery Objectives

| Control | Status |
|---------|--------|
| Backup infrastructure in place | ✅ Confirmed via Infrastructure-as-Code |
| DR runbooks published and versioned | ✅ Five runbooks in `docs/union-eyes/dr/` |
| Reproducible drill script operational | ✅ `pnpm db:restore-drill` |
| Quarterly drill cadence established | ✅ Automated reminder workflow |
| Live RTO measurement | ⏳ Scheduled 2026-Q2 |
| Formal RTO publication | ⏳ Pending live measurement |

---

## Continuous Improvement Actions

| Action | Target | Status |
|--------|--------|--------|
| Execute first live staging restore drill | 2026-Q2 | Scheduled |
| Publish measured RTO after live drill | 2026-Q2 | Pending |
| Blob backup manifest automation | 2026-Q2 | Planned |
| Annual full DR sign-off (CISO + CTO) | 2026-Q4 | Planned |

---

## Transparency Statement

We publish our maturity gaps and target closure dates in our internal maturity
manifest. The following is the current status of the backup/restore gap:

> *Previous state (2026-04-23):* "Nightly backups exist, but restore drill
> evidence and RTO verification are not published in a reproducible report."
> Severity: critical.
>
> *Current state (2026-04-24):* Backup infrastructure confirmed via
> Infrastructure-as-Code. DR runbooks and reproducible drill procedure
> published. First live staging execution with RTO measurement scheduled
> for 2026-Q2. Severity: downgraded to medium.

We will not claim an RTO we have not measured. The infrastructure supports a
live staging restore in an estimated 50–100 minutes (well within the 4-hour
target), and we will publish the measured result after the 2026-Q2 drill.

---

## Questions for Procurement / IT Review

If your security questionnaire or procurement process requires additional
information, please request:

1. `reports/dr/restore-drill-2026-04-24.md` — Full internal evidence report
2. `reports/dr/restore-drill-2026-04-24.json` — Structured evidence artifact
3. `docs/union-eyes/dr/` — Full runbook set
4. `apps/union-eyes/maturity.json` — Live maturity status with gap targets

We share these documents directly under NDA for enterprise reviews.
