# Phase 0C.2 §8 — Playwright projects wiring (proof)

**Section:** §8 — Playwright projects & storageState wiring
**Baseline HEAD:** `1c2ed4f2043dab6303ad92db93f6868836fdc543` (post-§7)
**Branch:** `fix/union-eyes-phase0c-e2e-stabilization`
**Worktree:** `C:\APPS\nzila-automation-phase0c`
**Package:** `apps/union-eyes`

## 1. Context

Phase 0C.2 §7 landed a governed auth-state orchestrator that emits five
canonical persona storageState artifacts and a `summary.json` under
`playwright/.auth/`. However, `playwright.config.ts` still declared a
single `chromium` project that consumed **no** storageState. The
orchestrator's output was therefore unreachable by Playwright at run
time — every spec that expected a signed-in browser had to reach into
`e2e/helpers/auth.ts` and either call the real `/api/auth/login`
endpoint (slow, single-user) or short-circuit through the
`PLAYWRIGHT_TEST_AUTH=true` fake-cookie branch (a governance risk that
§4 hardened but did not eliminate at the config layer).

§8 closes this gap by re-shaping `playwright.config.ts` into an
11-project topology where each project pre-loads the correct
storageState via Playwright's native `dependencies: ['setup']` + `use.storageState`
mechanism. A `setup` project verifies that §7's orchestrator artefacts
are on disk before any downstream project is allowed to start, and a
new `playwright.config.test.ts` locks the structure in place with
vitest so a regression that (a) drops a project, (b) mis-routes a spec,
or (c) forgets a `setup` dependency link cannot pass CI silently.

## 2. Gaps closed

| Gap                                                                        | Before §8                                                        | After §8                                                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| §7's five persona storageState files unused by Playwright                  | Single `chromium` project, no `storageState`                     | 5 persona projects each pre-load `playwright/.auth/<role>.json`                                                 |
| No fail-fast on missing/stale auth-state artefacts                         | Every spec fails independently with generic auth errors          | `setup` project (`playwright/setup/auth-state.setup.ts`) asserts summary.json + all 5 files upfront             |
| Cross-org / negative specs contaminated by pre-authenticated sessions      | Everything ran with whatever the helper decided                  | `security` and `accessibility` projects declare `storageState: { cookies: [], origins: [] }` (cold session)     |
| Public / smoke specs unnecessarily gated on auth-state generation          | Coupled to whatever fixture the helper produced                  | `public` project has no `dependencies` and no `storageState` (independent, always runnable)                     |
| Bilingual seed for §13 had no dedicated projects                           | Would have been ad-hoc                                           | `bilingual-en` / `bilingual-fr` projects wired to `member` storageState + `locale: 'en-CA' \| 'fr-CA'`          |
| No structural test locked project shape                                    | Silent regressions possible                                      | `playwright.config.test.ts` (35 assertions) makes shape drift a build failure                                   |
| §4's hardened bypass could be defeated by `loginAsRole` mid-test injection | Fake `nzila_session=ue-seed-session-<id>` cookie always overrode | Explicit `TODO(phase-0c2-§11)` recorded in `e2e/helpers/auth.ts` deferring the reconciliation to §11 with tests |

## 3. Files changed

| File                                                                    | Kind     | Purpose                                                                                                                    |
| ----------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| [apps/union-eyes/playwright.config.ts](apps/union-eyes/playwright.config.ts) | modified | 11-project topology; exports `PLAYWRIGHT_AUTH_DIR`, `PLAYWRIGHT_STORAGE_STATE_PATHS`, `PLAYWRIGHT_PROJECT_MANIFEST` |
| [apps/union-eyes/playwright/setup/auth-state.setup.ts](apps/union-eyes/playwright/setup/auth-state.setup.ts) | new | Fail-fast setup gate; verifies summary.json + each role's storageState file has a non-empty `nzila_session` cookie |
| [apps/union-eyes/playwright.config.test.ts](apps/union-eyes/playwright.config.test.ts) | new | 35 vitest assertions locking project count, order, storageState wiring, dependency graph, spec-routing correctness, and preserved global settings |
| [apps/union-eyes/e2e/helpers/auth.ts](apps/union-eyes/e2e/helpers/auth.ts) | modified | Adds explicit `TODO(phase-0c2-§11)` describing why the fake-cookie branch is left in place for now (deferred repair) |

## 4. Project topology (final)

| # | Project | testMatch scope | storageState | dependencies | Locale |
|---|---------|-----------------|--------------|--------------|--------|
| 1 | `setup` | `playwright/setup/auth-state.setup.ts` | *(none)* | *(none)* | *(default)* |
| 2 | `public` | smoke / pilot-mode-gating / no-fsm-overexposure | *(none)* | *(none)* | *(default)* |
| 3 | `member` | member-journey, member-intake | `playwright/.auth/member.json` | `['setup']` | *(default)* |
| 4 | `steward` | steward-review, permission-boundaries | `playwright/.auth/steward.json` | `['setup']` | *(default)* |
| 5 | `staff` | case-escalation, case-resolution, external-ux-tester, auditor-readonly | `playwright/.auth/staff.json` | `['setup']` | *(default)* |
| 6 | `admin` | admin-assignment, dashboard, missing-routes, cape-features, empty-states, authenticated-role-navigation, pilot-journey, ocra-adaptive-flow, stakeholder-demo-journeys, ue-workflow, governance/deployment-legitimacy-visibility | `playwright/.auth/admin.json` | `['setup']` | *(default)* |
| 7 | `executive` | cba-intelligence | `playwright/.auth/executive.json` | `['setup']` | *(default)* |
| 8 | `security` | cross-org-block, org-isolation-negative, auth-failure-handling, auth-session-switch, evidence-misuse, negative-workflow-transitions | `{ cookies: [], origins: [] }` (cold) | `['setup']` | *(default)* |
| 9 | `bilingual-en` | `e2e/bilingual/**/*.en.spec.ts` (populated by §13) | `playwright/.auth/member.json` | `['setup']` | `en-CA` |
| 10 | `bilingual-fr` | `e2e/bilingual/**/*.fr.spec.ts` (populated by §13) | `playwright/.auth/member.json` | `['setup']` | `fr-CA` |
| 11 | `accessibility` | `e2e/a11y/**/*.spec.ts` (populated by §14) | `{ cookies: [], origins: [] }` (cold) | `['setup']` | *(default)* |

Global settings preserved (verified by test): `workers: 1`,
`fullyParallel: false`, `timeout: 60_000`, `retries: process.env.CI ? 2 : 0`.

## 5. Setup-gate contract (`playwright/setup/auth-state.setup.ts`)

Single test, deliberately verification-only (does not re-run the
generator — that is §7's job). Fails the entire Playwright run before
any dependent project starts if any invariant is violated:

1. `playwright/.auth/summary.json` exists.
2. `summary.json` parses and has `baseUrl` (string), `outputDir` (string), `results` (array), `allOk` (boolean).
3. `summary.allOk === true`.
4. Each of the five canonical roles (`member`, `steward`, `staff`, `executive`, `admin`) appears exactly once in `summary.results` with `ok: true` and a string `storageStatePath`.
5. Each role's storageState file exists, is non-empty, parses as JSON, has `cookies: []` + `origins: []` arrays, and has a non-empty `nzila_session` cookie.

Because `dependencies: ['setup']` is declared on every persona,
security, bilingual, and accessibility project, a failure here aborts
the whole downstream run — no test that expects real auth can execute
with stale or missing state.

## 6. Verification

### 6.1 New config test (35/35)

```
Test Files  1 passed (1)
     Tests  35 passed (35)
  Duration  1.28s
```

Full log: [reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-playwright-projects-tests.log](reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-playwright-projects-tests.log)

### 6.2 Union-eyes full regression (1112 files / 16173 tests)

```
Test Files  1111 passed | 1 skipped (1112)
     Tests  16171 passed | 2 skipped (16173)
  Duration  164.64s
```

The single skipped file (`platform-audit-events.integration.test.ts`)
is skipped by design when a live audit pipeline is not configured;
unrelated to §8.

### 6.3 Typecheck

```
pnpm exec tsc --noEmit  # (no output = clean)
```

### 6.4 §7 auth-state orchestrator regression

The five §7 orchestrator tests (`generate-auth-states.test.ts`, 9
tests) and the four related lifecycle test files
(`managed-server-handshake.test.ts`, `env.test.ts`, `process.test.ts`,
`allocate-db.test.ts`) still pass unchanged — verified as part of the
full suite above (106 tests when run against the lifecycle folder + config test alone).

### 6.5 Contract tests (repo-wide)

Deferred to the pre-push step (documented separately in the commit's
push log); §8 introduces no new contracts, only Playwright wiring, so
contract-test scope is unchanged since §7's 9426/9426 baseline.

## 7. Sign-off

- ✅ 11-project topology matches Phase 0C.2 §8 specification.
- ✅ Fail-fast setup gate blocks downstream tests on missing/stale storageState.
- ✅ Security + accessibility projects start with cold sessions (no cross-contamination).
- ✅ Public + smoke specs remain independently runnable.
- ✅ Structural invariants locked in vitest (35 assertions).
- ✅ Full union-eyes suite green (16171/16173 passing; 2 pre-existing skips).
- ✅ `loginAsRole` helper reconciliation deferred to §11 with an inline `TODO(phase-0c2-§11)` (no silent risk carry-over).
- ⏭ Bilingual (`e2e/bilingual/**`) and accessibility (`e2e/a11y/**`) test directories are wired but empty; §13 / §14 populate them.
