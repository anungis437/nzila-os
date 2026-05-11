# LINEAGE FROZEN — Historical Union Eyes Drizzle Migrations

**Status:** **FROZEN — read-only historical lineage**
**Effective:** 2026-05-09
**Authority:** [docs/architecture/orm-governance/historical-migration-lineage-governance.md](../../../../docs/architecture/orm-governance/historical-migration-lineage-governance.md)

## What this means

The migrations in this directory (`apps/union-eyes/db/migrations/`)
represent the **pre-reconciliation Drizzle lineage**, generated when
Drizzle was treated as the broad-schema ORM for Union Eyes. They are
preserved here as **archaeological lineage** for audit, traceability,
and historical reproducibility.

They are **not** part of the canonical Drizzle authority going forward.
The canonical Drizzle authority lives at:

- `apps/union-eyes/drizzle.config.ts` (scope: cache only)
- `apps/union-eyes/db/schema-cache/cache.ts` (scoped barrel)
- `apps/union-eyes/db/migrations-cache/` (active migration root)

## What is prohibited

- Replaying any of these migrations against a fresh database.
- Generating new files into this directory with `drizzle-kit generate`.
- Editing the on-disk SQL of these files (immutability rule).
- Adding new entries to `meta/_journal.json` for active replay.
- Treating these files as a source-of-truth schema definition.

## What is permitted

- Read access for audit, archaeology, and historical reasoning.
- Restore-from-snapshot tooling reading the journal as a *baseline
  reference* without re-executing SQL.
- One-off forensics scripts that consume but never replay.

## How fresh databases are bootstrapped now

Per [`docs/architecture/orm-governance/environment-bootstrap-strategy.md`](../../../../docs/architecture/orm-governance/environment-bootstrap-strategy.md)
and [`docs/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md`](../../../../docs/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md):

1. Run `pnpm --filter @nzila/union-eyes db:bootstrap`.
2. Bootstrap installs DB extensions, applies the scoped Drizzle
   migrations from `db/migrations-cache/`, and (when configured) restores
   a canonical snapshot for the operational/Django-owned schema.
3. Bootstrap **refuses** to replay this frozen lineage.

## Replay refusal contract

The script `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` checks
for the sentinel file `.lineage-frozen` in this directory. If the file
exists, replay is refused with a non-zero exit and a pointer to this
document.

To override (forensic-only, never in CI/CD/production), an operator
must explicitly set:

```
UE_LINEAGE_REPLAY_OVERRIDE=1
UE_LINEAGE_REPLAY_REASON="<short audit reason>"
```

Both must be present. The override is logged.
