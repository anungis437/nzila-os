# Phase 0 · Migration lineage gap · Diagnosis + Phase 0A closure amendment

**Discovered:** 2026-07-22
**Branch/HEAD:** `fix/union-eyes-reality-remediation` @ `2349d497b` (+ uncommitted phase-0 work)
**Owner (this diagnosis):** Phase 0 baseline stabilization
**Owner (resolution):** Aubert to authorize; targeted implementation belongs in Phase 0 close or Phase 1 preamble depending on choice.

---

## AMENDMENT (2026-07-23) — Phase 0A decision recorded

**Decision:** Aubert chose **Option A** (author a checked-in prerequisite baseline), executed as a separate **Phase 0A**.
**Implementation:** See [migration-baseline-design.md](migration-baseline-design.md) and [migration-validation-summary.md](migration-validation-summary.md).
**Outcome:** PH0-OPEN-001 (this lineage gap) is **CLOSED**. Three additional pre-existing defects (PH0-OPEN-006 / -007 / -008 — see §4 below) were surfaced by the end-to-end proof and are logged as follow-up items. Phase 0A overall closes **`AMBER — MIGRATION LINEAGE INCOMPLETE`** because the empty-DB chain cannot reach 0033 without a healer for each of those three defects, and the Phase 0A directive prohibits authoring any change to files 0000–0033 (healers must land in a follow-up phase).

---

## Summary (one paragraph)

The platform migration lineage under `packages/db/drizzle/*.sql` is **not self-contained**. Running every file in order against a fresh, empty PostgreSQL database — the definition of a clean bootstrap — fails at `0007_flow_domain_tables.sql` with `relation "orgs" does not exist`. The `orgs` table is defined in `packages/db/src/schema/orgs.ts` (Drizzle schema module) but **no SQL file anywhere in the repository creates it**. The dev, staging, and production databases have the `orgs` table only because it was materialized historically by `drizzle-kit push` (schema-first sync, no migration file emitted) or by an equivalent out-of-band operation that is not preserved in the repository. Every subsequent hand-authored migration file (0007 – 0033) treats `orgs`, several `commerce_*` tables, and other schema-only tables as pre-existing dependencies. Consequently:

1. **No new environment can be provisioned reproducibly from source alone.** The historical bootstrap step is undocumented and non-committed.
2. **`drizzle-kit migrate` cannot close the gap** because only 5 of the 34 files are journaled in `packages/db/drizzle/meta/_journal.json`.
3. **The new platform runner (`tooling/scripts/apply-platform-migrations.mjs`) cannot close the gap** because the file set it applies does not include a base-tables migration.

This is a real, structural defect. It does not affect the dev, staging, or prod databases already in service — those were built up incrementally across many out-of-band drizzle-kit push runs. It affects every fresh checkout (developer onboarding, CI ephemeral DBs, disaster-recovery restore-and-replay).

## Evidence (reproducible)

```powershell
# Fresh, empty database with required extensions.
$env:PGPASSWORD='nzila_dev'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
& $psql -U nzila -d postgres -p 5433 -h localhost -c "DROP DATABASE IF EXISTS nzila_migration_probe;"
& $psql -U nzila -d postgres -p 5433 -h localhost -c "CREATE DATABASE nzila_migration_probe;"
& $psql -U nzila -d nzila_migration_probe -p 5433 -h localhost -c @"
CREATE EXTENSION IF NOT EXISTS `"uuid-ossp`";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
"@

# Apply every governed migration file in order.
$env:DATABASE_URL='postgresql://nzila:nzila_dev@localhost:5433/nzila_migration_probe'
node tooling/scripts/apply-platform-migrations.mjs
```

Observed output (captured in `reports/audits/cupe-national-phase-0/migration-clean-run.log`):

```
[migrate] discovered 34 SQL files; 0 hashes already recorded; 34 pending.
[migrate] applying 0000_initial.sql ...           applied 0000_initial.sql
[migrate] applying 0001_solid_cargill.sql ...     applied 0001_solid_cargill.sql
[migrate] applying 0002_rich_marten_broadcloak.sql applied 0002_rich_marten_broadcloak.sql
[migrate] applying 0003_redundant_starfox.sql ... applied 0003_redundant_starfox.sql
[migrate] applying 0004_audit_events_immutable.sql applied 0004_audit_events_immutable.sql
[migrate] applying 0005_ai_model_registry.sql ... applied 0005_ai_model_registry.sql
[migrate] applying 0006_idempotency_cache.sql ... applied 0006_idempotency_cache.sql
[migrate] applying 0007_flow_domain_tables.sql
[migrate:fail] failure applying 0007_flow_domain_tables.sql: relation "orgs" does not exist
```

Corroborating grep (no SQL file in the repo creates `orgs`):

```
Get-Content packages/db/drizzle/0007_flow_domain_tables.sql -Head 4
# -- Flow Domain Tables Migration
# -- Creates Flow-specific enums and tables required by the Flow app.
# -- These tables reference commerce_* and orgs tables that must already exist.
# -- Run after the commerce migration and initial schema are in place.
```

The header of `0007` explicitly acknowledges a prerequisite ("run after the commerce migration and initial schema are in place") that is not present in the repository as a committed artifact.

## Scope of missing schema

The following schema-only tables are defined in `packages/db/src/schema/**` and referenced by later migrations, but **have no CREATE TABLE anywhere in `packages/db/drizzle/*.sql`**:

| Table (or family) | Defined in | First referenced by |
| --- | --- | --- |
| `orgs` | `packages/db/src/schema/orgs.ts` | `0007_flow_domain_tables.sql`, `0009_pilot_metrics_layer.sql`, `0010_pilot_alerting_hardening.sql`, many others |
| `commerce_*` (multiple) | `packages/db/src/schema/commerce.ts` | `0007_flow_domain_tables.sql` |

Additional families are likely to be discovered when the base-tables migration is authored; the diagnosis stops at the first failure because the runner correctly halts on error.

## Why this was not caught previously

* Every existing environment already had these tables (populated historically by drizzle-kit push).
* No CI job runs "migrate a fresh database from source" as an assertion.
* The Union Eyes scoped bootstrap (`tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`) uses a **different** migration cache (`apps/union-eyes/db/migrations-cache/`) and does not consume `packages/db/drizzle/*.sql`, so its success signals nothing about the platform lineage.
* `drizzle-kit migrate` silently ignores non-journaled files, so the operator saw "0 pending" outputs even though 29 files had never been applied.

## Delivered in this phase (what does work)

The platform migration runner `tooling/scripts/apply-platform-migrations.mjs` delivers the enforceable half of the migration contract:

1. **No silent skip.** All 34 files in `packages/db/drizzle/*.sql` are discovered on every run.
2. **Fail on error.** Each file is applied in its own transaction with `BEGIN … COMMIT`; any error rolls back and exits non-zero.
3. **Content-addressed idempotency.** Applied files are recorded by SHA-256 of raw bytes in `drizzle.__platform_migrations` (a tracking table deliberately separate from `drizzle.__drizzle_migrations`, which is owned by drizzle-kit and by the Union Eyes scoped bootstrap).
4. **CI-safe verification.** `--verify` exits code `2` if any file is pending; suitable for a `db:migration:safety` gate.
5. **One-time onboarding.** `--baseline` records every discovered file's hash without executing any SQL, for existing databases whose contents were built up out-of-band.

Baseline of the local dev database was executed in this session and is captured in `reports/audits/cupe-national-phase-0/migration-baseline-dev.log`:

```
[migrate] discovered 34 SQL files; 0 hashes already recorded; 34 pending.
[migrate] baselined 34 file(s) without executing any SQL.
[migrate] discovered 34 SQL files; 34 hashes already recorded; 0 pending.
[migrate] All migrations already applied.
```

Idempotency was proven by re-running the runner in default mode after baseline: 0 pending, exit 0.

## What remains and cannot be done without a decision

Closing the clean-DB gap requires **one** of the following. Each has costs and is a decision Aubert must own before Phase 0 can be marked GREEN on §3.

### Option A · Author a base-tables migration file

Emit a new pre-0000 or post-0033 SQL migration that materializes every schema-only table currently missing from the lineage (`orgs`, `commerce_*`, and any others discovered by iterative probe runs). The file would be reverse-engineered from the schema modules and validated by running the runner against a fresh probe DB until it reaches file 0033 without error.

**Pros:** Single canonical bootstrap path (`node tooling/scripts/apply-platform-migrations.mjs` on a clean DB reaches steady state).
**Cons:** Reverse-engineering effort; risk of subtle divergence from what production actually has; introduces a "0034" that logically belongs at position 0000 (naming conflict with existing 0000_initial.sql that only covers Drizzle-kit-generated tables).

### Option B · Formalize `drizzle-kit push` as the mandatory prerequisite

Author a wrapper (`pnpm db:bootstrap:platform`) that: (a) runs `drizzle-kit push` non-interactively to materialize schema.ts tables that never got a migration file; (b) runs `apply-platform-migrations.mjs` to apply the hand-written SQL migrations. Both steps are recorded in a bootstrap-attestation table (mirroring the Union Eyes bootstrap pattern).

**Pros:** No historical migration files touched; matches how the databases were actually built historically; smaller surface area.
**Cons:** Two-step workflow; `drizzle-kit push` currently hangs on the probe database at "Pulling schema from database…" — needs a separate investigation and fix; introduces schema-push into the canonical bootstrap path, which some governance frameworks consider anti-pattern for reproducibility.

### Option C · Absorb missing tables into a per-schema materialize step

Extract per-schema CREATE TABLE statements from the Drizzle schema modules programmatically (there is precedent inside `packages/db/`) and run them ahead of `apply-platform-migrations.mjs`. Effectively a lighter-weight version of Option B without shelling to drizzle-kit.

**Pros:** No drizzle-kit runtime dependency in bootstrap; deterministic output.
**Cons:** Duplicates logic drizzle-kit already implements; risk of drift between the extractor and drizzle-kit’s emission rules.

---

## Recommendation (not authorization)

Option **B** is the smallest change that preserves the "historical migrations are frozen" invariant. The `drizzle-kit push` hang on the probe DB is a real but bounded blocker — the same command completes against dev DBs today, so the hang is likely a first-run artifact (many concurrent schema-diff calculations) rather than a fundamental defect. Investigation and a non-interactive wrapper are Phase 0 in-scope; both are already precedented by `packages/db/push-staging.mjs`.

However, the actual choice is Aubert's. This document identifies the gap, provides reproducible evidence, and enumerates the options. It does not choose.

## Phase 0 gate impact

| Directive | Status |
| --- | --- |
| §3 · "no reliable command exists, implement the minimum governed migration runner required to establish repeatable development, test, and staging initialization" | **Partially satisfied.** Runner delivered, records applied migrations, fails on error, cannot silently skip. Repeatable initialization for **existing** DBs is proven. Repeatable initialization for **fresh** DBs is blocked by the lineage gap enumerated in this document. |
| §3 · "records applied migrations" | **Satisfied.** SHA-256 in `drizzle.__platform_migrations`. |
| §3 · "fails on migration errors" | **Satisfied.** Per-file transaction with rollback on error; exit code 1. |
| §3 · "cannot silently skip migrations" | **Satisfied.** All files discovered every run; `--verify` exits 2 when pending. |
| §3 · "clean-migration proof" | **Not satisfied.** Blocked by lineage gap. |

## Closure classification for Phase 0 §3

`AMBER — INCOMPLETE` on the sub-item "clean-migration proof". The runner and its contracts are `GREEN`. Overall §3 status is therefore governed by the sub-item: **AMBER — INCOMPLETE, pending decision from Aubert on Options A / B / C.**

---

## 4. Additional defects surfaced by Phase 0A empty-DB proof (2026-07-23)

Phase 0A closed the lineage gap enumerated above (see AMENDMENT header). Running the runner end-to-end on a freshly-created database after `--bootstrap-apply` further surfaced three previously-undocumented defects in historical migration files. These are logged here for traceability; each requires a dedicated healer migration in a follow-up phase (Phase 0A directive prohibits any change to files 0000–0033).

Evidence:
[migration-clean-run.log](migration-clean-run.log),
[migration-survey.log](migration-survey.log),
[migration-validation-summary.md](migration-validation-summary.md#4-blockers-to-green-pre-existing-defects-not-caused-by-phase-0a).

### PH0-OPEN-006 · `0013_orchestrator_runtime_hardening.sql`

- **Fail line:** 34
- **Error:** `cannot drop index "automation_commands_correlation_id_unique" because constraint "automation_commands_correlation_id_unique" on table "automation_commands" requires it`
- **Root cause:** `0003_redundant_starfox.sql` creates the unique constraint via `CONSTRAINT "…_unique" UNIQUE("correlation_id")`. PostgreSQL implicitly creates a backing unique index with the same name, but that index cannot be dropped standalone via `DROP INDEX` — the operator must `ALTER TABLE … DROP CONSTRAINT` first. `0013` uses `DROP INDEX IF EXISTS "automation_commands_correlation_id_unique"` on line 34, which errors even though the object exists.
- **Statements executed before the failure (still committed under `psql -f` semantics):** the eight `ADD COLUMN IF NOT EXISTS` clauses (org_id, idempotency_key, version, attempt_count, execution_owner, lease_expires_at, last_heartbeat_at, started_at, completed_at), the backfill `UPDATE`, and the two `ALTER COLUMN … SET NOT NULL` clauses.
- **Statements skipped:** every subsequent statement in the file — the `CREATE INDEX` for `automation_commands_correlation_idx`, `automation_commands_org_idempotency_uidx`, `automation_commands_org_status_idx`, `automation_commands_status_updated_idx`, `automation_commands_lease_idx`, the `ALTER TABLE automation_events ADD COLUMN org_id`, its backfill, its `SET NOT NULL`, and the two `automation_events` indexes.
- **Required healer:** a new migration (e.g. `0034_healer_automation_commands_correlation.sql`) that does `ALTER TABLE automation_commands DROP CONSTRAINT IF EXISTS automation_commands_correlation_id_unique;` and then reapplies every idempotent statement 0013 was supposed to leave behind.
- **Impact if unhealed:** Any environment that runs the full chain from scratch (fresh dev checkout, CI ephemeral DB, DR restore) fails at 0013 with a schema in a partially-hardened state.

### PH0-OPEN-007 · `0017_trustcore_law25.sql`

- **Fail line:** 1
- **Error:** `syntax error at or near "NOT"` (statement: `CREATE TYPE IF NOT EXISTS "public"."tc_program_status" …`)
- **Root cause:** PostgreSQL does not support `IF NOT EXISTS` on `CREATE TYPE`. The idiom must be `DO $$ BEGIN CREATE TYPE …; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
- **Statements executed before the failure:** none (failure at line 1).
- **Statements skipped:** the entire file, including `CREATE TABLE trustcore_privacy_programs` and every dependent create.
- **Cascade (blocks 2 further files):**
  - `0019_trustcore_policies.sql` — fails with `relation "trustcore_privacy_programs" does not exist` (needs the type-then-table sequence from 0017).
  - `0025_trustcore_privacy_programs_org_name.sql` — same cause.
- **Required healer:** a new migration that (a) creates each enum via the `DO $$ EXCEPTION WHEN duplicate_object $$` idiom, (b) creates `trustcore_privacy_programs` and its indexes, (c) reapplies the additive statements from 0019 and 0025.
- **Impact if unhealed:** trustcore Law 25 domain is entirely absent on any fresh DB.

### PH0-OPEN-008 · `0032_audit_events_canonical_hash.sql`

- **Fail line:** 43
- **Error:** `column "org_id" does not exist`
- **Root cause:** file assumes an `org_id` column on some table (candidate: `audit_events`) that is not created by any prior migration reachable on a fresh chain. Exact column ownership requires further diagnosis in the follow-up phase.
- **Statements executed before the failure:** whatever preceded line 43 in the file; not enumerated here because the file has not been sliced.
- **Required healer:** add the missing column (with backfill and appropriate default) then reapply the post-line-43 statements.

### Aggregate blocker summary

| ID | File | Class | Documented healer needed |
|----|------|-------|--------------------------|
| PH0-OPEN-006 | 0013 | Constraint / index confusion | Yes — `ALTER TABLE … DROP CONSTRAINT` + reapply |
| PH0-OPEN-007 | 0017 | Unsupported `CREATE TYPE IF NOT EXISTS` | Yes — `DO $$ EXCEPTION $$` + reapply (also unblocks 0019, 0025) |
| PH0-OPEN-008 | 0032 | Missing column dependency | Yes — add column, backfill, reapply post-fail statements |

None of these defects is introduced by Phase 0A. All three are pre-existing conditions on the untouched historical migration files, previously masked because no environment ever executed the full chain from scratch.
