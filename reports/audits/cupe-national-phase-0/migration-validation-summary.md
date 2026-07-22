# Phase 0A · Migration validation summary

**Date:** 2026-07-23
**Scope:** Phase 0A closure only. Phases 0B / 0C / 0D not started.
**Runner:** [tooling/scripts/apply-platform-migrations.mjs](../../../tooling/scripts/apply-platform-migrations.mjs)
**Baseline:** [packages/db/bootstrap/0000_platform_schema_prerequisites.sql](../../../packages/db/bootstrap/0000_platform_schema_prerequisites.sql)
**Manifest:** [packages/db/bootstrap/platform_schema_prerequisites.json](../../../packages/db/bootstrap/platform_schema_prerequisites.json)
**Allowlist:** [packages/db/drizzle/.known-partial-failures.json](../../../packages/db/drizzle/.known-partial-failures.json)

---

## 1. Phase 0A closure verdict

**`AMBER — MIGRATION LINEAGE INCOMPLETE`**

* The **lineage gap** identified as PH0-OPEN-001 in
  [migration-lineage-gap.md](migration-lineage-gap.md) is **CLOSED**. A fresh
  PostgreSQL database can now execute the runner and receive the previously-
  missing `orgs` + `commerce_*` prerequisites deterministically, from
  checked-in source, without any `drizzle-kit push` or out-of-band step.
* The **runner contracts** (no silent skip, fail on error, records applied
  migrations, `--verify` exits 2 on pending, reconciliation with configured
  drift policy) are **GREEN** across all three DB scenarios
  (empty, existing-with-baseline-materialized, existing-with-partial-baseline).
* The end-to-end clean-DB replay of all 34 incrementals is **NOT** green.
  Applying baseline + 0000–0009 + 0010 (tolerated) + 0011–0012 succeeds; the
  chain then halts on the first of **three additional previously-undocumented
  pre-existing defects** in migrations 0013, 0017, 0032. Those defects are
  logged as new open items (PH0-OPEN-006 / -007 / -008) and require dedicated
  healer migrations in a follow-up phase. Phase 0A directive explicitly
  prohibits modifying any historical migration file, so those healers cannot
  be authored under this phase.

## 2. What Phase 0A actually shipped

1. Checked-in baseline SQL + reconciliation manifest under `packages/db/bootstrap/`.
2. Runner rewritten with 6-mode two-phase lifecycle.
3. `psql -f` autocommit semantics (no per-file `BEGIN … COMMIT`) — required to preserve historical healer contracts.
4. Reconciliation logic that distinguishes "missing object" (APPLY-safe) from "present-with-drift" (APPLY-refused).
5. `.known-partial-failures.json` allowlist mechanism (audit-tracked tolerance for one legacy defect).
6. Three proof scenarios executed and logged.
7. Evidence + ledger updates.

## 3. Proof matrix

| Scenario | Command sequence | Outcome | Evidence |
|----------|------------------|---------|----------|
| Empty DB — bootstrap | `--bootstrap-apply` on `nzila_migration_probe` | `applied 1 artifact` | [migration-clean-run.log](migration-clean-run.log) |
| Empty DB — chain up to 0016 | (default mode) | `applied 0000–0009, tolerated 0010 partial per allowlist, applied 0011–0012`; halted at 0013 (see §4) | [migration-clean-run.log](migration-clean-run.log), [migration-survey.log](migration-survey.log) |
| Existing DB — partial-baseline detection | `--bootstrap-check` on `nzila_automation` (dev) | `APPLY-safe (5 present + 6 missing, no drift on present)` | [migration-existing-db-reconciliation.log](migration-existing-db-reconciliation.log) |
| Existing DB — bootstrap-reconcile refusal on missing | `--bootstrap-reconcile` on dev | Correctly refused (6 objects missing) | same |
| Existing DB — idempotent gap-fill | `--bootstrap-apply` on dev | Applied baseline; created the 3 missing tables + 3 missing enums | same |
| Existing DB — idempotent no-op | `--bootstrap-apply` (repeat) on dev | Recorded row present → skipped | same |
| Reconcile-safe DB — record without executing SQL | `--bootstrap-reconcile` on `nzila_reconcile_probe` (seeded with baseline out-of-band) | Recorded `mode='reconcile'` | [migration-reconcile-safe.log](migration-reconcile-safe.log) |

## 4. Blockers to `GREEN` (pre-existing defects, not caused by Phase 0A)

All three are unchanged historical migration files that fail on any DB where
their preconditions were never quietly satisfied out-of-band. They are new
findings on the ledger, not Phase 0A regressions.

| ID | File | Line | Error | Root cause |
|----|------|------|-------|------------|
| PH0-OPEN-006 | `0013_orchestrator_runtime_hardening.sql` | 34 | `cannot drop index automation_commands_correlation_id_unique because constraint … requires it` | 0003 created a `UNIQUE CONSTRAINT`; 0013 tries `DROP INDEX IF EXISTS` on it — PG requires `ALTER TABLE … DROP CONSTRAINT` first. |
| PH0-OPEN-007 | `0017_trustcore_law25.sql` | 1 | `syntax error at or near "NOT"` | `CREATE TYPE IF NOT EXISTS` — unsupported. Idiom is `DO $$ … EXCEPTION WHEN duplicate_object $$`. Halts creation of `trustcore_privacy_programs`, cascading through 0019 and 0025. |
| PH0-OPEN-008 | `0032_audit_events_canonical_hash.sql` | 43 | `column "org_id" does not exist` | Referenced column was expected on a table where 0032 does not add it and no earlier migration reliably adds it. |

Each requires a healer migration (e.g. `0034_healer_automation_commands_correlation.sql`) that:
1. Fixes the DB state.
2. Reapplies any statements the defective file would have run after the point of failure.
3. Is authored in a follow-up phase (out of Phase 0A scope per directive).

## 5. Idempotency

* `--bootstrap-apply` after a `RECORDED` row is present → `skipping.`
* `--bootstrap-reconcile` after `RECORDED` → `skipping.`
* Default mode re-run against a DB whose successful incrementals are hashed → `0 pending`.
* Runner's default mode on the empty-DB probe: idempotency partially demonstrated up to the 0013 halt point; full idempotency will be re-verified once the healers for 0013 / 0017 / 0032 land.

## 6. Files changed by Phase 0A

| Path | Change |
|------|--------|
| `packages/db/bootstrap/0000_platform_schema_prerequisites.sql` | NEW |
| `packages/db/bootstrap/platform_schema_prerequisites.json` | NEW |
| `packages/db/drizzle/.known-partial-failures.json` | NEW |
| `tooling/scripts/apply-platform-migrations.mjs` | REWRITTEN (two-phase lifecycle, reconciliation, allowlist wiring, `psql -f` autocommit semantics) |
| `reports/audits/cupe-national-phase-0/migration-baseline-design.md` | NEW |
| `reports/audits/cupe-national-phase-0/migration-validation-summary.md` | NEW (this file) |
| `reports/audits/cupe-national-phase-0/migration-clean-run.log` | NEW / overwritten |
| `reports/audits/cupe-national-phase-0/migration-existing-db-reconciliation.log` | NEW |
| `reports/audits/cupe-national-phase-0/migration-reconcile-safe.log` | NEW |
| `reports/audits/cupe-national-phase-0/migration-survey.log` | NEW |
| `reports/audits/cupe-national-phase-0/migration-idempotency.log` | NEW / overwritten |
| `reports/audits/cupe-national-phase-0/migration-lineage-gap.md` | AMENDED (Option A decision recorded; PH0-OPEN-001 → CLOSED; new §4 for PH0-OPEN-006/-007/-008) |
| `reports/audits/cupe-national-phase-ledger.md` | AMENDED (PH0-FIX-003, PH0-FIX-004 landed; PH0-OPEN-001 closed; PH0-OPEN-006/-007/-008 opened; §3 gate advanced) |

## 7. Files explicitly NOT changed

- Migrations `0000_initial.sql` – `0033_fix_pilot_alerts_rule_fk.sql` — byte-identical.
- `drizzle.__drizzle_migrations` table — untouched in every scenario.
- `apps/union-eyes/db/migrations-cache/` — untouched.
- `packages/db/drizzle/meta/_journal.json` — untouched.
- Seven CUPE audit registers under `reports/audits/` — untouched.
- 31 unrelated dirty lines in the working tree — remain unstaged and were not included in any Phase 0A commit.
