# CUPE National — Phase Ledger

Single source of truth for phase progression. Updated at the close of each phase.

## Phase 0 — Baseline Stabilization

**Status:** `IN_PROGRESS — CHECKPOINT 2349d497b`
**Authorized at commit:** `290e6c77dd1bc2ddcf33d899e52f13ccd57bd161`
**Branch:** `fix/union-eyes-reality-remediation`
**Local database:** native Windows PostgreSQL 17.8 on `localhost:5433`, DB `nzila_automation`, user `nzila`

The previous checkpoint (commit `2349d497b`) is not Phase 0 closure. Remaining Phase 0
obligations are tracked in the "Phase 0 exit checklist" and "Phase 0 open items" tables
below. Closure requires the E2E baseline, migration-runner reliability, database-model
drift resolution, KPI identifier defect fix, staging deployment (or grounded blocker),
and post-deployment smoke.

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
- [ ] Clean-DB migration proof (requires closing the lineage gap per Option A / B / C in the diagnosis).
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

### Phase 0 root-cause fixes landed

| ID | Class | File / change | Evidence |
|----|-------|---------------|----------|
| PH0-FIX-001 | Migration defect | New forward migration `packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql` restores the FK and idempotent statements that 0010 skipped because of the invalid `ADD CONSTRAINT IF NOT EXISTS` clause. | Applied locally with `psql -v ON_ERROR_STOP=1`; `pilot_alerts_rule_fk` now present. |
| PH0-FIX-002 | Migration workflow gap | New governed runner `tooling/scripts/apply-platform-migrations.mjs`. Discovers all 34 platform SQL files by 4-digit prefix, applies each in its own transaction, records SHA-256 in a dedicated `drizzle.__platform_migrations` tracking table (isolated from drizzle-kit and from the Union Eyes scoped bootstrap), and exposes `--check` / `--verify` / `--baseline` modes. | `[migrate] discovered 34 SQL files; 34 hashes already recorded; 0 pending.` after `--baseline` on dev DB; re-run in default mode confirms `[migrate] All migrations already applied.` (see `migration-baseline-dev.log`). |

### Phase 0 open items (must close before scenario graduation)

| ID | Class | Description | Status | Owner |
|----|-------|-------------|--------|-------|
| PH0-OPEN-001 | Migration lineage gap | `orgs`, `commerce_*`, and other schema-only tables are not created by any file in `packages/db/drizzle/*.sql`. Fresh DBs cannot be provisioned from source alone. Options A / B / C detailed in `cupe-national-phase-0/migration-lineage-gap.md`. Decision required from Aubert. | **Open — decision pending** | Aubert (decision), Phase 0 (implementation) |
| PH0-OPEN-002 | Data-model divergence | `pilot_definitions.org_id` references `orgs`; Union Eyes writes org context to `organizations`. Demo org `11111111-1111-4111-8111-111111111111` exists in `organizations` but not in `orgs`. Diagnosis complete (bounded contexts, shared-UUID convention). Fix: seed missing `orgs` row for E2E demo tenant + contract test enforcing "every Union-Eyes-active organizations row must have a matching orgs row". | **Open — fix specified** | Phase 0 |
| PH0-OPEN-003 | Stale expectation | [apps/union-eyes/lib/db-validator.ts](../../apps/union-eyes/lib/db-validator.ts) hardcodes `users` as a critical table. Current schema has no `users` table. | **Open** | Phase 1 |
| PH0-OPEN-004 | Environment defect | Playwright `beforeAll` timeout is 60 s; Windows Turbopack cold start regularly exceeds that. Requires deterministic lifecycle (readiness endpoint) + separated server-start / test timeouts. | **Open** | Phase 0 |
| PH0-OPEN-005 | Seed defect (hypothesis) | Untracked file `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` uses a `kpi_…` string identifier. Any code path that inserts this identifier into a `uuid` column (candidate: `kpi_configurations.id`) will produce the runtime error `invalid input syntax for type uuid: "kpi_mrwhcp4b_d2f72515a580"`. | **Open** | Phase 0 |

### Phase 0 closure classification (this session)

`AMBER — INCOMPLETE`.

* §3 (migration workflow) is `GREEN` on the runner contracts (no silent skip, fail on error, records applied migrations) but `AMBER` on the clean-DB proof, gated on PH0-OPEN-001.
* §4 (org-model consistency), §5 (KPI id repair), §6 (Playwright lifecycle), §7 (E2E baseline at HEAD), §10 (staging deployment), §11 (post-deploy smoke) remain open.
* No Phase 1 authorization requested. The user (Aubert) is the sole Phase 1 approver.

### Phase 0 non-changes

The following remain untouched:

- The seven CUPE audit registers under [reports/audits/](../../).
- All Union Eyes product code, routes, actions, and FSM under `apps/union-eyes/`.
- All 32 historical migrations `packages/db/drizzle/0000_*` through `0032_*`.
- 31 unrelated dirty lines in the working tree (governance drift, ops KPI snapshots, docs). They must not enter any Phase 0 commit.

---

## Phase 1 – 10

Not started. Sections will be added at authorization time.
