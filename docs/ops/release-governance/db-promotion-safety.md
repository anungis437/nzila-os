# Database Promotion Safety — Runbook

> Ensuring schema changes never cause production outages.

## DB Safety Gate Pipeline

Every deployment runs 3 checks in order:

```
db:doctor → db:migration:safety → db:drift:check
```

## Commands

| Command | Purpose | Exit Codes |
|---------|---------|------------|
| `pnpm db:doctor` | Health check (ordering, extensions, rollback scripts) | 0=pass, 1=critical, 2=warnings |
| `pnpm db:doctor --strict` | Same, but warnings become failures | 0=pass, 1=fail |
| `pnpm db:migration:safety` | Destructive DDL scan | 0=safe, 1=blocking, 2=review |
| `pnpm db:migration:safety --since v1.0.0` | Only check since tag | Same |
| `pnpm db:migration:safety --file path.sql` | Single file | Same |
| `pnpm db:drift:check` | Schema drift between journal and files | 0=clean, 1=critical, 2=minor |
| `pnpm db:drift:check --env staging` | With environment context | Same |

## What Each Check Does

### db:doctor

1. **Migration ordering** — detects gaps and duplicates in numbered prefixes
2. **Destructive DDL** — flags DROP TABLE, TRUNCATE, ALTER TYPE
3. **Required extensions** — verifies uuid-ossp, pgcrypto referenced
4. **Rollback scripts** — checks rollback/ directory exists with content
5. **Journal consistency** — Drizzle journal matches SQL file count
6. **Credential scan** — no passwords/connection strings in SQL

### db:migration:safety

10 rules with severity levels:

| Rule | Severity | Pattern |
|------|----------|---------|
| DROP_TABLE | block | `DROP TABLE` without `IF EXISTS` |
| DROP_TABLE_EXISTS | review | `DROP TABLE IF EXISTS` |
| DROP_COLUMN | block | Any `DROP COLUMN` |
| TRUNCATE | block | Any `TRUNCATE` |
| DROP_INDEX | review | `DROP INDEX` |
| ALTER_TYPE | review | `ALTER TYPE` |
| NOT_NULL_NO_DEFAULT | review | `ADD ... NOT NULL` without `DEFAULT` |
| RENAME_TABLE | review | Table renames |
| RENAME_COLUMN | review | Column renames |
| LOCK_TABLE | block | Explicit `LOCK TABLE` |

Additional checks:

- **NO_TRANSACTION** — destructive ops without BEGIN/COMMIT
- **INDEX_NOT_CONCURRENT** — CREATE INDEX without CONCURRENTLY

### db:drift:check

1. Journal entry count vs SQL file count
2. Journal tag ↔ filename consistency
3. Snapshot freshness (latest snapshot matches latest journal)
4. Environment version comparison (from evidence ledger)
5. Platform migrations audit

## Safe Migration Patterns

### Adding a column

```sql
ALTER TABLE my_table ADD COLUMN new_col TEXT DEFAULT '';
-- Always include DEFAULT for NOT NULL columns
```

### Creating an index (zero-downtime)

```sql
CREATE INDEX CONCURRENTLY idx_my_table_col ON my_table (col);
-- CONCURRENTLY avoids exclusive lock
```

### Removing a column (two-phase)

```sql
-- Phase 1: Deploy code that doesn't read the column
-- Phase 2 (next release): DROP COLUMN
ALTER TABLE my_table DROP COLUMN old_col;
```

### Rollback script pattern

```sql
-- File: rollback/0022_undo_add_notifications.sql
BEGIN;
DROP TABLE IF EXISTS notifications;
COMMIT;
```

## CI Integration

The `deploy-production.yml` workflow runs DB gates as a pre-deploy step:

```yaml
- name: DB Safety Gate
  run: |
    pnpm db:doctor --strict
    pnpm db:migration:safety --since ${{ github.event.inputs.previous_tag }}
    pnpm db:drift:check --env staging
```

If any check exits non-zero, deployment is halted.
