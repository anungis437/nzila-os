# Migration Execution Governance

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document governs **how, when, and by whom** migrations are
executed against Union Eyes databases.

---

## 1. Execution Authority

Only the following entrypoints are authorized to execute migrations:

| Entrypoint                                                  | Scope                          | Notes                                  |
|-------------------------------------------------------------|--------------------------------|----------------------------------------|
| Django `manage.py migrate`                                   | Canonical Django entities      | Applied as part of canonical bootstrap |
| `pnpm --filter @nzila/union-eyes db:bootstrap`               | Extensions + scoped Drizzle    | Writes bootstrap attestation           |
| `pnpm --filter @nzila/union-eyes db:restore`                 | Canonical snapshot restore     | Only for non-prod environments         |

The legacy script `pnpm db:migrate:legacy` is preserved for forensics
only and is **not** authorized for use in CI, CD, or production. Its
default behavior is to operate on the frozen lineage; any invocation in
governed contexts is a violation.

---

## 2. Replay Authority

- **Canonical Django:** replay authority is held by Django and follows
  Django's standard rules.
- **Scoped Drizzle:** replay authority is held by `db:bootstrap` and
  applies only to entries in `db/migrations-cache/meta/_journal.json`.
- **Frozen lineage:** **no replay authority**, except via the explicit
  forensic override (`UE_LINEAGE_REPLAY_OVERRIDE=1` +
  `UE_LINEAGE_REPLAY_REASON`), which is logged and attested.

---

## 3. Fresh-Environment Bootstrap Rules

Per [environment-bootstrap-strategy.md](./environment-bootstrap-strategy.md):

| Environment | Canonical zone source                  | Scoped Drizzle source              |
|-------------|----------------------------------------|------------------------------------|
| local       | `manage.py migrate` (dev DB)           | `db:bootstrap`                     |
| dev         | `manage.py migrate` or snapshot        | `db:bootstrap`                     |
| staging     | canonical snapshot                     | `db:bootstrap`                     |
| demo        | canonical snapshot                     | `db:bootstrap`                     |
| pilot       | canonical snapshot                     | `db:bootstrap`                     |
| prod        | controlled `manage.py migrate` only    | `db:bootstrap` (post-migrate)      |

Fresh-environment bootstrap **never** replays the frozen lineage.

---

## 4. Staging Restore Policy

- Staging is restored from a snapshot of the previous staging head
  (or, for full reset, from the most recent canonical staging snapshot).
- Restore is performed by `db:restore` with
  `UE_DB_RESTORE_SNAPSHOT_URL` pointed at the staging snapshot blob.
- After restore, `db:bootstrap` applies extensions and scoped Drizzle
  migrations.
- Bootstrap attestation captures the snapshot digest.

---

## 5. Demo Restore Policy

- Demo is restored from the same canonical snapshot used by staging,
  unless an operator explicitly chooses a different snapshot for a
  given exercise.
- Demo bootstrap **must** capture the snapshot digest in its attestation
  row and in the demo validation report.

---

## 6. Pilot Restore Policy

- Pilot is restored from a snapshot promoted out of staging after
  staging validation.
- Pilot may not consume a demo snapshot.
- Pilot may not be bootstrapped from a frozen lineage replay under any
  circumstances.

---

## 7. Production Migration Policy

- Production is **not** materialized via snapshot restore.
- Production receives Django migrations directly via a controlled
  `manage.py migrate` step in the production deploy pipeline.
- After Django migrate, `db:bootstrap` runs against production to
  apply extensions and scoped Drizzle migrations and to write a
  production bootstrap attestation.
- Production must reject deployments whose bootstrap attestation
  records `legacy_replay_override = true`.

---

## 8. Rollback Legitimacy

- Django migrations roll back via `manage.py migrate <app> <prev_tag>`
  in the controlled deploy pipeline.
- Scoped Drizzle migrations under `db/migrations-cache/` are designed
  for forward-only application; rollbacks are handled by snapshot
  restore (non-prod) or by an explicit reverse migration generated and
  reviewed under standard governance.
- Frozen lineage may not be used as a rollback mechanism.

---

## 9. Migration Attestation Requirements

Every governed migration execution must produce:

- For Django: standard Django migration log entry.
- For scoped Drizzle: a row in `drizzle.bootstrap_attestations` with
  git sha, release id, environment, snapshot digest, scoped migration
  count, override flags.

Both records are operator-verifiable evidence of how a given environment
was materialized.

---

## 10. Prohibitions (Explicit)

The following are explicitly prohibited:

- Replaying frozen lineage in any governed context.
- Dual migration ownership (two ORMs altering the same table).
- Ambiguous migration execution (manual psql DDL outside an attested
  path).
- Partial replay hacks (skipping statements; "tolerating missing"
  modes; environment-conditional skips embedded in migration files).
- Silent migration bypass (deploying schema-affecting code without an
  accompanying attested migration run).

Any of the above appearing in CI logs is a release-blocking incident.
