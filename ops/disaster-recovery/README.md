# Disaster Recovery

**Owner:** Platform Engineering  
**Review Cadence:** Quarterly (test), Annually (plan review)  
**Controls Covered:** DR-01, DR-02, DR-03, DR-04

## Purpose

Define disaster recovery procedures for Nzila OS infrastructure, ensuring the platform
can be restored within RTO (≤ 4 hours) and RPO (≤ 1 hour) targets.

## Recovery Targets

| Metric | Target | Measured By |
|---|---|---|
| RTO (Recovery Time Objective) | ≤ 4 hours | Time from disaster declaration to service restoration |
| RPO (Recovery Point Objective) | ≤ 1 hour | Maximum acceptable data loss window |

## Backup Strategy

| Component | Backup Method | Frequency | Retention |
|---|---|---|---|
| PostgreSQL database | Azure automated backup + PITR | Continuous (WAL) | 35 days |
| Azure Blob Storage | RA-GRS (geo-redundant) | Real-time replication | Per retention class |
| Application config | Git (Infrastructure as Code) | Per commit | Permanent |
| Clerk auth config | Clerk platform (managed) | Platform-managed | N/A |

## DR Test Procedure

See `Control-Test-Plan.md` → CT-01 for the full quarterly restore test procedure.

### Quick Reference

1. Restore latest DB backup to staging
2. Verify row counts on key tables
3. Run hash chain verification on `share_ledger_entries` + `audit_events`
4. Measure actual RTO and RPO
5. Generate and store evidence

## Evidence to Capture

| Artifact | Format | Control | Storage Path | Retention |
|---|---|---|---|---|
| DR restore test report | JSON/PDF | DR-01, DR-02 | `evidence/{entity_id}/dr-bcp/{YYYY}/Q{N}/restore-test-report/DR-Q{N}-{YYYY}/` | 7_YEARS |
| Hash chain verification (share ledger) | JSON | DR-01 | Same path | 7_YEARS |
| Hash chain verification (audit events) | JSON | DR-01 | Same path | 7_YEARS |
| Blob geo-redundancy config export | JSON | DR-04 | `evidence/{entity_id}/dr-bcp/{YYYY}/blob-redundancy-config/` | 3_YEARS |
| Evidence pack index | JSON | All DR | Same path as test report | 7_YEARS |

### Required Metadata Fields

- `entity_id`, `artifact_id` (e.g., `DR-Q1-2026`), `sha256`, `created_by`, `retention_class = '7_YEARS'`

### Hashing Expectation

All DR evidence uploaded via `@nzila/blob` → SHA-256 auto-computed → stored in `documents.sha256` → `audit_event` logged with `action = 'dr_evidence_uploaded'`.

## References

- [Required Evidence Map](../compliance/Required-Evidence-Map.md) — DR-01 through DR-04
- [Control Test Plan](../compliance/Control-Test-Plan.md) — CT-01
- [Business Continuity](../business-continuity/README.md)
