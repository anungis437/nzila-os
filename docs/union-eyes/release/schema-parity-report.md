# Union Eyes — Phase A · Schema Parity Report

**Date:** 2026-05-09
**Database probed:** `nzila-staging-db.postgres.database.azure.com / nzila_os_staging`
**Probe method:** read-only `pg` client, credentials from `nzila-staging-kv/DB-PASSWORD`.
**Verdict:** **PARITY UNVERIFIED** — schema appears materially complete (754 public tables) but the Drizzle migration ledger is dramatically behind the repo (4 entries vs 93 SQL files). Until the discrepancy is reconciled, schema integrity is not provable.

---

## 1. Counts

| Metric                                                    | Value                              |
| --------------------------------------------------------- | ---------------------------------- |
| Migration SQL files in repo (`apps/union-eyes/db/migrations/*.sql`) | **93**                              |
| Rows in `drizzle.__drizzle_migrations` (live DB)           | **4**                              |
| Latest applied migration timestamp (live DB)               | **2026-02-20T22:27:36.982Z**       |
| Public-schema tables present in live DB                    | **754**                            |
| Organizations                                              | 14                                 |
| Claims                                                     | 15                                 |
| CLC demo org (`a1b2c3d4-0001…clcdemo000001`)               | **0** rows — never seeded          |

---

## 2. Required-table presence probe

| Table                  | `to_regclass` | Comment                                          |
| ---------------------- | :-----------: | ------------------------------------------------ |
| `users`                | ✅            |                                                  |
| `organizations`        | ✅            | 14 rows                                          |
| `claims`               | ✅            | 15 rows                                          |
| `organization_members` | ✅            | 0 rows under CLC demo namespace                  |
| `pilot_enrollments`    | ✅            | Pilot tables exist; pilot org not seeded         |
| `audit_log`            | ✅            |                                                  |
| `user_sessions`        | ✅            |                                                  |
| `feature_flags`        | ✅            |                                                  |

All Phase A required tables exist. The schema is **functionally** at-or-near-current.

---

## 3. The 4-vs-93 ledger discrepancy

Three plausible causes:

1. **Re-baseline.** At some point the team consolidated all prior Drizzle migrations into a single baseline SQL or wiped `__drizzle_migrations` and re-stamped a small number of head entries. The 754 tables suggest the schema was applied via `drizzle-kit push` or via raw SQL outside the journal.
2. **Out-of-band SQL.** Some migrations were applied directly via `psql` against the DB, without recording in `__drizzle_migrations`.
3. **Untracked drift.** New `apps/union-eyes/db/migrations/*.sql` files have been added in `feat/trustcore-trust-ops-v1` but never run against `nzila_os_staging`.

Until the team picks one cause and writes it down, **Phase A cannot certify schema parity**.

---

## 4. Required reconciliation steps

1. Decide an authoritative source of truth:
   - **Option A:** `__drizzle_migrations` is canonical → re-baseline migrations in the repo so its head matches the DB ledger; commit a `0000_baseline.sql` and remove the unrelated 89 files (or move them to a `legacy/` archive with a README).
   - **Option B:** the repo migration directory is canonical → run `pnpm --filter @nzila/union-eyes db:migrate` against `nzila_os_staging` (after taking a backup) and confirm the ledger advances to head; if it doesn't, write a one-time SQL script to insert missing rows into `__drizzle_migrations`.
2. Add a CI assertion: a step that runs `db:migrate --dry-run` (or equivalent) against staging and **fails** if it reports any pending migration.
3. Document the chosen strategy in [`apps/union-eyes/db/migrations/README.md`](../../../apps/union-eyes/db/migrations/README.md).

---

## 5. Per-environment migration readiness (post-Phase-A IaC)

| Env     | DB                  | Migrations applied | Action required before traffic                       |
| ------- | ------------------- | -----------------: | ---------------------------------------------------- |
| staging | `nzila_os_staging`  | 4 (drift unresolved) | Reconcile per §4.                                    |
| demo    | `nzila_os_demo`     | 0 (DB does not exist yet) | Provision (Bicep), then `db:migrate` from head.      |
| pilot   | `nzila_os_pilot`    | 0 (DB does not exist yet) | Provision (Bicep), then `db:migrate` from head.      |
| prod    | `nzila_os_prod`     | 0 (DB does not exist yet) | Provision (Bicep), copy data from current `nzila_os_staging` if continuity required, then `db:migrate`. **Production data migration must be approved separately.** |

---

## 6. Verdict

**SCHEMA PARITY: UNVERIFIED.**

The schema is sufficiently complete that the application functions today. The Drizzle ledger drift means we cannot prove repo-versus-DB parity, cannot reliably plan rollbacks, and cannot certify the demo/pilot DBs (once provisioned) will be migrated identically.

This is a **HIGH** severity blocker and must be closed before Phase A is signed off.
