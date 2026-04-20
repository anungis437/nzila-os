# Database Recovery Runbook

| Field   | Value                |
|---------|----------------------|
| Status  | `DRAFT`              |
| Created | 2026-04-20           |
| Owner   | _TBD_                |

## Overview

Procedures for recovering the Nzila PostgreSQL database (Azure Flexible Server) from corruption, accidental deletion, or catastrophic failure.

## Prerequisites

- [ ] Azure portal access with Contributor role on `nzila-staging-rg`
- [ ] PostgreSQL admin credentials (stored in KeyVault `nzila-staging-kv`)
- [ ] `psql` CLI or Azure Cloud Shell
- [ ] Familiarity with current schema (Drizzle migrations in `migrations/`)

## Recovery Scenarios

### 1. Point-in-Time Restore (PITR)

Use when: accidental data deletion, bad migration, partial corruption.

1. Open Azure Portal → `nzila-staging-db` → **Restore**
2. Select target restore point (up to 35-day retention)
3. Choose new server name (e.g., `nzila-staging-db-restored-YYYYMMDD`)
4. Wait for restore to complete (~10–30 min)
5. Verify data integrity on restored server
6. Swap connection strings in Container Apps env vars
7. Delete old server once confirmed

### 2. Table-Level Recovery

Use when: single table corrupted or dropped; rest of DB is healthy.

1. Perform PITR to a temporary server (see above)
2. Export target table from restored server:
   ```bash
   pg_dump -h <restored-host> -U nzila -d nzila_automation -t <table_name> > table_backup.sql
   ```
3. Import into production:
   ```bash
   psql -h <prod-host> -U nzila -d nzila_automation < table_backup.sql
   ```
4. Verify row counts and referential integrity
5. Clean up temporary server

### 3. Full Restore (Disaster Recovery)

Use when: complete database loss, region failure.

1. Identify latest geo-redundant backup (if configured) or last known-good PITR point
2. Restore to target region
3. Run pending Drizzle migrations if schema drift exists
4. Update all application connection strings
5. Smoke-test all services
6. Update DNS / traffic routing if region changed

## Verification

- [ ] Row counts match expected values
- [ ] Foreign key constraints pass: `SELECT conname FROM pg_constraint WHERE NOT convalidated;`
- [ ] Application health checks pass on all Container Apps
- [ ] Run `pnpm test:platform` to validate ORM layer

## Related Docs

- [Incident Response Runbook](./incident-response.md)
- [Business Continuity Plan](../../business-continuity/README.md)
