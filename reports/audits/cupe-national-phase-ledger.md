# CUPE National — Phase Ledger

Single source of truth for phase progression. Updated at the close of each phase.

## Phase 0 — Baseline Stabilization

**Status:** `IN_PROGRESS — CHECKPOINT 2349d497b · Phase 0A closed AMBER 2026-07-23`
**Authorized at commit:** `290e6c77dd1bc2ddcf33d899e52f13ccd57bd161`
**Branch:** `fix/union-eyes-reality-remediation`
**Local database:** native Windows PostgreSQL 17.8 on `localhost:5433`, DB `nzila_automation`, user `nzila`

The previous checkpoint (commit `2349d497b`) is not Phase 0 closure. Remaining Phase 0
obligations are tracked in the "Phase 0 exit checklist" and "Phase 0 open items" tables
below. Closure requires the E2E baseline, migration-runner reliability, database-model
drift resolution, KPI identifier defect fix, staging deployment (or grounded blocker),
and post-deployment smoke.

**Phase 0A · Migration lineage closure (2026-07-23):** closed
`AMBER — MIGRATION LINEAGE INCOMPLETE`. The structural lineage gap is closed
by a checked-in baseline plus a two-phase runner; three additional
pre-existing defects (PH0-OPEN-006 / -007 / -008) surfaced during the empty-DB
proof and require healer migrations in a follow-up phase. See
[cupe-national-phase-0/migration-baseline-design.md](cupe-national-phase-0/migration-baseline-design.md)
and
[cupe-national-phase-0/migration-validation-summary.md](cupe-national-phase-0/migration-validation-summary.md).

### Phase 0 exit checklist

- [x] Truth re-established (branch, HEAD, dirty scope recorded).
- [x] Fix commit `290e6c77d` confirmed as HEAD.
- [x] Full Union Eyes vitest baseline recorded (1103 files, 16 036 tests, 0 fail, 127.23 s).
- [x] Focused API vitest baseline recorded (9 files, 89 tests, 0 fail, 730 ms).
- [x] Failure inventory drafted at [cupe-national-phase-0/failure-inventory.md](cupe-national-phase-0/failure-inventory.md).
- [x] Migration defect fix landed as `packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql`.
- [x] Missing platform migrations (0009, 0010) applied to local dev database.
- [x] Governed platform migration runner delivered ([`tooling/scripts/apply-platform-migrations.mjs`](../../tooling/scripts/apply-platform-migrations.mjs)) with content-hash tracking in `drizzle.__platform_migrations`, `--check`, `--verify`, `--baseline`. Idempotency and CI-verify contracts proven against dev DB.
- [x] Migration lineage gap diagnosed: [cupe-national-phase-0/migration-lineage-gap.md](cupe-national-phase-0/migration-lineage-gap.md). `orgs`, `commerce_*`, and other schema-only tables are not created by any SQL migration in `packages/db/drizzle/`; historical environments were bootstrapped by out-of-band `drizzle-kit push`. Clean-DB replay fails at `0007_flow_domain_tables.sql`.
- [x] **Phase 0A — lineage gap closed** via checked-in baseline `packages/db/bootstrap/0000_platform_schema_prerequisites.sql` + manifest `platform_schema_prerequisites.json` + runner two-phase lifecycle + `.known-partial-failures.json` allowlist. Reconciliation proven across empty, partial, and fully-materialized DB scenarios. See [cupe-national-phase-0/migration-validation-summary.md](cupe-national-phase-0/migration-validation-summary.md).
- [ ] Clean-DB migration proof of the full 34-file chain (blocked by three pre-existing defects PH0-OPEN-006 / -007 / -008 discovered by Phase 0A; requires healer migrations in a follow-up phase — out of Phase 0A scope per directive).
- [ ] `orgs` / `organizations` model decision authored + seed of missing `orgs` row for E2E demo tenant.
- [ ] KPI UUID defect trace + fix.
- [ ] Playwright deterministic lifecycle (readiness endpoint + separated server-start / test timeouts).
- [ ] E2E baseline re-recorded at HEAD (blocked by Playwright lifecycle).
- [ ] Staging deployment attempted or external blocker recorded.
- [ ] Post-deployment smoke suite result recorded.
- [ ] Maintainer sign-off recorded.

### Phase 0 evidence

| Artefact | Path |
|---------|------|
| Program document | [cupe-national-implementation-program.md](cupe-national-implementation-program.md) |
| Failure inventory | [cupe-national-phase-0/failure-inventory.md](cupe-national-phase-0/failure-inventory.md) |
| Vitest baseline | [cupe-national-phase-0/vitest-run-20260722-162228.log](cupe-national-phase-0/vitest-run-20260722-162228.log) |
| Focused API baseline | [cupe-national-phase-0/vitest-api-20260722-162507.log](cupe-national-phase-0/vitest-api-20260722-162507.log) |
| E2E probe log | [cupe-national-phase-0/e2e-pilot-mode-gating-20260722.log](cupe-national-phase-0/e2e-pilot-mode-gating-20260722.log) |
| Migration fix | [packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql](../../packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql) |
| Platform migration runner | [tooling/scripts/apply-platform-migrations.mjs](../../tooling/scripts/apply-platform-migrations.mjs) |
| Runner clean-run failure log (probe DB) | [cupe-national-phase-0/migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log) |
| Runner baseline + idempotency proof (dev DB) | [cupe-national-phase-0/migration-baseline-dev.log](cupe-national-phase-0/migration-baseline-dev.log) |
| Migration lineage gap diagnosis | [cupe-national-phase-0/migration-lineage-gap.md](cupe-national-phase-0/migration-lineage-gap.md) |
| Phase 0A baseline design | [cupe-national-phase-0/migration-baseline-design.md](cupe-national-phase-0/migration-baseline-design.md) |
| Phase 0A validation summary | [cupe-national-phase-0/migration-validation-summary.md](cupe-national-phase-0/migration-validation-summary.md) |
| Phase 0A existing-DB reconciliation proof (dev DB) | [cupe-national-phase-0/migration-existing-db-reconciliation.log](cupe-national-phase-0/migration-existing-db-reconciliation.log) |
| Phase 0A reconcile-safe proof (fully-materialized DB) | [cupe-national-phase-0/migration-reconcile-safe.log](cupe-national-phase-0/migration-reconcile-safe.log) |
| Phase 0A idempotency log | [cupe-national-phase-0/migration-idempotency.log](cupe-national-phase-0/migration-idempotency.log) |
| Phase 0A defect survey log (0013 / 0017 / 0032) | [cupe-national-phase-0/migration-survey.log](cupe-national-phase-0/migration-survey.log) |
| Baseline SQL | [packages/db/bootstrap/0000_platform_schema_prerequisites.sql](../../packages/db/bootstrap/0000_platform_schema_prerequisites.sql) |
| Baseline reconciliation manifest | [packages/db/bootstrap/platform_schema_prerequisites.json](../../packages/db/bootstrap/platform_schema_prerequisites.json) |
| Partial-failure allowlist | [packages/db/drizzle/.known-partial-failures.json](../../packages/db/drizzle/.known-partial-failures.json) |

### Phase 0 root-cause fixes landed

| ID | Class | File / change | Evidence |
|----|-------|---------------|----------|
| PH0-FIX-001 | Migration defect | New forward migration `packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql` restores the FK and idempotent statements that 0010 skipped because of the invalid `ADD CONSTRAINT IF NOT EXISTS` clause. | Applied locally with `psql -v ON_ERROR_STOP=1`; `pilot_alerts_rule_fk` now present. |
| PH0-FIX-002 | Migration workflow gap | New governed runner `tooling/scripts/apply-platform-migrations.mjs`. Discovers all 34 platform SQL files by 4-digit prefix, applies each in its own transaction, records SHA-256 in a dedicated `drizzle.__platform_migrations` tracking table (isolated from drizzle-kit and from the Union Eyes scoped bootstrap), and exposes `--check` / `--verify` / `--baseline` modes. | `[migrate] discovered 34 SQL files; 34 hashes already recorded; 0 pending.` after `--baseline` on dev DB; re-run in default mode confirms `[migrate] All migrations already applied.` (see `migration-baseline-dev.log`). |
| PH0-FIX-003 | Migration lineage gap (Phase 0A) | Checked-in prerequisite baseline `packages/db/bootstrap/0000_platform_schema_prerequisites.sql` + reconciliation manifest `packages/db/bootstrap/platform_schema_prerequisites.json`. Materializes the 4 extensions + 5 enums + 6 tables (`orgs`, `commerce_*`) that the incremental chain depends on. Idempotent (`CREATE … IF NOT EXISTS` + `DO $$ EXCEPTION $$` for enums). Reverse-engineered from `packages/db/schema/orgs.ts` and `packages/db/schema/commerce.ts`. | Applied against `nzila_migration_probe` — `[migrate] applied baseline artifact 0000_platform_schema_prerequisites.sql`. Manifest reconciliation against dev DB correctly reported "5 present + 6 missing, no drift" and filled the gaps idempotently. See [migration-baseline-design.md](cupe-national-phase-0/migration-baseline-design.md). |
| PH0-FIX-004 | Runner two-phase lifecycle + reconciliation + allowlist (Phase 0A) | Runner rewritten with six modes (default, `--check`, `--verify`, `--baseline`, `--bootstrap-check`, `--bootstrap-apply`, `--bootstrap-reconcile`). New `drizzle.__platform_bootstrap` ledger (mode = `apply` \| `reconcile`). Reconciliation policy separates "missing objects" (APPLY-safe) from "drift on present objects" (APPLY-refused). Incremental execution switched to `psql -f` autocommit semantics (no per-file `BEGIN…COMMIT`) to preserve historical healer contracts. `.known-partial-failures.json` allowlist added with runner-enforced healer-existence check; currently lists one entry (`0010_pilot_alerting_hardening.sql` healed by `0033_fix_pilot_alerts_rule_fk.sql`). | Three DB scenarios proven end-to-end: fresh empty DB (APPLY), partially-materialized DB (APPLY fills gaps + idempotent no-op on repeat), fully-materialized DB (RECONCILE records without executing SQL). Evidence in [migration-validation-summary.md](cupe-national-phase-0/migration-validation-summary.md), logs in [migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log), [migration-existing-db-reconciliation.log](cupe-national-phase-0/migration-existing-db-reconciliation.log), [migration-reconcile-safe.log](cupe-national-phase-0/migration-reconcile-safe.log). |

### Phase 0 open items (must close before scenario graduation)

| ID | Class | Description | Status | Owner |
|----|-------|-------------|--------|-------|
| PH0-OPEN-001 | Migration lineage gap | `orgs`, `commerce_*`, and other schema-only tables are not created by any file in `packages/db/drizzle/*.sql`. Fresh DBs cannot be provisioned from source alone. Options A / B / C detailed in `cupe-national-phase-0/migration-lineage-gap.md`. Decision required from Aubert. | **CLOSED — 2026-07-23 (Phase 0A · Option A)** — see PH0-FIX-003 + PH0-FIX-004 | Phase 0A |
| PH0-OPEN-002 | Data-model divergence | `pilot_definitions.org_id` references `orgs`; Union Eyes writes org context to `organizations`. Demo org `11111111-1111-4111-8111-111111111111` exists in `organizations` but not in `orgs`. Diagnosis complete (bounded contexts, shared-UUID convention). Fix: seed missing `orgs` row for E2E demo tenant + contract test enforcing "every Union-Eyes-active organizations row must have a matching orgs row". | **Open — fix specified** | Phase 0 |
| PH0-OPEN-003 | Stale expectation | [apps/union-eyes/lib/db-validator.ts](../../apps/union-eyes/lib/db-validator.ts) hardcodes `users` as a critical table. Current schema has no `users` table. | **Open** | Phase 1 |
| PH0-OPEN-004 | Environment defect | Playwright `beforeAll` timeout is 60 s; Windows Turbopack cold start regularly exceeds that. Requires deterministic lifecycle (readiness endpoint) + separated server-start / test timeouts. | **Open** | Phase 0 |
| PH0-OPEN-005 | Seed defect (hypothesis) | Untracked file `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` uses a `kpi_…` string identifier. Any code path that inserts this identifier into a `uuid` column (candidate: `kpi_configurations.id`) will produce the runtime error `invalid input syntax for type uuid: "kpi_mrwhcp4b_d2f72515a580"`. | **Open** | Phase 0 |
| PH0-OPEN-006 | Historical migration defect (surfaced by Phase 0A) | `packages/db/drizzle/0013_orchestrator_runtime_hardening.sql` line 34 uses `DROP INDEX IF EXISTS "automation_commands_correlation_id_unique"` on an object that is actually a **UNIQUE CONSTRAINT** created by `0003_redundant_starfox.sql`. PostgreSQL requires `ALTER TABLE … DROP CONSTRAINT` first. Failure halts the file after its 8 `ADD COLUMN` clauses complete, skipping 5 `CREATE INDEX` and `automation_events.org_id` additions. Cascades into PH0-OPEN-008. Repro + evidence in [migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log), diagnosis in [migration-lineage-gap.md §4](cupe-national-phase-0/migration-lineage-gap.md#ph0-open-006--0013_orchestrator_runtime_hardeningsql). Healer required (out of Phase 0A scope). | **Open** | Follow-up phase |
| PH0-OPEN-007 | Historical migration defect (surfaced by Phase 0A) | `packages/db/drizzle/0017_trustcore_law25.sql` line 1 uses `CREATE TYPE IF NOT EXISTS`, which PostgreSQL does not support. The correct idiom is `DO $$ BEGIN CREATE TYPE …; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`. Nothing in the file commits. Cascades into `0019_trustcore_policies.sql` line 30 and `0025_trustcore_privacy_programs_org_name.sql` line 13 (both fail with `relation "trustcore_privacy_programs" does not exist`). Repro + diagnosis in [migration-lineage-gap.md §4](cupe-national-phase-0/migration-lineage-gap.md#ph0-open-007--0017_trustcore_law25sql). Healer required (out of Phase 0A scope). | **Open** | Follow-up phase |
| PH0-OPEN-008 | Historical migration defect (surfaced by Phase 0A) | `packages/db/drizzle/0032_audit_events_canonical_hash.sql` line 43 fails with `column "org_id" does not exist`. Suspected cascade from PH0-OPEN-006 (which would have added `automation_events.org_id` had it completed). Requires healer with `ADD COLUMN IF NOT EXISTS org_id` + backfill + reapply of post-line-43 statements. Repro in [migration-survey.log](cupe-national-phase-0/migration-survey.log), diagnosis in [migration-lineage-gap.md §4](cupe-national-phase-0/migration-lineage-gap.md#ph0-open-008--0032_audit_events_canonical_hashsql). Healer required (out of Phase 0A scope). | **Open** | Follow-up phase |
| PH0-OPEN-009 | Runner discipline | `.known-partial-failures.json` allowlist has 1 entry (`0010 → 0033 healer`). Any future widening must be paired with (a) a linked ledger entry, (b) a matching healer migration in `packages/db/drizzle/`, and (c) runner enforcement that the healer file actually exists. Periodic review recommended. | **Open — advisory** | Phase 0 / ongoing |

### Phase 0A closure classification (this session, 2026-07-23)

**`AMBER — MIGRATION LINEAGE INCOMPLETE`**

* The structural **lineage gap** (PH0-OPEN-001) is **CLOSED** by PH0-FIX-003 (baseline SQL + manifest) and PH0-FIX-004 (runner two-phase lifecycle + reconciliation + allowlist).
* All three DB-state scenarios (empty, partial-baseline, fully-materialized) validate the runner contracts.
* The full 34-file empty-DB replay is blocked by three previously-undocumented pre-existing defects (PH0-OPEN-006 / -007 / -008) in files 0013, 0017, and 0032. Each requires a dedicated healer migration in a follow-up phase; the Phase 0A directive explicitly prohibits any change to files 0000–0033, so those healers cannot be authored under this phase.
* Phase 0 as a whole remains open for the residual items (§4 org-model, §5 KPI id, §6 Playwright, §7 E2E, §10 staging, §11 smoke).

### Phase 0 closure classification (superseded 2026-07-23 — see Phase 0A block above)

`AMBER — INCOMPLETE`.

* §3 (migration workflow) is `GREEN` on the runner contracts (no silent skip, fail on error, records applied migrations) but `AMBER` on the clean-DB proof — **as of Phase 0A the sub-item advances to `AMBER — MIGRATION LINEAGE INCOMPLETE` (PH0-OPEN-001 CLOSED; residual blockers PH0-OPEN-006 / -007 / -008)**.
* §4 (org-model consistency), §5 (KPI id repair), §6 (Playwright lifecycle), §7 (E2E baseline at HEAD), §10 (staging deployment), §11 (post-deploy smoke) remain open.
* No Phase 1 authorization requested. The user (Aubert) is the sole Phase 1 approver.

### Phase 0 non-changes

The following remain untouched:

- The seven CUPE audit registers under [reports/audits/](../../).
- All Union Eyes product code, routes, actions, and FSM under `apps/union-eyes/`.
- All 34 historical migrations `packages/db/drizzle/0000_*` through `0033_*` (byte-identical after Phase 0A).
- 31 unrelated dirty lines in the working tree (governance drift, ops KPI snapshots, docs). They must not enter any Phase 0 commit.

---

## Phase 1 – 10

Not started. Sections will be added at authorization time.
