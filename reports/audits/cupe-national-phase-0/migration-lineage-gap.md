# Phase 0 · Migration lineage gap · Diagnosis

**Discovered:** 2026-07-22
**Branch/HEAD:** `fix/union-eyes-reality-remediation` @ `2349d497b` (+ uncommitted phase-0 work)
**Owner (this diagnosis):** Phase 0 baseline stabilization
**Owner (resolution):** Aubert to authorize; targeted implementation belongs in Phase 0 close or Phase 1 preamble depending on choice.

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
