# Environment Bootstrap Strategy

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document defines, per environment, the legitimate path to
materialize a Union Eyes database from scratch.

---

## 1. Per-Environment Bootstrap Matrix

| Environment | Canonical zone source                | Snapshot required? | Scoped Drizzle source | Replay frozen lineage? |
|-------------|--------------------------------------|--------------------|-----------------------|------------------------|
| local       | Django `manage.py migrate` on dev DB | optional           | `db:bootstrap`        | **no**                 |
| dev         | Django `manage.py migrate` or snapshot| optional          | `db:bootstrap`        | **no**                 |
| staging     | canonical staging snapshot           | **yes**            | `db:bootstrap`        | **no**                 |
| demo        | canonical staging snapshot           | **yes**            | `db:bootstrap`        | **no**                 |
| pilot       | snapshot promoted from staging       | **yes**            | `db:bootstrap`        | **no**                 |
| production  | controlled Django `migrate`          | **no** (Django)    | `db:bootstrap` (post) | **no**                 |

---

## 2. Snapshot Sources

| Environment | Snapshot source                                              |
|-------------|--------------------------------------------------------------|
| staging     | latest `staging-canonical-*.dump` in `nzila-staging-snapshots`|
| demo        | latest staging snapshot used by current release tag           |
| pilot       | snapshot promoted out of staging at pilot cut date            |
| production  | none (snapshot restore not authorized for production)         |

The exact storage account / container / blob reference is operator-
configured via `UE_DB_RESTORE_SNAPSHOT_URL` and recorded in each
environment's validation report.

---

## 3. Legitimacy Validation

Every fresh-environment bootstrap must satisfy all of the following
before that environment is declared validated:

1. `db:validate` passes (see
   [migration-legitimacy-validation-system.md](./migration-legitimacy-validation-system.md)).
2. `db:bootstrap` exits 0.
3. A row is present in `drizzle.bootstrap_attestations` with
   `legacy_replay_override = false`.
4. For demo/pilot/staging: the row's `snapshot_digest` is non-null and
   matches the snapshot recorded in the environment's validation report.
5. The runtime `/api/health` endpoint returns 200 and the application
   reports `environment` matching the target.

---

## 4. Replay Boundaries

- The bootstrap orchestrator **never** reads `db/migrations/` (frozen
  lineage) by default.
- The forensic override (`UE_LINEAGE_REPLAY_OVERRIDE=1`) is permitted
  only on operator workstations during incident triage and must never
  appear in CI/CD pipelines or production runbooks.

---

## 5. Environment Attestation Implications

The bootstrap attestation row is the canonical evidence that an
environment was materialized along a legitimate path. Per-environment
validation reports must reference the attestation row id (or its
content hash) so that a future audit can reconstruct the bootstrap
identity exactly.

---

## 6. Pilot & Production Sequencing

Per the operator mandate sequencing
(`demo → pilot → production`):

- A pilot bootstrap may not begin until the demo environment has
  produced a passing validation report against this strategy.
- A production migration may not begin until the pilot environment has
  produced a passing validation report against this strategy.
- These gates are operator-enforced today and become contract-tested
  in a future phase (see
  [migration-legitimacy-validation-system.md](./migration-legitimacy-validation-system.md)).
