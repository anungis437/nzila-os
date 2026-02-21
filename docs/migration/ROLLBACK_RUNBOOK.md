# Database Migration Rollback Runbook

**Maintainer:** @nzila/platform  
**Last Updated:** 2026-02-20  
**CODEOWNERS:** `/packages/db/**` → `@nzila/platform`

---

## Overview

All database migrations are managed with **Drizzle Kit** against a **PostgreSQL** database.

Migration files live in `packages/db/drizzle/` and are tracked in `packages/db/drizzle/meta/_journal.json`.

> ⚠️ **AUDIT TABLE WARNING:** `audit_events` rows are protected by immutability triggers (migration `0004_audit_events_immutable`). You cannot `UPDATE` or `DELETE` audit rows. Rollback of the trigger requires manually dropping the triggers before reverting the migration.

---

## Pre-Rollback Checklist

- [ ] Take a full database snapshot (`pg_dump`) before executing any rollback
- [ ] Open an incident in `ops/incident-response/` if rollback is triggered by a production incident
- [ ] Notify on-call via `ops/oncall/` runbook
- [ ] Confirm the rollback target migration with @nzila/platform
- [ ] Verify feature flags disable any code paths that depend on the schema being rolled back

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Primary PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | Direct connection (bypasses PgBouncer) — required for DDL |

Always use `DIRECT_DATABASE_URL` when running DDL migrations/rollbacks.

---

## Migration Inventory

| Idx | Tag | Description | Reversible? |
|-----|-----|-------------|-------------|
| 0 | `0000_initial` | Initial schema: entities, members, audit_events | ⚠️ Destructive if rolled back |
| 1 | `0001_solid_cargill` | Schema extension | ✅ Review SQL before reverting |
| 2 | `0002_rich_marten_broadcloak` | Schema extension | ✅ Review SQL before reverting |
| 3 | `0003_redundant_starfox` | Schema extension | ✅ Review SQL before reverting |
| 4 | `0004_audit_events_immutable` | Audit immutability triggers (no schema change) | ⚠️ See special procedure below |

---

## Standard Rollback Procedure

Drizzle Kit does not yet provide a native `migrate:down` command. Rollback is performed by:

### Step 1 — Identify the target migration

```bash
# List applied migrations
psql "$DIRECT_DATABASE_URL" -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;"
```

### Step 2 — Back up the database

```bash
pg_dump "$DIRECT_DATABASE_URL" \
  --file "backup-$(date +%Y%m%d-%H%M%S).sql" \
  --no-owner \
  --no-privileges
```

### Step 3 — Write and apply the reverse migration

Create a new migration file (do NOT modify the journal retroactively):

```bash
# Create reverse migration
cat > packages/db/drizzle/0005_rollback_<description>.sql << 'SQL'
-- Reverse migration for <original migration tag>
-- Written by: <engineer>
-- Date: <date>
-- Reason: <brief description>

-- ... reverse DDL here ...
SQL
```

Then apply via Drizzle Kit:

```bash
DATABASE_URL="$DIRECT_DATABASE_URL" pnpm --filter @nzila/db migrate:apply
```

### Step 4 — Verify

```bash
# Check applied migrations
psql "$DIRECT_DATABASE_URL" -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"

# Run integration tests against the rolled-back schema
pnpm contract-tests
```

### Step 5 — Update `_journal.json`

Add the rollback migration entry to `packages/db/drizzle/meta/_journal.json` so Drizzle Kit's state is consistent.

---

## Special Procedure: Rolling Back `0004_audit_events_immutable`

Migration `0004` installs PostgreSQL triggers that prevent `UPDATE`/`DELETE` on `audit_events`. Because these are triggers (not schema changes), the rollback is:

```sql
-- Drop the immutability triggers first
DROP TRIGGER IF EXISTS audit_events_no_update ON "audit_events";
DROP TRIGGER IF EXISTS audit_events_no_delete ON "audit_events";
DROP FUNCTION IF EXISTS prevent_audit_mutation();
```

**Before doing this:**  
1. Log a security incident — removing audit immutability is a **auditable security event**
2. Get approval from CTO and @nzila/security
3. Record in `ops/change-management/` with justification

---

## Emergency: Point-in-Time Recovery (PITR)

If a migration causes data corruption, use Azure Database for PostgreSQL PITR:

1. Open Azure Portal → PostgreSQL flexible server
2. **Restore** → select point-in-time before the problematic migration
3. Restore to a new server instance (do NOT overwrite production)
4. Verify data integrity on the restored instance
5. Execute planned cutover with application downtime window
6. Document in `ops/disaster-recovery/` playbook

---

## Contacts

| Role | Team |
|------|------|
| Database schema changes | @nzila/platform |
| Security-impacting rollbacks | @nzila/security |
| Production incidents | See `ops/oncall/` runbook |

---

## References

- Drizzle ORM migration docs: <https://orm.drizzle.team/docs/migrations>
- CODEOWNERS: `/packages/db/drizzle/**` → `@nzila/platform`
- Audit immutability migration: `packages/db/drizzle/0004_audit_events_immutable.sql`
