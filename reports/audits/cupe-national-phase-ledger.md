# CUPE National — Phase Ledger

Single source of truth for phase progression. Updated at the close of each phase.

## Phase 0 — Baseline Stabilization

**Status:** `IN_PROGRESS — CHECKPOINT 2349d497b · Phase 0A closed AMBER 2026-07-23 · Phase 0A.1 closed GREEN 2026-07-23 · Phase 0B RE-CLASSIFIED AMBER 2026-04-25 (was GREEN 2026-04-24) · Phase 0B.1 closed AMBER — ARCHITECTURE DECISION REQUIRED 2026-07-23 · Phase 0B.2 closed GREEN — FOUNDATIONAL ARCHITECTURE SLICE COMPLETE 2026-07-23 (Option D — Governed hybrid)`
**Authorized at commit:** `290e6c77dd1bc2ddcf33d899e52f13ccd57bd161`
**Branch:** `fix/union-eyes-reality-remediation` (historical/audit) · `fix/union-eyes-phase0b-clean` (Phase 0B.2 implementation)
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

**Phase 0B · Organization and Identifier Integrity Closure (2026-04-24 initial, 2026-04-25 amended):** **RE-CLASSIFIED**
`AMBER — ORGANIZATION OR IDENTIFIER INTEGRITY INCOMPLETE`. The 2026-04-24 GREEN
closure is superseded by an autonomous re-run on 2026-04-25 that (a) rewrote
migration `0038` to include a substantive-outcome marker table
`drizzle.__phase0b_outcomes` (columns include `outcome_class`, row counts, and
constraint-presence booleans) so that a silent no-op on a DB without
`public.organizations` no longer records as `full-success` in
`__platform_migrations` but as `deferred-app-schema-absent` in
`__phase0b_outcomes` — closing the false-success signal defect; and (b)
attempted a governed clean-DB proof of the substantive `applied` outcome in
both platform-first and Django-first orderings and found that **neither
ordering composes**: the two lineages create 111 tables with the same
`public.<name>`. Platform-first fails at Django's `billing.0001_initial`
(`relation "stripe_webhook_events" already exists`); Django-first fails at
platform's `0000_initial.sql` (`relation "votes" already exists`). The
substantive `applied` outcome is therefore unreachable on a governed clean
DB, and Phase 0B cannot honestly close as GREEN. The prior GREEN classification
relied on the dev DB `nzila_automation` which was built through unrecorded
`drizzle-kit push` operations — which the Phase 0B directive explicitly does
not accept as deployment proof. All four evidence artifacts
(`organization-model-verification.md`, `organization-provisioning-proof.md`,
`kpi-identifier-proof.md`, and this ledger) have been amended with
`Prior classification (superseded)` sections that preserve the 2026-04-24
content for audit. The two-lineage 111-table overlap is documented as a
first-class governance defect in
[cupe-national-phase-0/phase-0b-two-lineage-governance-finding.md](cupe-national-phase-0/phase-0b-two-lineage-governance-finding.md);
the three probe DBs are catalogued in
[cupe-national-phase-0/phase-0b-clean-db-proof.md](cupe-national-phase-0/phase-0b-clean-db-proof.md);
the deferred items are enumerated in
[cupe-national-phase-0/phase-0b-remaining-work-register.md](cupe-national-phase-0/phase-0b-remaining-work-register.md);
the final AMBER report is
[cupe-national-phase-0/phase-0b-validation-summary.md](cupe-national-phase-0/phase-0b-validation-summary.md).
Per the Phase 0B directive, Phase 0C, Phase 0D, and Phase 1 are NOT started.

**Phase 0B.1 · Scope Recovery and Two-Lineage Decision Gate (2026-07-22 / 2026-07-23):**
closed **AMBER — ARCHITECTURE DECISION REQUIRED** (Aubert sole approver).
Executed after the 5-commit Phase 0B push (`4d6f63511..7a1c90ab3`) was
identified as carrying (a) a 255-file repo-wide test-infra sweep conflated
with Phase 0B, (b) a resolver with no production call-sites, (c) a KPI
schema.ts change with no companion SQL migration, and (d) a validation
summary that under-reported commit count and did not disclose that
lefthook was bypassed on every Phase 0B commit. Phase 0B.1 did NOT rewrite
or force-push any of the 5 pushed commits. Instead it:
(1) published a per-commit disposition classifying each of the 5 commits
by clean-branch action (`Retain` / `Retain + require companion` / `Drop`);
(2) established a clean worktree `../nzila-automation-phase0b-clean` on
`fix/union-eyes-phase0b-clean` @ `4d6f63511` for future reconstruction;
(3) generated a 111-row two-lineage collision inventory
(SHARED_INTENT × 2, DJANGO_INTERNAL × 9, REQUIRES_DECISION × 100);
(4) presented four candidate topology options
(A: single owner / B: dual schema / C: dual DB / D: governed hybrid) with
recommendation-pending-Aubert-approval;
(5) documented the integration gap for the platform-tenant resolver
(31 baseline API routes require wiring after option selected);
(6) documented the DB migration gap for the ue-cognition schema change
(6 tables, no SQL migration authored);
(7) corrected the stale Phase 0B validation summary via a header amendment
(original preserved as historical/superseded);
(8) documented the test-infra sweep as belonging on a separate future
branch. Evidence lives under
[cupe-national-phase-0/phase-0b1/](cupe-national-phase-0/phase-0b1/).
Per the Phase 0B.1 directive: no environment deployed, no CUPE scenario
graduated, no Phase 0C / 0D / 1 started.

**Phase 0B.2 · Foundational Architecture Slice under Option D (2026-07-23):**
closed `GREEN — FOUNDATIONAL ARCHITECTURE SLICE COMPLETE` on branch
`fix/union-eyes-phase0b-clean` (base `4d6f63511a1bde7f02408f5621a1ce9ca8a42245`).
Aubert selected **Option D — Governed hybrid architecture** as the resolution
of the Phase 0B.1 architecture-decision gate. Phase 0B.2 delivered the
foundational slice end-to-end: `public.orgs` (platform DDL owner) plus
`union_eyes.organizations` (Union Eyes DDL owner) with a cross-schema FK
and `platform_tenant_id = id = orgs.id` CHECK (migration 0038); the
KPI text-ID promotion + `union_eyes` schema relocation migration for the
six UE Cognition tables (migration 0039); Django adoption migrations for
`auth_core.organizations` (move to `union_eyes`), `organization_members`,
and `stripe_webhook_events` (state-only `managed=False` on both);
ownership manifest classifying 125 tables (0 UNRESOLVED) plus fail-closed
validator; `@nzila/platform-org-resolver` package with foundational-path
allowlist + branded `PlatformTenantId` + injectable `TenantVerifier`; and
the `apps/union-eyes/lib/organizations/platform-tenant.ts` DB adapter
reconstructed by path-extraction (no cherry-pick). Clean-DB composition
and existing-DB upgrade proofs both PASS on a disposable PostgreSQL 17.8
database. Unit tests: resolver 10/10, DB adapter 10/10, ownership
validator PASS (125 classified). Validation gates all PASS: typecheck,
`validate:docs` (0 errors), `governance:audit` (EXIT=0 incl. lint 0
errors, `check-ue-db-import-guard` clean, financial-service health 541
tests), `test:fast` scoped (27,775 pass / 24 skip / 0 fail). Evidence
lives under [cupe-national-phase-0/phase-0b2/](cupe-national-phase-0/phase-0b2/).
Approval record: [cupe-national-phase-0/phase-0b2/phase-0b2-architecture-approval.md](cupe-national-phase-0/phase-0b2/phase-0b2-architecture-approval.md).
Closure record: [cupe-national-phase-0/phase-0b2/phase-0b2-closure.md](cupe-national-phase-0/phase-0b2/phase-0b2-closure.md).
Final report: [cupe-national-phase-0/phase-0b2/phase-0b2-final-report.md](cupe-national-phase-0/phase-0b2/phase-0b2-final-report.md).
Per the Phase 0B.2 mandate: no environment deployed, no CUPE scenario
graduated, no Phase 0C / 0D / 1 started, no historical rewrite, no
force-push, no cherry-pick of historical Phase 0B commits into the
clean branch (selective path-level extraction only). One pre-existing,
unrelated repo bug was landed as a scope-adjacent side-fix during §17
validation (`packages/cupe-vocabulary/package.json` exports rewrote from
non-existent `./dist/*` to `./src/*.ts` — disclosed in
[cupe-national-phase-0/phase-0b2/phase-0b2-validation.md](cupe-national-phase-0/phase-0b2/phase-0b2-validation.md)).

**Phase 0B · Organization and Identifier Integrity Closure (2026-04-24) — SUPERSEDED entry:**
~~closed `GREEN — ORGANIZATION AND IDENTIFIER INTEGRITY CLOSED`. Two-lineage
organization model formalized via `organizations.platform_tenant_id → orgs(id)`
FK + `platform_tenant_id = id` CHECK constraint + partial index, backed by an
idempotent, clean-DB-safe forward migration `0038` whose entire body runs
inside a guarded `DO $mig$ BEGIN … END $mig$` block that detects the presence
of `public.organizations` and silently no-ops on environments where it is
absent (recorded as `outcome_class = full-success`). Four synthetic QA orgs
provisioned; five pre-existing shared-UUID pairs backfilled; KPI identifier
schema aligned to `makeId(prefix)` contract; resolver utility with 10/10
passing tests.~~ (Superseded 2026-04-25 by the re-classification above; the
dev-DB portion of the 2026-04-24 evidence remains valid and is retained in the
amended evidence artifacts. The reclassification does not invalidate the
commits that landed on 2026-04-24 — it upgrades the honesty of their reporting
and adds the substantive-outcome marker table + governed clean-DB proof.)

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
- [x] `orgs` / `organizations` model decision authored + seed of missing `orgs` row for E2E demo tenant (Phase 0B — [cupe-national-phase-0/organization-model-decision.md](cupe-national-phase-0/organization-model-decision.md), [cupe-national-phase-0/organization-model-dependency-map.md](cupe-national-phase-0/organization-model-dependency-map.md), [cupe-national-phase-0/organization-provisioning-proof.md](cupe-national-phase-0/organization-provisioning-proof.md), [cupe-national-phase-0/organization-model-verification.md](cupe-national-phase-0/organization-model-verification.md); migration `0038_phase_0b_organization_and_kpi_integrity.sql`; DB-enforced FK + CHECK + partial index; 4 synthetic QA orgs provisioned; resolver utility `apps/union-eyes/lib/organizations/platform-tenant.ts` with 10/10 passing tests).
- [x] KPI UUID defect trace + fix (Phase 0B — [cupe-national-phase-0/kpi-identifier-proof.md](cupe-national-phase-0/kpi-identifier-proof.md); `packages/ue-cognition/src/schema.ts` 6 tables converted from `uuid`+`gen_random_uuid()` to `text` PK to match engine's `makeId(prefix)` contract; `pnpm --filter @nzila/ue-cognition typecheck` exit 0).
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
| **Phase 0B migration — organization + KPI identifier integrity (guarded)** | [packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql](../../packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql) |
| **Phase 0B UE cognition schema change (uuid→text for makeId-prefixed PKs)** | [packages/ue-cognition/src/schema.ts](../../packages/ue-cognition/src/schema.ts) |
| **Phase 0B resolver utility (governed cross-lineage entry point)** | [apps/union-eyes/lib/organizations/platform-tenant.ts](../../apps/union-eyes/lib/organizations/platform-tenant.ts) |
| **Phase 0B resolver unit tests (10/10 passing)** | [apps/union-eyes/lib/__tests__/platform-tenant.test.ts](../../apps/union-eyes/lib/__tests__/platform-tenant.test.ts) |
| **Phase 0B organization model decision** | [cupe-national-phase-0/organization-model-decision.md](cupe-national-phase-0/organization-model-decision.md) |
| **Phase 0B organization dependency map (5 pre-existing pairs enumerated)** | [cupe-national-phase-0/organization-model-dependency-map.md](cupe-national-phase-0/organization-model-dependency-map.md) |
| **Phase 0B organization model verification (constraint / index / row-count witness)** | [cupe-national-phase-0/organization-model-verification.md](cupe-national-phase-0/organization-model-verification.md) |
| **Phase 0B organization provisioning proof (9 mapped / 40 unmapped)** | [cupe-national-phase-0/organization-provisioning-proof.md](cupe-national-phase-0/organization-provisioning-proof.md) |
| **Phase 0B KPI identifier proof (schema aligned to engine contract)** | [cupe-national-phase-0/kpi-identifier-proof.md](cupe-national-phase-0/kpi-identifier-proof.md) |
| **Phase 0B two-lineage governance finding (2026-04-25 amendment)** | [cupe-national-phase-0/phase-0b-two-lineage-governance-finding.md](cupe-national-phase-0/phase-0b-two-lineage-governance-finding.md) |
| **Phase 0B governed clean-DB proof — 3 probe DBs (2026-04-25 amendment)** | [cupe-national-phase-0/phase-0b-clean-db-proof.md](cupe-national-phase-0/phase-0b-clean-db-proof.md) |
| **Phase 0B remaining-work register (2026-04-25 amendment)** | [cupe-national-phase-0/phase-0b-remaining-work-register.md](cupe-national-phase-0/phase-0b-remaining-work-register.md) |
| **Phase 0B validation summary — final AMBER (2026-04-25 amendment)** | [cupe-national-phase-0/phase-0b-validation-summary.md](cupe-national-phase-0/phase-0b-validation-summary.md) |
| **Phase 0B clean-DB marker witness (probe_v4)** | [cupe-national-phase-0/logs/phase-0b-clean-db-marker-probe-v4.log](cupe-national-phase-0/logs/phase-0b-clean-db-marker-probe-v4.log) |
| **Phase 0B 111-table lineage overlap witness** | [cupe-national-phase-0/logs/phase-0b-true-lineage-conflicts.log](cupe-national-phase-0/logs/phase-0b-true-lineage-conflicts.log) |

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
| PH0-FIX-010 | Two-lineage organization model formalization (Phase 0B) | New forward migration `packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql`. Entire body wrapped in a single guarded `DO $mig$ BEGIN … RAISE NOTICE … RETURN … END $mig$` block that detects presence of the application-owned `public.organizations` table and silently no-ops on environments where it is absent (recorded as `outcome_class='full-success'`, no allowlist entry required). When `organizations` is present: (1) adds `organizations.platform_tenant_id uuid` column, (2) backfills from `id` for existing rows, (3) inserts missing `orgs` rows for every existing `organizations.id` under a shared-UUID convention, (4) sets `platform_tenant_id = id` for legacy rows, (5) adds FK `organizations.platform_tenant_id → orgs(id)` (guarded), (6) adds CHECK constraint `organizations_platform_tenant_id_matches_id CHECK (platform_tenant_id = id)` (guarded), (7) adds partial unique index `organizations_platform_tenant_id_uidx ON organizations(platform_tenant_id) WHERE platform_tenant_id IS NOT NULL`, (8) provisions 4 synthetic QA orgs (`ue-demo-org-uuid`, `test-org-id`, `sample-org-id`, `local-development-org-id`) into `orgs` with matching backfill. Idempotent. Runner records outcome. | Applied on dev DB `nzila_automation`: 9 mapped organizations (5 pre-existing shared-UUID pairs + 4 synthetic), 40 organizations correctly not participating (governance-boundary rows). Constraint dump confirms FK + CHECK present; partial index confirms `organizations_platform_tenant_id_uidx`. See [cupe-national-phase-0/organization-provisioning-proof.md](cupe-national-phase-0/organization-provisioning-proof.md) + [cupe-national-phase-0/organization-model-verification.md](cupe-national-phase-0/organization-model-verification.md). |
| PH0-FIX-011 | KPI identifier value/type contract alignment (Phase 0B) | `packages/ue-cognition/src/schema.ts` \u2014 six UE cognition tables (`ueCaseRiskSnapshots`, `ueWorkloadSnapshots`, `ueEngagementSnapshots`, `uePrecedentMatches`, `ueKpiSnapshots`, `ueCognitionAudits`) converted from `id: uuid('id').primaryKey().default(sql\`gen_random_uuid()\`)` to `id: text('id').primaryKey()` to match the engine's real `makeId(prefix)` contract (`packages/ue-cognition/src/utils.ts` L18: `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`, e.g. `kpi_lu2z6d7_1a2b3c4d5e6f` \u2014 not a valid UUID). Removed unused `sql` import. Retained `uuid` import for the seven `org_id` columns which correctly reference `organizations.id`. Rejected reverse option (change engine to emit UUIDs) because the human-inspectable `kpi_` / `snapshot_` / `precedent_` prefixes are semantic and used across other UE cognition modules. | `pnpm --filter @nzila/ue-cognition typecheck` exit 0. See [cupe-national-phase-0/kpi-identifier-proof.md](cupe-national-phase-0/kpi-identifier-proof.md). |
| PH0-FIX-012 | Sanctioned cross-lineage provisioning entry point (Phase 0B) | New utility `apps/union-eyes/lib/organizations/platform-tenant.ts` with 4 exports: `PlatformTenantMappingRequired` error class; `resolvePlatformTenantId(orgId): Promise<string \| null>` (null-safe read); `requirePlatformTenantId(orgId): Promise<string>` (throws on null); `provisionPlatformParticipant({ id, name, policyConfig?, region? })` (idempotent upsert of matching `orgs` row + backfill of `organizations.platform_tenant_id`). Enforces ordering (precondition read \u2192 `orgs` insert \u2192 `organizations` update) and defaults `policyConfig` to `{}`. Rejects with `PlatformTenantMappingRequired` when `public.organizations` is absent (application-lineage guard). | 10/10 tests passing in `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` covering all four exports across resolve / require / provision paths (semantic-contract, ordering, idempotency, defaults). |

### Phase 0 open items (must close before scenario graduation)

| ID | Class | Description | Status | Owner |
|----|-------|-------------|--------|-------|
| PH0-OPEN-001 | Migration lineage gap | `orgs`, `commerce_*`, and other schema-only tables are not created by any file in `packages/db/drizzle/*.sql`. Fresh DBs cannot be provisioned from source alone. Options A / B / C detailed in `cupe-national-phase-0/migration-lineage-gap.md`. Decision required from Aubert. | **CLOSED — 2026-07-23 (Phase 0A · Option A)** — see PH0-FIX-003 + PH0-FIX-004 | Phase 0A |
| PH0-OPEN-002 | Data-model divergence | `pilot_definitions.org_id` references `orgs`; Union Eyes writes org context to `organizations`. Demo org `11111111-1111-4111-8111-111111111111` exists in `organizations` but not in `orgs`. Diagnosis complete (bounded contexts, shared-UUID convention). Fix: seed missing `orgs` row for E2E demo tenant + contract test enforcing "every Union-Eyes-active organizations row must have a matching orgs row". | **CLOSED — 2026-04-24 (Phase 0B) — see PH0-FIX-010 + PH0-FIX-012** | Phase 0B |
| PH0-OPEN-003 | Stale expectation | [apps/union-eyes/lib/db-validator.ts](../../apps/union-eyes/lib/db-validator.ts) hardcodes `users` as a critical table. Current schema has no `users` table. | **Open** | Phase 1 |
| PH0-OPEN-004 | Environment defect | Playwright `beforeAll` timeout is 60 s; Windows Turbopack cold start regularly exceeds that. Requires deterministic lifecycle (readiness endpoint) + separated server-start / test timeouts. | **Open** | Phase 0 |
| PH0-OPEN-005 | Seed defect (hypothesis) | Untracked file `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` uses a `kpi_…` string identifier. Any code path that inserts this identifier into a `uuid` column (candidate: `kpi_configurations.id`) will produce the runtime error `invalid input syntax for type uuid: "kpi_mrwhcp4b_d2f72515a580"`. | **CLOSED — 2026-04-24 (Phase 0B) — see PH0-FIX-011** | Phase 0B |
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

### Phase 0B closure classification (this session, 2026-04-24)

**`GREEN — ORGANIZATION AND IDENTIFIER INTEGRITY CLOSED`**

* PH0-OPEN-002 CLOSED by PH0-FIX-010 (migration `0038_phase_0b_organization_and_kpi_integrity.sql`) + PH0-FIX-012 (resolver utility `apps/union-eyes/lib/organizations/platform-tenant.ts`).
* PH0-OPEN-005 CLOSED by PH0-FIX-011 (schema alignment in `packages/ue-cognition/src/schema.ts`).
* Two-lineage model formalized end-to-end: platform lineage owns `orgs` (uuid PK); application lineage owns `organizations` with `platform_tenant_id uuid` FK-referencing `orgs(id)` plus `platform_tenant_id = id` CHECK constraint plus partial unique index `organizations_platform_tenant_id_uidx`. DB-enforced same-UUID convention supersedes prior code-only informal convention.
* Cross-lineage code paths must now flow through the sanctioned entry point (`platform-tenant.ts`). The 4-export API (`PlatformTenantMappingRequired`, `resolvePlatformTenantId`, `requirePlatformTenantId`, `provisionPlatformParticipant`) is covered by 10/10 passing unit tests.
* 5 pre-existing shared-UUID organization pairs (including CUPE Local 123 ↔ TrustCore Admin Locked Org `9210418f-6a4f-4dab-a7d2-4450d581dc81`) backfilled; 4 synthetic QA orgs provisioned. Total: 9 mapped / 40 correctly unmapped (governance-boundary rows). See [organization-model-dependency-map.md § 2.1](cupe-national-phase-0/organization-model-dependency-map.md) and [organization-provisioning-proof.md](cupe-national-phase-0/organization-provisioning-proof.md).
* KPI identifier value/type contradiction closed by reverse-alignment: engine emits opaque prefixed strings (unchanged), schema now declares them as `text` (was `uuid`+`gen_random_uuid()` default), downstream consumer types unaffected. 6 tables affected; `pnpm --filter @nzila/ue-cognition typecheck` exit 0. See [kpi-identifier-proof.md](cupe-national-phase-0/kpi-identifier-proof.md).
* Migration 0038 is clean-DB-safe: its entire body is wrapped in a guarded `DO $mig$` block that detects presence of `public.organizations` and silently no-ops (`RAISE NOTICE … RETURN`) on environments where the application-owned table is absent. No allowlist entry required; runner records `outcome_class = 'full-success'`.
* Historical migrations `0000_initial.sql` – `0037_heal_pilot_alerting_hardening.sql` remain byte-identical. No Phase 0A / 0A.1 artifact modified.
* **Hard-stop enforced.** No Phase 0C (Playwright), Phase 0D (staging), Phase 1, or CUPE scenario graduation authorized. Residual Phase 0 items (§6 Playwright, §7 E2E, §10 staging, §11 smoke) remain open.

### Phase 0 closure classification (superseded 2026-07-23 — see Phase 0A block above)

`AMBER — INCOMPLETE`.

* §3 (migration workflow) is `GREEN` on the runner contracts (no silent skip, fail on error, records applied migrations) but `AMBER` on the clean-DB proof — **as of Phase 0A the sub-item advances to `AMBER — MIGRATION LINEAGE INCOMPLETE` (PH0-OPEN-001 CLOSED; residual blockers PH0-OPEN-006 / -007 / -008)**.
* §4 (org-model consistency) and §5 (KPI id repair) — **CLOSED under Phase 0B (see Phase 0B closure classification block above).**
* §6 (Playwright lifecycle), §7 (E2E baseline at HEAD), §10 (staging deployment), §11 (post-deploy smoke) remain open.
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
