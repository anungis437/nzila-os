# CUPE National — Phase Ledger

Single source of truth for phase progression. Updated at the close of each phase.

## Phase 0 — Baseline Stabilization

**Status:** `IN_PROGRESS — CHECKPOINT 2349d497b · Phase 0A closed AMBER 2026-07-23 · Phase 0A.1 closed GREEN 2026-07-23`
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

**Phase 0A.1 · Historical Migration Healer Closure (2026-07-23):** closed
`GREEN — MIGRATION LINEAGE CLOSED`. All three Phase 0A defects (PH0-OPEN-006 /
-007 / -008) closed by healers 0034 / 0035 / 0036 (PH0-FIX-005 / -006 / -007).
An unforeseen fourth defect chain (PH0-OPEN-010, in 0010 cascading into 0033)
was surfaced by the PG 14+ implicit-transaction root-cause finding and closed
by healer 0037 (PH0-FIX-008) with full disclosure. Empty-DB replay of baseline
plus 34 historical incrementals plus 4 healers succeeds end-to-end;
`--verify` exits 0; idempotent second run applies zero pending. Details in
[cupe-national-phase-0/migration-validation-summary.md § 8](cupe-national-phase-0/migration-validation-summary.md),
[cupe-national-phase-0/migration-healer-design.md](cupe-national-phase-0/migration-healer-design.md),
[cupe-national-phase-0/migration-healer-statement-map.md](cupe-national-phase-0/migration-healer-statement-map.md).

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
- [x] **Phase 0A.1 — historical migration healer closure** via `packages/db/drizzle/0034_heal_orchestrator_runtime_hardening.sql`, `0035_heal_trustcore_law25_chain.sql`, `0036_heal_audit_events_canonical_hash.sql`, `0037_heal_pilot_alerting_hardening.sql`; allowlist expanded to 7 entries; runner tracking-table extended with `partial` / `sqlstate` / `error_signature` / `statement_location` / `healer_filename` / `outcome_class`; empty-DB replay of baseline + 34 historical + 4 healers succeeds end-to-end; `--verify` exits 0; idempotent second run applies zero pending. See [cupe-national-phase-0/migration-validation-summary.md § 8](cupe-national-phase-0/migration-validation-summary.md) and [cupe-national-phase-0/migration-healer-design.md](cupe-national-phase-0/migration-healer-design.md).
- [x] Clean-DB migration proof of the full historical chain — completed under Phase 0A.1 (see above); previously blocked by PH0-OPEN-006 / -007 / -008 which are now CLOSED (PH0-FIX-005 / -006 / -007) plus one unforeseen additional defect closed (PH0-OPEN-010 / PH0-FIX-008).
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
| **Phase 0A.1 healer — orchestrator runtime hardening** | [packages/db/drizzle/0034_heal_orchestrator_runtime_hardening.sql](../../packages/db/drizzle/0034_heal_orchestrator_runtime_hardening.sql) |
| **Phase 0A.1 healer — trustcore Law 25 chain** | [packages/db/drizzle/0035_heal_trustcore_law25_chain.sql](../../packages/db/drizzle/0035_heal_trustcore_law25_chain.sql) |
| **Phase 0A.1 healer — audit_events canonical hash** | [packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql](../../packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql) |
| **Phase 0A.1 healer — pilot alerting hardening chain** | [packages/db/drizzle/0037_heal_pilot_alerting_hardening.sql](../../packages/db/drizzle/0037_heal_pilot_alerting_hardening.sql) |
| **Phase 0A.1 healer design + PG 14+ root-cause finding** | [cupe-national-phase-0/migration-healer-design.md](cupe-national-phase-0/migration-healer-design.md) |
| **Phase 0A.1 per-statement source→healer map** | [cupe-national-phase-0/migration-healer-statement-map.md](cupe-national-phase-0/migration-healer-statement-map.md) |
| **Phase 0A.1 clean-DB replay log (bootstrap + 34 historical + 4 healers → --verify exit 0)** | [cupe-national-phase-0/migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log) |
| **Phase 0A.1 idempotent second-run log (0 pending; --verify exit 0)** | [cupe-national-phase-0/migration-healer-idempotency.log](cupe-national-phase-0/migration-healer-idempotency.log) |
| **Phase 0A.1 tracking-table witness (38 rows on `drizzle.__platform_migrations`)** | [cupe-national-phase-0/migration-tracking-witness.txt](cupe-national-phase-0/migration-tracking-witness.txt) |
| **Phase 0A.1 post-heal schema witness (tables / enums / columns / constraints)** | [cupe-national-phase-0/migration-schema-comparison.txt](cupe-national-phase-0/migration-schema-comparison.txt) |
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
| PH0-FIX-005 | Historical healer — orchestrator runtime hardening (Phase 0A.1) | New forward healer `packages/db/drizzle/0034_heal_orchestrator_runtime_hardening.sql`. Closes PH0-OPEN-006. Fully restores everything `0013_orchestrator_runtime_hardening.sql` was to apply on `automation_commands` (9 columns + backfill + guarded NOT NULL flips + DROP CONSTRAINT for the misnamed UNIQUE + 5 indexes) and `automation_events` (org_id + backfill + guarded NOT NULL + 2 indexes). Idempotent; wrapped in single BEGIN/COMMIT. | Applied on empty probe DB `nzila_phase0a1_probe`; witness in [migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log), [migration-tracking-witness.txt](cupe-national-phase-0/migration-tracking-witness.txt), [migration-schema-comparison.txt](cupe-national-phase-0/migration-schema-comparison.txt). |
| PH0-FIX-006 | Historical healer — trustcore Law 25 chain (Phase 0A.1) | New forward healer `packages/db/drizzle/0035_heal_trustcore_law25_chain.sql`. Closes PH0-OPEN-007. Fully restores the 14 `tc_*` enums (via `DO $$ EXCEPTION WHEN duplicate_object $$` blocks), 8 `trustcore_*` tables that `0017_trustcore_law25.sql` was to create, the `onboarding_completed_at` / `org_name` columns from `0025_trustcore_privacy_programs_org_name.sql`, and the `tc_policy_type` enum + `trustcore_policies` table + 2 indexes from `0019_trustcore_policies.sql`. Idempotent. | Same replay evidence as PH0-FIX-005; 16 `trustcore_*` tables present incl. `trustcore_policies`; `tc_policy_type` enum present in `pg_type` list. |
| PH0-FIX-007 | Historical healer — audit_events canonical hash (Phase 0A.1) | New forward healer `packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql`. Closes PH0-OPEN-008. Fully restores `audit_events.occurred_at` (NOT NULL, `DEFAULT now()`), `audit_events.hash_version` (NOT NULL, `DEFAULT 'linkage-only-v0'`), `audit_events.org_id uuid` (added + backfilled + guarded FK to `orgs(id)` + guarded NOT NULL flip), plus `audit_events_org_occurred_idx`, plus a runtime assertion of the 14 canonical hash columns. Idempotent. | Same replay evidence as PH0-FIX-005; `audit_events` columns and `audit_events_org_id_orgs_id_fk` constraint verified in [migration-schema-comparison.txt](cupe-national-phase-0/migration-schema-comparison.txt). |
| PH0-FIX-008 | Historical healer — pilot alerting hardening chain (Phase 0A.1) | New forward healer `packages/db/drizzle/0037_heal_pilot_alerting_hardening.sql`. Closes new defect PH0-OPEN-010. Fully restores 21 `pilot_alerts` columns from the parser-rejected `0010_pilot_alerting_hardening.sql`, creates `pilot_alert_rules` and `pilot_alert_escalations`, adds the `pilot_alerts_rule_fk` FK behind a `DO $$ EXCEPTION $$` guard (superseding what `0033_fix_pilot_alerts_rule_fk.sql` was to do on an empty DB), and adds dedup / correlation / partial-open-dedup / rules-severity / escalations indexes. Idempotent. | Same replay evidence as PH0-FIX-005; `pilot_alerts` has 32 columns (11 base + 21 restored), `pilot_alert_rules` + `pilot_alert_escalations` present, `pilot_alerts_rule_fk` present. |
| PH0-FIX-009 | Runner enforcement hardening (Phase 0A.1) | `tooling/scripts/apply-platform-migrations.mjs` extended: `drizzle.__platform_migrations` gains `partial` (bool), `sqlstate` (text), `error_signature` (text), `statement_location` (text), `healer_filename` (text), `outcome_class` (text) via `ADD COLUMN IF NOT EXISTS` for backward compatibility. Every applied migration records outcome class; every allowlisted partial requires a matching healer filename in the allowlist AND that healer file must exist on disk. `--verify` refuses to succeed unless every allowlisted partial in the tracking table is paired with an applied healer with `outcome_class = 'full-success'`. | `--verify` on healed probe DB exits 0 (see [migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log)); idempotent re-verify also exits 0 (see [migration-healer-idempotency.log](cupe-national-phase-0/migration-healer-idempotency.log)). |

### Phase 0 open items (must close before scenario graduation)

| ID | Class | Description | Status | Owner |
|----|-------|-------------|--------|-------|
| PH0-OPEN-001 | Migration lineage gap | `orgs`, `commerce_*`, and other schema-only tables are not created by any file in `packages/db/drizzle/*.sql`. Fresh DBs cannot be provisioned from source alone. Options A / B / C detailed in `cupe-national-phase-0/migration-lineage-gap.md`. Decision required from Aubert. | **CLOSED — 2026-07-23 (Phase 0A · Option A)** — see PH0-FIX-003 + PH0-FIX-004 | Phase 0A |
| PH0-OPEN-002 | Data-model divergence | `pilot_definitions.org_id` references `orgs`; Union Eyes writes org context to `organizations`. Demo org `11111111-1111-4111-8111-111111111111` exists in `organizations` but not in `orgs`. Diagnosis complete (bounded contexts, shared-UUID convention). Fix: seed missing `orgs` row for E2E demo tenant + contract test enforcing "every Union-Eyes-active organizations row must have a matching orgs row". | **Open — fix specified** | Phase 0 |
| PH0-OPEN-003 | Stale expectation | [apps/union-eyes/lib/db-validator.ts](../../apps/union-eyes/lib/db-validator.ts) hardcodes `users` as a critical table. Current schema has no `users` table. | **Open** | Phase 1 |
| PH0-OPEN-004 | Environment defect | Playwright `beforeAll` timeout is 60 s; Windows Turbopack cold start regularly exceeds that. Requires deterministic lifecycle (readiness endpoint) + separated server-start / test timeouts. | **Open** | Phase 0 |
| PH0-OPEN-005 | Seed defect (hypothesis) | Untracked file `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` uses a `kpi_…` string identifier. Any code path that inserts this identifier into a `uuid` column (candidate: `kpi_configurations.id`) will produce the runtime error `invalid input syntax for type uuid: "kpi_mrwhcp4b_d2f72515a580"`. | **Open** | Phase 0 |
| PH0-OPEN-006 | Historical migration defect (surfaced by Phase 0A) | `packages/db/drizzle/0013_orchestrator_runtime_hardening.sql` line 34 uses `DROP INDEX IF EXISTS "automation_commands_correlation_id_unique"` on an object that is actually a **UNIQUE CONSTRAINT** created by `0003_redundant_starfox.sql`. Under PostgreSQL 14+ implicit-transaction wrapping, the runtime error rolls back ALL statements in the file (Phase 0A's "commits 8 ADD COLUMNs first" claim was accurate only on the pre-populated dev DB). Cascades into PH0-OPEN-008 on empty DBs. Repro + evidence in [migration-clean-run.log](cupe-national-phase-0/migration-clean-run.log), diagnosis in [migration-lineage-gap.md § 4](cupe-national-phase-0/migration-lineage-gap.md#ph0-open-006--0013_orchestrator_runtime_hardeningsql). | **CLOSED — 2026-07-23 (Phase 0A.1) — see PH0-FIX-005** | Phase 0A.1 |
| PH0-OPEN-007 | Historical migration defect (surfaced by Phase 0A) | `packages/db/drizzle/0017_trustcore_law25.sql` line 1 uses `CREATE TYPE IF NOT EXISTS`, which PostgreSQL does not support. Parser rejects the file, so nothing commits. Cascades into `0019_trustcore_policies.sql` (SQLSTATE 42P01) and `0025_trustcore_privacy_programs_org_name.sql` (SQLSTATE 42P01) on empty DBs. Repro + diagnosis in [migration-lineage-gap.md § 4](cupe-national-phase-0/migration-lineage-gap.md#ph0-open-007--0017_trustcore_law25sql). | **CLOSED — 2026-07-23 (Phase 0A.1) — see PH0-FIX-006** | Phase 0A.1 |
| PH0-OPEN-008 | Historical migration defect (surfaced by Phase 0A) | `packages/db/drizzle/0032_audit_events_canonical_hash.sql` line 43 fails with `column "org_id" does not exist`. Under PG 14+ wrapping the failure also rolls back the preceding `ADD COLUMN occurred_at` / `ADD COLUMN hash_version` statements on empty DBs. Requires healer with `ADD COLUMN IF NOT EXISTS occurred_at / hash_version / org_id` + backfill + guarded FK + guarded NOT NULL + index + canonical-hash column assertion. | **CLOSED — 2026-07-23 (Phase 0A.1) — see PH0-FIX-007** | Phase 0A.1 |
| PH0-OPEN-009 | Runner discipline | `.known-partial-failures.json` allowlist has 7 entries (`0010` / `0013` / `0017` / `0019` / `0025` / `0032` / `0033`), each paired with an applied healer verified by the runner. Any future widening must be paired with (a) a linked ledger entry, (b) a matching healer migration in `packages/db/drizzle/`, and (c) runner enforcement that the healer file actually exists AND is recorded as `outcome_class='full-success'`. Periodic review recommended. | **Open — advisory** | Phase 0 / ongoing |
| PH0-OPEN-010 | Historical migration defect (surfaced by Phase 0A.1 root-cause work) | `packages/db/drizzle/0010_pilot_alerting_hardening.sql` uses `ADD CONSTRAINT IF NOT EXISTS` on `pilot_alerts_rule_fk`, which the PostgreSQL parser rejects (SQLSTATE 42601). Under PG 14+ wrapping the entire file rolls back on an empty DB — including the 21 intended `ADD COLUMN` statements on `pilot_alerts`, the `CREATE TABLE pilot_alert_rules`, and the `CREATE TABLE pilot_alert_escalations`. `0033_fix_pilot_alerts_rule_fk.sql` (originally PH0-FIX-001) then fails on empty DBs with SQLSTATE 42P01 because `pilot_alert_rules` does not exist. Invisible in Phase 0A because prior out-of-band `drizzle-kit push` on the dev DB had already materialized `pilot_alert_rules` and the `rule_id` column, so 0033 succeeded on dev-only. | **CLOSED — 2026-07-23 (Phase 0A.1) — see PH0-FIX-008** | Phase 0A.1 |

### Phase 0A closure classification (this session, 2026-07-23)

**`AMBER — MIGRATION LINEAGE INCOMPLETE`**

* The structural **lineage gap** (PH0-OPEN-001) is **CLOSED** by PH0-FIX-003 (baseline SQL + manifest) and PH0-FIX-004 (runner two-phase lifecycle + reconciliation + allowlist).
* All three DB-state scenarios (empty, partial-baseline, fully-materialized) validate the runner contracts.
* The full 34-file empty-DB replay is blocked by three previously-undocumented pre-existing defects (PH0-OPEN-006 / -007 / -008) in files 0013, 0017, and 0032. Each requires a dedicated healer migration in a follow-up phase; the Phase 0A directive explicitly prohibits any change to files 0000–0033, so those healers cannot be authored under this phase.
* Phase 0 as a whole remains open for the residual items (§4 org-model, §5 KPI id, §6 Playwright, §7 E2E, §10 staging, §11 smoke).

### Phase 0A.1 closure classification (this session, 2026-07-23)

**`GREEN — MIGRATION LINEAGE CLOSED`**

* PH0-OPEN-006 CLOSED by PH0-FIX-005 (healer `0034_heal_orchestrator_runtime_hardening.sql`).
* PH0-OPEN-007 CLOSED by PH0-FIX-006 (healer `0035_heal_trustcore_law25_chain.sql`).
* PH0-OPEN-008 CLOSED by PH0-FIX-007 (healer `0036_heal_audit_events_canonical_hash.sql`).
* PH0-OPEN-010 (unforeseen, surfaced by PG 14+ implicit-transaction wrapping finding) CLOSED by PH0-FIX-008 (healer `0037_heal_pilot_alerting_hardening.sql`) — fully disclosed.
* PH0-FIX-009 hardened the runner (`.__platform_migrations` tracking-table columns for partial / sqlstate / error_signature / statement_location / healer_filename / outcome_class; `--verify` enforces healer pairing).
* Empty-DB clean-run: bootstrap-apply → default (38 incrementals · 27 full-success + 4 healer full-success + 7 approved-partial paired) → --verify exit 0.
* Idempotent second run: bootstrap-apply skipped, default 0 pending, --verify exit 0.
* Historical migrations `0000_initial.sql` – `0033_fix_pilot_alerts_rule_fk.sql` remain byte-identical.
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
