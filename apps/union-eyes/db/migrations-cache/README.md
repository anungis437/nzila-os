# Scoped Drizzle migrations — UnionEyes (cache / runtime support)

This directory is the **active** Drizzle migration root for UnionEyes.

It is intentionally **empty at the time of reconciliation** because the
historical Drizzle migrations under `../migrations/` have been formally
classified as **frozen historical lineage** and are not part of the
canonical scoped Drizzle authority going forward.

## What belongs here

Only migrations generated from the scoped barrel
`apps/union-eyes/db/schema-cache/cache.ts`. Per
[`docs/architecture/orm-governance/drizzle-scope-reconstruction.md`](../../../../docs/architecture/orm-governance/drizzle-scope-reconstruction.md),
that means:

- cache tables (`ue_cache.*` and similar non-authoritative projections)
- governance runtime tables
- continuity observability tables
- attestation/evidence support tables
- operational read-model projections

## What does NOT belong here

- Canonical business entities (Django-owned).
- Anything that already exists in `../migrations/` (the frozen lineage).
- Schema additions that have not been recorded in
  [`docs/architecture/orm-governance/canonical-schema-topology.md`](../../../../docs/architecture/orm-governance/canonical-schema-topology.md).

## How migrations are created

```
pnpm --filter @nzila/union-eyes db:generate   # drizzle-kit generate (scoped)
pnpm --filter @nzila/union-eyes db:bootstrap  # extensions + scoped migrate + restore pathway
```

`db:bootstrap` is the only legitimate entrypoint to materialize a Union
Eyes database from scratch. It refuses to replay the frozen lineage. See
[`docs/architecture/orm-governance/migration-execution-governance.md`](../../../../docs/architecture/orm-governance/migration-execution-governance.md).
