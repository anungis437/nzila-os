# Phase 0C — Failure Resolution Register

**Status:** ROOT-CAUSE COMPLETE. Fix implementation deferred to Phase 0D per closure.

## FR-01 — Auth-required tests fail at `helpers/auth.ts:77 toHaveURL(...) 5000ms timeout`

- **Category:** INFRASTRUCTURE_BLOCKED
- **Blast radius:** All ~135 auth-required tests (every test that calls `gotoDashboardAsRole` or navigates to `/dashboard/**`)
- **Root cause:** `seed-test-env.ts` was never invoked before Playwright started, so `auth_users` / `organization_members` are empty. Cookie-mode auth (`nzila_session=ue-seed-session-{userId}`) is accepted but resolves to a user with no organization membership, no role, no landing. The `/dashboard` shell renders but never redirects to `/dashboard/inbox` (member) or `/dashboard/admin/organizations` (admin), etc.
- **Repair (specified in `phase-0c-lifecycle-design.md`):**
  - §5 lifecycle command runs seed BEFORE Playwright starts.
  - §8 seed contract asserts all `UE_TEST_USERS` are inserted with correct role + membership + landing preference.
  - §6 readiness endpoint's `auth.fixtures` check refuses to boot Playwright until seed is verified.
- **Repair status:** DESIGNED. IMPLEMENTATION DEFERRED to Phase 0D.
- **Evidence:** `phase-0c-baseline-unmodified-run.log` tests 1, 3, 5, 7, 9, 11, ... (identical stack trace for every role).

## FR-02 — Web server boots with missing critical env vars

- **Category:** INFRASTRUCTURE_BLOCKED
- **Blast radius:** All tests (webServer log warns on every boot)
- **Root cause:** `playwright.config.ts webServer.env` does not export required secrets. Boot log shows: `NEXT_PUBLIC_APP_URL: Required`, `runtime-fail-closed` catalogs 10+ missing secrets (`auth.django.secret`, `crypto.fallback`, `auth.webhook.secret`, `crypto.pii`, `identity.entra.*`, `lineage.*`, `NZILA_MODE`).
- **Repair (specified in `phase-0c-lifecycle-design.md` §5 step 1):**
  - Preflight step validates `.env.test` has all required keys before boot.
  - Boot step exports the env to the child process explicitly.
- **Repair status:** DESIGNED. IMPLEMENTATION DEFERRED to Phase 0D.
- **Evidence:** `phase-0c-baseline-unmodified-run.log` server-boot section.

## FR-03 — Web server boots with missing critical database tables

- **Category:** INFRASTRUCTURE_BLOCKED
- **Blast radius:** All tests
- **Root cause:** Even though PostgreSQL DB `nzila_automation` has 748 public tables (Phase 0B migrations preserved), some Union Eyes runtime probes report missing tables. Suggests either drift between Drizzle schema and applied migrations, or the runtime probe is checking a schema the DB doesn't have.
- **Repair (specified in `phase-0c-lifecycle-design.md`):**
  - §7 disposable DB fixture starts from a known-clean DB and applies full migration lineage (steps 4–6).
  - §6 readiness endpoint's `db.schema.*` + `db.migrations.*` checks make drift a boot-time failure.
- **Repair status:** DESIGNED. IMPLEMENTATION DEFERRED to Phase 0D.
- **Evidence:** `phase-0c-baseline-unmodified-run.log` server-boot section.

## FR-04 — Duplicate spec `tests/e2e/ue-workflow.spec.ts`

- **Category:** OBSOLETE_DUPLICATE
- **Blast radius:** Ignored (already in `testIgnore`) — no runtime impact, only code hygiene.
- **Root cause:** Historical duplicate of `apps/union-eyes/e2e/ue-workflow.spec.ts`; kept out of the run via `testIgnore` but never deleted.
- **Repair:** Delete the file; remove entry from `playwright.config.ts testIgnore` array.
- **Repair status:** DESIGNED. IMPLEMENTATION DEFERRED to Phase 0D (bundle with §12 hygiene commit).
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
| FR-01 | INFRASTRUCTURE_BLOCKED | ~135 tests | Designed, deferred to Phase 0D |
| FR-02 | INFRASTRUCTURE_BLOCKED | All tests | Designed, deferred to Phase 0D |
| FR-03 | INFRASTRUCTURE_BLOCKED | All tests | Designed, deferred to Phase 0D |
| FR-04 | OBSOLETE_DUPLICATE | 0 (ignored) | Designed, deferred to Phase 0D |
| FR-05 | LATER_PHASE | 5 skips | Accepted as Phase 1 debt |

**No PRODUCT_DEFECT, TEST_DEFECT, or EXTERNAL_DEPENDENCY** categories were observed in the baseline. All observed failures collapse to the same three infrastructure gaps (FR-01/02/03).
