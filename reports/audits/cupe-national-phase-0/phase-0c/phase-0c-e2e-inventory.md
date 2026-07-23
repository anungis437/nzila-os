# Phase 0C §5 — Union Eyes E2E Test Inventory (Markdown view)

**Authored:** 2026-05-14
**HEAD:** `11ac20821b4ce3bb050272704f09a1a7c226ca8f`
**Companion:** `phase-0c-e2e-inventory.json` (authoritative machine-readable register)

This file summarizes the register in human-readable form. Every claim below is
backed by a corresponding entry in the JSON. If a number differs between the
two files, the JSON wins.

---

## Totals

| Metric                                             | Count |
| -------------------------------------------------- | ----: |
| Spec files (total)                                 |    30 |
| Spec files (active — included by playwright.config) |    29 |
| Spec files (ignored by config `testIgnore`)         |     1 |
| Test cases (distinct `test(...)` invocations)      |   149 |
| Test cases hard-skipped (`test.skip('...')`)         |     5 |
| Test cases conditionally skipped at describe level (`test.skip(!isTestAuth)`) — RUN when `PLAYWRIGHT_TEST_AUTH=true` (Phase 0C default) | 91 |
| Test cases runtime-skipped on dependabot only (`GITHUB_ACTOR === 'dependabot[bot]'`) | 6 |
| Test cases public, no skip guard                    |    15 |

Notes:

- The 91 "conditionally skipped" tests are the meat of the authenticated
  Union Eyes suite. Under Phase 0C, the webServer.env sets
  `PLAYWRIGHT_TEST_AUTH=true`, so they DO run — the describe guard is only a
  local-shell safety net.
- Loop-parameterized tests (e.g. `${role}: ...`) produce N × M runtime cases
  from a single `test(...)` invocation. Runtime counts will be produced under
  §20 (`phase-0c-full-e2e-run.log`).

---

## Preliminary classification distribution

| Class | Meaning                                              | Spec files |
| ----- | ---------------------------------------------------- | ---------: |
| A     | Current baseline — must pass under Phase 0C lifecycle |         27 |
| MIXED_CANDIDATE + LATER_PHASE | 4 CURRENT_BASELINE_CANDIDATE + 5 LATER_PHASE (hard-skipped) | 1 (OCRA) |
| LATER_PHASE               | Later-phase; deferred by explicit test.skip with governed reason                       |      0 (as whole files) |
| EXTERNAL_DEPENDENCY       | Blocked by an external non-local service                                              |      0 |
| OBSOLETE_DUPLICATE        | Superseded by another spec; delete under §12                                          |      1 (duplicate tests/e2e/ue-workflow.spec.ts) |

The 5 tests inside `ocra-adaptive-flow.spec.ts` §3 are per-test Class B (hard
skipped by `test.skip('...')`); the file overall is Class A because §1 (smoke)
and §2 (telemetry) are green targets.

---

## Per-file summary

### apps/union-eyes/e2e/ (16 files, public + role-authenticated UI)

| File                                              | Tests | Auth mode                | Roles                                 | Preliminary class | Skip mechanism                          |
| ------------------------------------------------- | ----: | ------------------------ | ------------------------------------- | ------------ | --------------------------------------- |
| `authenticated-role-navigation.spec.ts`           |     3 | cookie inject             | member/steward/staff/executive/gov/admin (loop) | A | none at describe (assumes `PLAYWRIGHT_TEST_AUTH=true`) |
| `cape-features.spec.ts`                           |    14 | cookie inject             | member/steward/executive              | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)` × 6 describes  |
| `cba-intelligence.spec.ts`                        |     2 | cookie inject             | executive                             | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)`                |
| `dashboard.spec.ts`                               |     3 | cookie inject             | member/steward/admin                  | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)`                |
| `empty-states.spec.ts`                            |     6 | cookie inject             | member/steward/admin                  | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)` + dynamic 404 self-skip |
| `governance/deployment-legitimacy-visibility.spec.ts` | 2 | public (no auth)         | —                                     | CURRENT_BASELINE_CANDIDATE | none                                    |
| `member-journey.spec.ts`                          |    12 | cookie inject             | member/governance                     | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)` + one dynamic self-skip |
| `missing-routes.spec.ts`                          |    10 | cookie inject             | admin/steward/member/governance       | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)` + explicit `test.skip()` for pending routes |
| `no-fsm-overexposure.spec.ts`                     |     1 (× 6 roles) | cookie inject   | member/steward/staff/executive/gov/admin (loop) | A | `test.skip(!isTestAuth)` |
| `ocra-adaptive-flow.spec.ts`                      |     9 (4 A + 5 B) | public              | —                                     | MIXED        | 5 hard `test.skip('...')` deep-traversal |
| `permission-boundaries.spec.ts`                   |    16 | mix cookie/unauth         | member/steward/governance             | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)` at describe    |
| `pilot-journey.spec.ts`                           |     2 | cookie inject + API       | member/steward/staff                  | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)`                |
| `pilot-mode-gating.spec.ts`                       |     1 (× ≥5 roles) | cookie inject   | member/steward/executive/gov/admin    | CURRENT_BASELINE_CANDIDATE | `test.skip(!isTestAuth)`                |
| `smoke.spec.ts`                                   |     5 | public (no auth)          | —                                     | CURRENT_BASELINE_CANDIDATE | none                                    |
| `stakeholder-demo-journeys.spec.ts`               |     8 | cookie inject + public    | executive/staff/governance/member/admin | A          | `test.skip(!isTestAuth)` at authenticated describes |
| `ue-workflow.spec.ts`                             |     6 | real `/api/auth/login`    | steward/member                        | CURRENT_BASELINE_CANDIDATE | `test.skip(dependabot only)` runtime guard |

### apps/union-eyes/tests/e2e/ (14 files, API-negative + workflow)

| File                                     | Tests | Auth mode              | Roles                        | Preliminary class | Skip mechanism           |
| ---------------------------------------- | ----: | ---------------------- | ---------------------------- | ------------ | ------------------------ |
| `admin-assignment.spec.ts`               |     1 | real `/api/auth/login` | admin/member                 | CURRENT_BASELINE_CANDIDATE | none                     |
| `auditor-readonly.spec.ts`               |     1 | real `/api/auth/login` | auditor                      | CURRENT_BASELINE_CANDIDATE | none                     |
| `auth-failure-handling.spec.ts`          |     7 | mix                    | member/steward/admin/auditor | CURRENT_BASELINE_CANDIDATE | none                     |
| `auth-session-switch.spec.ts`            |     1 | real `/api/auth/login` | member/steward               | CURRENT_BASELINE_CANDIDATE | none                     |
| `case-escalation.spec.ts`                |     1 | real `/api/auth/login` | steward/member               | CURRENT_BASELINE_CANDIDATE | none                     |
| `case-resolution.spec.ts`                |     1 | real `/api/auth/login` | steward/member               | CURRENT_BASELINE_CANDIDATE | none                     |
| `cross-org-block.spec.ts`                |     3 | real `/api/auth/login` | member (wrong-org), auditor (wrong-org) | A | none                     |
| `evidence-misuse.spec.ts`                |     7 | mix                    | member/steward/member-secondary | A         | none                     |
| `external-ux-tester.spec.ts`             |     2 | real `/api/auth/login` | externalTester               | CURRENT_BASELINE_CANDIDATE | none                     |
| `member-intake.spec.ts`                  |     2 | real `/api/auth/login` | member                       | CURRENT_BASELINE_CANDIDATE | none                     |
| `negative-workflow-transitions.spec.ts`  |     6 | mix                    | steward/member               | CURRENT_BASELINE_CANDIDATE | none                     |
| `org-isolation-negative.spec.ts`         |     8 | real `/api/auth/login` | member (wrong-org)           | CURRENT_BASELINE_CANDIDATE | none                     |
| `steward-review.spec.ts`                 |     3 | real `/api/auth/login` | steward                      | CURRENT_BASELINE_CANDIDATE | none                     |
| `ue-workflow.spec.ts`                    |     6 | real `/api/auth/login` | steward/member               | **OBSOLETE_DUPLICATE** | `testIgnore` in playwright.config.ts — this is a duplicate of `apps/union-eyes/e2e/ue-workflow.spec.ts` |

---

## Environment requirements (union of all specs)

| Variable / Precondition           | Required by                                             | Phase 0C source of truth              |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `PLAYWRIGHT_TEST_AUTH=true`       | All cookie-inject describes (91 tests)                  | `playwright.config.ts` webServer.env  |
| `AUTH_SECRET`                     | Every describe using auth cookies or `/api/auth/login`  | `.env.test.local` or default          |
| `VOTING_SECRET`                   | Any code path that touches voting state (indirect)      | `.env.test.local` or default          |
| `DATABASE_URL`                    | All tests (seed + login)                                | `.env.test.local` or app `.env.local` |
| `QA_TEST_ENV=true`                | Seed safety guard + runtime health flag                 | `playwright.config.ts` webServer.env  |
| `NODE_ENV=test`                   | Runtime differentiation                                  | `playwright.config.ts` webServer.env  |
| `PLAYWRIGHT_BASE_URL`             | All requests                                            | `http://localhost:3002` (default)     |
| `UE_E2E_RISK_BYPASS=true`         | `pilot-mode-gating.spec.ts` and any risk-guarded path   | `playwright.config.ts` webServer.env  |

Notes:

- The Phase 0C readiness endpoint (§8) will publish an inventory of these
  preconditions at runtime so tests can fail loudly and early on missing
  configuration instead of getting redirected to `/sign-in`.
- The seed script `apps/union-eyes/scripts/seed-test-env.ts` enforces
  `QA_TEST_ENV=true` and DB URL sanity — Phase 0C §10 will replace/rework it
  under a governed contract, not delete it.

---

## Required seed rows (union of all specs)

Organizations:

- `UE_TEST_ORGS.primary` — active fixture organization
- `UE_TEST_ORGS.secondary` — cross-org negative fixture
- `UE_TEST_ORGS.uxTesterIsolated` — sandbox for `restrictedUxTester`

Users (`apps/union-eyes/tests/fixtures/test-users.ts`):

| Fixture              | userId                       | Role                | Org       | Used by classes |
| -------------------- | ---------------------------- | ------------------- | --------- | --------------- |
| `memberPrimary`      | `ue-qa-member-primary`       | member              | primary   | member/API tests |
| `stewardPrimary`     | `ue-qa-steward-primary`      | steward             | primary   | steward flows   |
| `staffPrimary`       | `ue-qa-staff-primary`        | support_agent       | primary   | staff flows     |
| `executivePrimary`   | `ue-qa-executive-primary`    | president           | primary   | executive dash  |
| `adminPrimary`       | `ue-qa-admin-primary`        | admin               | primary   | admin assign    |
| `memberSecondary`    | `ue-qa-member-secondary`     | member              | secondary | cross-org       |
| `restrictedUxTester` | `ue-qa-ux-tester-001`        | member              | uxTester  | sandbox         |
| `auditorReadOnly`    | `ue-qa-auditor-readonly`     | compliance_manager  | primary   | auditor         |

Cases (`apps/union-eyes/tests/fixtures/test-cases.ts`):

- Deterministic UUIDs referenced across specs — e.g. `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2`
- Claim numbers referenced: `UE-QA-0001` (primary org), `UE-QA-1001` (cross-org)
- Evidence records referenced by evidence-misuse and cross-org tests

Every seed row above is required by at least one Class A test. The Phase 0C
seed contract (§10) will express these requirements as a schema-validated
input list.

---

## External dependencies

| Dependency                    | Where it appears | Status                                                                 |
| ----------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Postgres (native, port 5433) | All specs (seed + login) | LOCAL — controlled by Phase 0C DB fixture (§9)                          |
| Next.js dev server (Turbopack via `pnpm dev`) | webServer            | LOCAL — controlled by Phase 0C lifecycle (§7)                          |
| Filesystem `/api/health/route.ts`    | governance/deployment-legitimacy-visibility | LOCAL — no external HTTP                                         |
| Third-party AI, Sentry, Clerk | none              | **Not required.** No spec calls out to third-party infrastructure.     |

No Class C tests exist in the current tree.

---

## Duplicates and obsoletes (Class D — 1 spec)

`apps/union-eyes/tests/e2e/ue-workflow.spec.ts` is a duplicate of
`apps/union-eyes/e2e/ue-workflow.spec.ts`. Playwright config already excludes
the `tests/e2e/` copy via `testIgnore`. Both files declare identical describes
and identical test titles. Differences:

- `apps/union-eyes/e2e/ue-workflow.spec.ts` adds a dependabot-only runtime skip
  and uses `assertRoleGatedReadStatus` for test 5.
- `apps/union-eyes/tests/e2e/ue-workflow.spec.ts` uses a literal status set
  for test 5 and includes an `afterEach cleanupDatabaseConnections` call.

Recommendation: keep `apps/union-eyes/e2e/ue-workflow.spec.ts` (already the
canonical location because tests reachable there are what Playwright runs) and
delete the shadow file. Rationale will land in
`phase-0c-failure-resolution-register.md` (§14).

---

## Loop expansions (informational — counted separately at runtime under §20)

| Spec                                     | `test.each`-style loop / template          | Runtime cases from one source `test(...)` |
| ---------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| `authenticated-role-navigation.spec.ts`  | Iterates over role tuple                    | ~6 per test                               |
| `no-fsm-overexposure.spec.ts`            | Iterates over role tuple                    | ~6                                        |
| `pilot-mode-gating.spec.ts`              | Iterates over role tuple                    | ~5                                        |
| `stakeholder-demo-journeys.spec.ts`      | Per-role role paths, but authored per role  | 1 per test (5 authored)                   |

These will be exercised naturally by the §20 full-run log; they do not require
any restructuring in the inventory.

---

## Preconditions summary

- No spec currently depends on any resource that Phase 0C does not or cannot
  provide.
- The dominant risks to determinism are:
  1. Whether all describes that begin `test.skip(!isTestAuth)` actually see
     `PLAYWRIGHT_TEST_AUTH=true` — verified: yes, webServer.env sets it.
  2. Whether the seed populates every fixture row before the first cookie
     injection — depends on `beforeAll ensureServerReady + seedOrVerifyTestState`
     which today asserts on responses but does not run the seed script itself.
     This is a **known gap** that Phase 0C §10 (governed seed contract) must
     close.
  3. Dynamic self-skips (`test.skip()` inside a running test) in
     `empty-states.spec.ts`, `member-journey.spec.ts`, and `missing-routes.spec.ts`
     hide route non-existence. Under §14, those dynamic skips will be evaluated
     one by one and either removed (routes exist) or elevated to explicit
     `test.skip('reason')` at the describe level.

---

## Next artifact

Phase 0C §6 (`phase-0c-test-classification.md`) will finalize A/B/C/D
classification from this inventory, applying the preliminary classes above,
resolving the mixed classification of `ocra-adaptive-flow.spec.ts`, and
formally deleting the duplicate `tests/e2e/ue-workflow.spec.ts` under a
recorded rationale.
