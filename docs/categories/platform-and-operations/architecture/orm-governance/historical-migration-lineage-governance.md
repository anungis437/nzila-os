# Historical Migration Lineage Governance

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document governs the **pre-reconciliation Drizzle migration
lineage** at `apps/union-eyes/db/migrations/`.

---

## 1. Classification

The migrations in `apps/union-eyes/db/migrations/` are formally
classified as:

> **historical lineage** — preserved for audit, traceability, and
> archaeology, but not part of the canonical Drizzle authority going
> forward.

They are **not** classified as:

- active canonical replay infrastructure
- a source-of-truth schema definition
- a future-safe bootstrap path
- a compatible base for new Drizzle migrations

---

## 2. Freeze Date

**2026-05-09.**

The freeze is recorded by:

- `apps/union-eyes/db/migrations/.lineage-frozen` (sentinel file)
- `apps/union-eyes/db/migrations/LINEAGE-FROZEN.md` (operator-facing
  freeze notice)

The bootstrap orchestrator
(`tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`) reads the
sentinel and refuses to replay the lineage on fresh databases.

---

## 3. Frozen Range

All entries currently in `apps/union-eyes/db/migrations/meta/_journal.json`,
and all SQL files in `apps/union-eyes/db/migrations/*.sql`, including all
`*_fixup_*.sql` and `*_phase*` migrations.

This is the entire lineage from `0000_flippant_luke_cage` through the
most recent `20260715_integration_fabric` (and any equivalent fixups).

---

## 4. Replay Prohibitions

The following are explicitly prohibited:

- Replaying any frozen migration against a fresh database.
- Generating new migration files into `db/migrations/` via
  `drizzle-kit generate`.
- Editing the on-disk SQL of any frozen migration.
- Adding new entries to `db/migrations/meta/_journal.json`.
- Treating the frozen lineage as the source of truth for any current
  schema reasoning.

---

## 5. Lineage Immutability Rule

Files under `db/migrations/` are **append-only by history, not by
content**. Once frozen:

- The on-disk content of a frozen `.sql` file must not change.
- The on-disk content of `meta/_journal.json` must not change.

If a frozen migration is found to contain a sensitive value (secret,
PII), the remediation path is:

1. Open a security incident.
2. Rewrite git history under coordinated review.
3. Update this document with the rewrite reference.

Routine "fix-ups" of frozen migrations are not permitted.

---

## 6. Replay Refusal Contract

`run-union-eyes-drizzle-bootstrap.mjs` enforces:

- If `db/migrations/.lineage-frozen` is missing, bootstrap fails.
- If `UE_LINEAGE_REPLAY_OVERRIDE` is unset, the script never reads
  `db/migrations/`.
- If `UE_LINEAGE_REPLAY_OVERRIDE=1` is set without a non-trivial
  `UE_LINEAGE_REPLAY_REASON`, the script fails.
- When the override is set, it is logged and recorded in the
  bootstrap attestation row.
- Production environments must reject any deployment whose attestation
  records `legacy_replay_override = true`.

---

## 7. Restoration Guidance

To bring a fresh database to a usable state, do **not** replay the
frozen lineage. Instead:

1. Run `pnpm --filter @nzila/union-eyes db:bootstrap`.
2. Provide `UE_DB_RESTORE_SNAPSHOT_URL` to restore the canonical
   operational schema (Django-owned).
3. Allow scoped Drizzle migrations under `db/migrations-cache/` to
   apply.

See [environment-bootstrap-strategy.md](./environment-bootstrap-strategy.md)
for the per-environment matrix.

---

## 8. Legacy Compatibility Boundaries

Auxiliary tooling that **reads** the frozen lineage (drift checkers,
DR tooling, audit scripts under `scripts/db/*` and `scripts/dr/*`) is
permitted to continue reading. Those tools must not be repurposed to
replay or evolve the lineage.

The list of known consumers as of the freeze date:

- `scripts/db/doctor.ts`
- `scripts/db/drift-check.ts`
- `scripts/db/migration-safety.ts`
- `scripts/db/restore-drill.ts`
- `scripts/dr/drill-checklist.ts`
- `scripts/dr/drill-plan.ts`
- `scripts/release/rollback-prod.ts`
- `scripts/gen-fixup-migration.mjs`

A future cleanup will re-point these consumers at the scoped root
where appropriate, or at canonical Django snapshots where the historical
schema is no longer authoritative.

---

## 9. Migration Archaeology Policy

The frozen lineage is a permitted research surface for:

- Reconstructing how a column or constraint came to exist.
- Understanding regulatory/compliance history.
- Producing audit reports for past releases.

The lineage is not a permitted basis for:

- Designing new schemas.
- Choosing column types for new entities.
- Deciding what tables exist today (use Django models + scoped Drizzle
  schema instead).
