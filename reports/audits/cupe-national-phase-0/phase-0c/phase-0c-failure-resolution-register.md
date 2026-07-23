# Phase 0C — Failure Resolution Register

**Status:** Phase 0C.1 partial closure. See per-FR statuses below. Governed
E2E lifecycle infra landed (`phase-0c-lifecycle-design.md` §5, §7, §9, §11);
migration-pipeline defect (`phase-0c1-migration-pipeline-blocker.md`) blocks
§14 authoritative baseline — full FR-01/02/03 verification carries over to
Phase 0D per AMBER-INFRA-INCOMPLETE closure.

> **AMENDMENT — 2026-07-23 (Phase 0C.2 §3 phase-ownership correction).**
>
> Every "carries over to Phase 0D" / "Phase 0D scope" / "Phase 0D handoff"
> reference in this register is **superseded**. Read every such reference
> as "carries over to Phase 0C.2" / "Phase 0C.2 scope" / "Phase 0C.2
> handoff". The residual work for FR-01, FR-02, FR-03, and FR-06 remains
> **Phase 0C** work and must complete on this same branch before Phase 0C
> can be closed as GREEN.
>
> Phase 0D staging deployment is not authorised until Phase 0C.2
> achieves GREEN closure per the Phase 0C.2 mandate.
>
> The historical wording below is preserved verbatim for audit fidelity
> — no FR row bodies have been rewritten.

## FR-01 — Auth-required tests fail at `helpers/auth.ts:77 toHaveURL(...) 5000ms timeout`

- **Category:** INFRASTRUCTURE_BLOCKED
- **Blast radius:** All ~135 auth-required tests (every test that calls `gotoDashboardAsRole` or navigates to `/dashboard/**`)
- **Root cause:** `seed-test-env.ts` was never invoked before Playwright started, so `auth_users` / `organization_members` are empty. Cookie-mode auth (`nzila_session=ue-seed-session-{userId}`) is accepted but resolves to a user with no organization membership, no role, no landing. The `/dashboard` shell renders but never redirects to `/dashboard/inbox` (member) or `/dashboard/admin/organizations` (admin), etc.
- **Repair (specified in `phase-0c-lifecycle-design.md`):**
  - §5 lifecycle command runs seed BEFORE Playwright starts.
  - §8 seed contract asserts all `UE_TEST_USERS` are inserted with correct role + membership + landing preference.
  - §6 readiness endpoint's `auth.fixtures` check refuses to boot Playwright until seed is verified.
- **Repair status:** IMPLEMENTED (infra) / VERIFICATION BLOCKED (baseline).
  - Governed E2E lifecycle orchestrator landed
    (`apps/union-eyes/scripts/lifecycle/run.ts`, Tier 3 @ 385613df5).
  - Preflight + `allocateDatabase` + `allocatePort` + `bootServer` +
    `pollReadiness` + `stopServer` + `dropDatabase` +
    `verifyPortRelease` all runtime-verified via tsx dry-run.
  - Seed step is wired (`spawnSync('pnpm exec tsx scripts/seed-test-env.ts')`
    with `QA_TEST_ENV=true` and disposable `DATABASE_URL`) but cannot
    execute because the migration pipeline aborts before the seed step
    (see `phase-0c1-migration-pipeline-blocker.md`).
  - Full FR-01 verification requires the migration blocker to be resolved.
- **Evidence:** `phase-0c-baseline-unmodified-run.log` tests 1, 3, 5, 7, 9, 11, ... (identical stack trace for every role).

## FR-02 — Web server boots with missing critical env vars

- **Category:** INFRASTRUCTURE_BLOCKED
- **Blast radius:** All tests (webServer log warns on every boot)
- **Root cause:** `playwright.config.ts webServer.env` does not export required secrets. Boot log shows: `NEXT_PUBLIC_APP_URL: Required`, `runtime-fail-closed` catalogs 10+ missing secrets (`auth.django.secret`, `crypto.fallback`, `auth.webhook.secret`, `crypto.pii`, `identity.entra.*`, `lineage.*`, `NZILA_MODE`).
- **Repair (specified in `phase-0c-lifecycle-design.md` §5 step 1):**
  - Preflight step validates `.env.test` has all required keys before boot.
  - Boot step exports the env to the child process explicitly.
- **Repair status:** IMPLEMENTED (env module) / SUPERSEDED IN PART.
  - Governed env module landed
    (`apps/union-eyes/scripts/lifecycle/env.ts`, Tier 1 @ 9342b21a0)
    with `loadGovernedE2EEnv` enforcing NODE_ENV=test, non-production URLs,
    all required secrets (AUTH_SECRET, VOTING_SECRET, DJANGO_SECRET_KEY,
    NEXTAUTH_SECRET, DATABASE_URL, E2E_DB_ADMIN_URL) — 13 unit tests.
  - Orchestrator `applyEnvToProcess()` exports validated env before spawn.
  - Playwright `webServer.env` inheritance will be superseded by
    `NZILA_E2E_MANAGED_SERVER=true` handling in playwright.config.ts
    (design spec §11) — DEFERRED because no baseline execution possible
    until migration blocker is resolved.
- **Evidence:** `phase-0c-baseline-unmodified-run.log` server-boot section.

## FR-03 — Web server boots with missing critical database tables

- **Category:** INFRASTRUCTURE_BLOCKED
- **Blast radius:** All tests
- **Root cause:** Even though PostgreSQL DB `nzila_automation` has 748 public tables (Phase 0B migrations preserved), some Union Eyes runtime probes report missing tables. Suggests either drift between Drizzle schema and applied migrations, or the runtime probe is checking a schema the DB doesn't have.
- **Repair (specified in `phase-0c-lifecycle-design.md`):**
  - §7 disposable DB fixture starts from a known-clean DB and applies full migration lineage (steps 4–6).
  - §6 readiness endpoint's `db.schema.*` + `db.migrations.*` checks make drift a boot-time failure.
- **Repair status:** IMPLEMENTED (allocator + readiness) / **NEW BLOCKER SURFACED**.
  - Disposable-DB allocator landed
    (`apps/union-eyes/scripts/lifecycle/allocate-db.ts`, Tier 1 + Tier 3
    @ 9342b21a0 / 385613df5): CREATE DATABASE per run, two-stage migration
    pipeline (platform bootstrap + UE app migrations), automatic rollback
    on failure, DROP DATABASE on cleanup, `.e2e-lifecycle/history.jsonl`
    audit trail. Live-PG proof: 7 steps green
    (`phase-0c-database-fixture-proof.md`).
  - Readiness endpoint fixture-correct
    (`apps/union-eyes/app/api/health/readiness/route.ts`, Tier 2 @ 9b895f62f):
    `db.contract`, `db.seed.marker`, `auth.fixtures` checks aligned to
    `EXPECTED_FIXTURE_USER_EMAILS` (5 canonical `ue.qa.*@nzila.test`) and
    `user_management.users` — 5 unit tests.
  - **NEW BLOCKER:** stage 2 of migration pipeline (UE app migrations)
    aborts at `0008_lean_mother_askani.sql` statement #7105 with
    `relation "knowledge_base" does not exist`. Migration 0008 contains
    ≥10 repeated `CREATE TABLE IF NOT EXISTS "knowledge_base_articles"`
    blocks and other corruption evidence. See
    `phase-0c1-migration-pipeline-blocker.md` for reproduction and
    recommended follow-up.
- **Evidence:** `phase-0c-baseline-unmodified-run.log` server-boot section;
  `phase-0c1-migration-pipeline-blocker.md`.

## FR-04 — Duplicate spec `tests/e2e/ue-workflow.spec.ts`

- **Category:** OBSOLETE_DUPLICATE
- **Blast radius:** Ignored (already in `testIgnore`) — no runtime impact, only code hygiene.
- **Root cause:** Historical duplicate of `apps/union-eyes/e2e/ue-workflow.spec.ts`; kept out of the run via `testIgnore` but never deleted.
- **Repair:** Delete the file; remove entry from `playwright.config.ts testIgnore` array.
- **Repair status:** IMPLEMENTED (Tier 4 this session). File
  `apps/union-eyes/tests/e2e/ue-workflow.spec.ts` deleted; canonical spec
  at `apps/union-eyes/e2e/ue-workflow.spec.ts` retained.
- **Evidence:** Diff between `apps/union-eyes/e2e/ue-workflow.spec.ts` and `apps/union-eyes/tests/e2e/ue-workflow.spec.ts` shows near-identity (see §5 inventory MD, spec 30).

## FR-05 — 5 OCRA hard-skips (OCRA-SKIP-01..05)

- **Category:** LATER_PHASE (deep-traversal placeholders in §3 of ocra-adaptive-flow.spec.ts)
- **Blast radius:** 5 tests skipped, well below the flake threshold.
- **Root cause:** Deep traversal requires product capabilities that will be shipped in Phase 1 (per `phase-0c-test-classification.md` OCRA hard-skip register).
- **Repair:** NOT REQUIRED for Phase 0C. Skips are documented, tracked to Phase 1, and reviewed at CUPE-CANDIDATE gate.
- **Repair status:** ACCEPTED AS PHASE-1 DEBT.
- **Evidence:** `phase-0c-test-classification.md` §OCRA-SKIP-01..05 register.

---

## Summary

| ID | Category | Blast radius | Status |
|----|----------|--------------|--------|
| FR-01 | INFRASTRUCTURE_BLOCKED | ~135 tests | Infra implemented; baseline verification blocked by migration pipeline defect |
| FR-02 | INFRASTRUCTURE_BLOCKED | All tests | Env module implemented; playwright.config.ts handoff deferred |
| FR-03 | INFRASTRUCTURE_BLOCKED | All tests | Allocator + readiness implemented; NEW BLOCKER surfaced in migration 0008 |
| FR-04 | OBSOLETE_DUPLICATE | 0 (ignored) | Implemented (Tier 4 @ Phase 0C.1) |
| FR-05 | LATER_PHASE | 5 skips | Accepted as Phase 1 debt |
| FR-06 | INFRASTRUCTURE_BLOCKED | Migration pipeline | See `phase-0c1-migration-pipeline-blocker.md` — Phase 0D scope |

**Phase 0C.1 outcome: AMBER — E2E INFRASTRUCTURE INCOMPLETE.**
Infrastructure primitives (env / disposable-DB / process / readiness) all
landed and unit-tested. Authoritative baseline execution deferred pending
resolution of migration 0008 defect (FR-06, new). No PRODUCT_DEFECT,
TEST_DEFECT, or EXTERNAL_DEPENDENCY categories were observed.

---

## Phase 0C.2 §3 amendment — FR-06 root-cause pivot

**Effective 2026-07-23 (Phase 0C.2 §4 forensic analysis).**

FR-06 was originally classified as "corruption of migration 0008" in
`phase-0c1-migration-pipeline-blocker.md`. Phase 0C.2 §4 forensic
analysis (see `phase-0c2-migration-0008-forensic-analysis.md`, to be
produced later in this phase) reveals a superseding root cause:

- **Legacy `apps/union-eyes/db/migrations/` is officially FROZEN** as of
  2026-05-09 (sentinel `apps/union-eyes/db/migrations/.lineage-frozen`
  present, governance policy in
  `docs/categories/platform-and-operations/architecture/orm-governance/historical-migration-lineage-governance.md`).
- The compliant fresh-DB path is: `run-union-eyes-drizzle-bootstrap.mjs`
  → reconciled scoped root `apps/union-eyes/db/migrations-cache/`
  (4 files) + `tooling/sql/union-eyes-qa-baseline.sql` (22 KB idempotent
  minimum schema for QA/CI) + optional Django snapshot restore via
  `UE_DB_RESTORE_SNAPSHOT_URL`.
- The Phase 0C.1 runner `run-union-eyes-drizzle-migrate.mjs`, added to
  `apps/union-eyes/scripts/lifecycle/allocate-db.ts` `runMigrations()`
  as the "stage 2 UE app migrations" step, **replays the entire frozen
  legacy lineage** in violation of the governance policy §4 replay
  prohibitions.
- Migration 0008 is not a Phase 0C defect — it is a frozen historical
  artifact whose corruption is one of many reasons the freeze exists.

**Phase 0C.2 remedy (executed in §4–§9 of the Phase 0C.2 mandate):**
1. Refactor `allocate-db.ts` `runMigrations()` to invoke only the
   compliant `run-union-eyes-drizzle-bootstrap.mjs`.
2. Remove or defense-guard `run-union-eyes-drizzle-migrate.mjs` so the
   frozen lineage cannot be replayed accidentally.
3. Prove clean-DB path (bootstrap + QA baseline → contract-complete
   disposable DB) and existing-DB upgrade path.
4. Preserve 0008 unchanged.

FR-06 remains INFRASTRUCTURE_BLOCKED until the refactor lands with
runtime proof, at which point FR-06 is closed as RESOLVED.
