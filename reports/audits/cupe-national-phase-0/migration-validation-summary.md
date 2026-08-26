# Phase 0A · Migration validation summary

> **UPDATED 2026-07-23 (Phase 0A.1 closure)** — Phase 0A.1 completes the empty-DB replay by shipping four healer migrations (`0034` / `0035` / `0036` / `0037`), extending the runner allowlist to 7 entries, and hardening the runner to enforce healer pairing. Phase 0A.1 overall verdict is **`GREEN — MIGRATION LINEAGE CLOSED`**. See § 8 below for the Phase 0A.1 closure block. The Phase 0A verdict of `AMBER` recorded in § 1 below is preserved as historical record.

**Date:** 2026-07-23
**Scope:** Phase 0A closure + Phase 0A.1 closure. Phases 0B / 0C / 0D not started.
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

---

## 8. Phase 0A.1 closure block (2026-07-23)

**Verdict:** `GREEN — MIGRATION LINEAGE CLOSED`.

### 8.1 What Phase 0A.1 shipped

1. Four new healer migrations:
   * `packages/db/drizzle/0034_heal_orchestrator_runtime_hardening.sql` — heals PH0-OPEN-006 (0013).
   * `packages/db/drizzle/0035_heal_trustcore_law25_chain.sql` — heals PH0-OPEN-007 (0017 / 0019 / 0025 chain).
   * `packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql` — heals PH0-OPEN-008 (0032).
   * `packages/db/drizzle/0037_heal_pilot_alerting_hardening.sql` — heals **new** defect chain PH0-OPEN-010 (0010 parser rejection cascading into 0033 healer failure on empty DBs).
2. `.known-partial-failures.json` extended to 7 entries covering `0010` / `0013` / `0017` / `0019` / `0025` / `0032` / `0033`, each paired with the healer above.
3. Runner (`tooling/scripts/apply-platform-migrations.mjs`) hardened: tracking table extended with `partial` / `sqlstate` / `error_signature` / `statement_location` / `healer_filename` / `outcome_class` columns (via `ADD COLUMN IF NOT EXISTS` for backward compatibility); `--verify` refuses to succeed unless every allowlisted partial has a matching applied healer with `outcome_class = 'full-success'`.

### 8.2 Root-cause finding — PG 14+ implicit transaction wrapping

The node-postgres simple query protocol dispatches each `.sql` file as one `Query` message. PostgreSQL 14+ wraps that message in a single implicit transaction, so **any runtime error rolls back all statements in the file**. Phase 0A allowlist claims of "commits N statements then aborts" were only accurate on the pre-populated dev DB because prior out-of-band `drizzle-kit push` runs had already materialized most artifacts under `IF NOT EXISTS` guards. On empty DBs the healers must restore **everything** the failed migration intended. Documented in headers of all four healers and in `migration-healer-design.md` § 2.

### 8.3 Clean-DB replay proof

Executed against fresh `nzila_phase0a1_probe`:

| Step | Command | Outcome | Evidence |
|---|---|---|---|
| 1 | `--bootstrap-apply` | `applied 1 artifact 0000_platform_schema_prerequisites.sql` | [migration-clean-run.log](migration-clean-run.log) |
| 2 | default mode | `Done. Applied 38 incremental migration(s).` — 27 full-success + 4 healer full-success + 7 approved-partial paired with healers | [migration-clean-run.log](migration-clean-run.log) |
| 3 | `--verify` | `verify: bootstrap satisfied, no incremental migrations pending, every allowlisted partial is paired with an applied healer, no hash drift.` Exit 0 | [migration-clean-run.log](migration-clean-run.log) |
| 4 | `--bootstrap-apply` (idempotent) | `already recorded; skipping` | [migration-healer-idempotency.log](migration-healer-idempotency.log) |
| 5 | default mode (idempotent) | `38 already applied; 0 pending` | [migration-healer-idempotency.log](migration-healer-idempotency.log) |
| 6 | `--verify` (idempotent) | Exit 0 | [migration-healer-idempotency.log](migration-healer-idempotency.log) |

### 8.4 Post-heal schema witness

Captured in [migration-schema-comparison.txt](migration-schema-comparison.txt). Key observations against the healed probe DB:

* 168 base tables in `public`, 154 enum types (includes `tc_policy_type` restored by 0035 § 4b).
* `audit_events` has `occurred_at` / `hash_version` / `org_id` (all `NOT NULL`), the `audit_events_org_id_orgs_id_fk` FK, and the `audit_events_org_occurred_idx` index — all restored by 0036.
* `automation_commands` has all 21 columns including the 9 added by 0034, and the `correlation_id_unique` constraint has been dropped (not present in `pg_constraint`). `automation_events.org_id` is `NOT NULL`.
* 16 `trustcore_*` tables including `trustcore_policies` restored by 0035 § 4b.
* 3 `pilot_alert*` tables (`pilot_alerts`, `pilot_alert_rules`, `pilot_alert_escalations`); `pilot_alerts` has 32 columns (11 base + 21 restored by 0037); the `pilot_alerts_rule_fk` FK is present.

### 8.5 Tracking-table witness

Captured in [migration-tracking-witness.txt](migration-tracking-witness.txt). `drizzle.__platform_migrations` holds 38 rows:

* 27 baseline-healthy incrementals recorded `full-success`.
* 7 allowlisted partials recorded with SQLSTATE + healer filename + `outcome_class = 'approved-partial'`: 0010 (42601 → 0037), 0013 (2BP01 → 0034), 0017 (42601 → 0035), 0019 (42P01 → 0035), 0025 (42P01 → 0035), 0032 (42703 → 0036), 0033 (42P01 → 0037).
* 4 healer migrations recorded `full-success`.

### 8.6 Design documents added by Phase 0A.1

| Path | Purpose |
|---|---|
| `reports/audits/cupe-national-phase-0/migration-healer-design.md` | Design rationale, healer contract, PG 14+ finding, per-healer summaries, allowlist mapping. |
| `reports/audits/cupe-national-phase-0/migration-healer-statement-map.md` | Per-source-statement mapping to the healer statement that restores it. |
| `reports/audits/cupe-national-phase-0/migration-clean-run.log` (overwritten) | STEP 1 / 2 / 3 empty-DB replay evidence. |
| `reports/audits/cupe-national-phase-0/migration-healer-idempotency.log` (new) | STEP 4 / 5 / 6 idempotency evidence. |
| `reports/audits/cupe-national-phase-0/migration-tracking-witness.txt` (new) | `drizzle.__platform_migrations` + `drizzle.__platform_bootstrap` dump on the healed probe DB. |
| `reports/audits/cupe-national-phase-0/migration-schema-comparison.txt` (new) | Post-heal schema witness — tables / enums / columns / constraints. |

### 8.7 Transparency — one unforeseen new defect

Phase 0A.1 was authorized to close PH0-OPEN-006 / -007 / -008 with three healers. Empirical work uncovered a fourth defect chain (0010 parser rejection cascading into 0033 failure on empty DBs) that was invisible to Phase 0A because the dev DB had drizzle-kit push-materialized `pilot_alert_rules` beforehand. A fourth healer (`0037`) and a new ledger item (`PH0-OPEN-010` / `PH0-FIX-008`) were therefore authored. This exceeds the letter of the original three-healer plan but is required to satisfy the Phase 0A.1 axiom that every tolerated partial must be paired with a healer that restores the complete intended state. Full disclosure appears in the ledger and in `migration-healer-design.md` § 2.

### 8.8 Files NOT changed

* Historical migrations `0000_initial.sql` – `0033_fix_pilot_alerts_rule_fk.sql` remain byte-identical.
* `drizzle.__drizzle_migrations` untouched in every scenario.
* `packages/db/drizzle/meta/_journal.json` untouched.
* The seven CUPE audit registers under `reports/audits/` remain untouched.
* Approximately 31 unrelated dirty lines in the working tree remain unstaged and were not included in any Phase 0A.1 commit.
