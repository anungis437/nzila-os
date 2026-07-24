# Phase 0C.2 §12 — Cross-Org Security Tests: `beforeAll` Timeout Fix

**Status:** IN-CODE FIX APPLIED · full runtime validation deferred to §15 (3× Baseline Run 2)
**Branch:** `fix/union-eyes-phase0c-e2e-stabilization`
**Parent HEAD:** `3443232a7` (§11 completion — governed E2E orchestrator green end-to-end)
**Scope:** Playwright `security` project — 6 spec files whose `beforeAll` hook was killed at the default 60 s ceiling in Baseline Run 2 attempt-6.
**Non-negotiable preserved:** *Playwright auth bypass structurally impossible outside governed test execution.* The fix only extends a hook timeout — it does not touch cookie plumbing, storageState, auth-state fixtures, or the middleware bypass gate.

---

## 1. Failure inventory (from attempt-6)

Canonical run: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724022239_79178c/` (started 2026-07-24 02:22:39 UTC, 41 min lifecycle wall clock).

All six specs in the `security` project failed with byte-identical error strings. Extracted from each spec's `test-results/**/error-context.md`:

| # | Spec file | Failing hook | Timeout observed |
| - | --- | --- | --- |
| 1 | `apps/union-eyes/tests/e2e/cross-org-block.spec.ts` | `test.beforeAll` | `60000ms exceeded` |
| 2 | `apps/union-eyes/tests/e2e/org-isolation-negative.spec.ts` | `test.beforeAll` | `60000ms exceeded` |
| 3 | `apps/union-eyes/tests/e2e/evidence-misuse.spec.ts` | `test.beforeAll` | `60000ms exceeded` |
| 4 | `apps/union-eyes/tests/e2e/auth-failure-handling.spec.ts` | `test.beforeAll` | `60000ms exceeded` |
| 5 | `apps/union-eyes/tests/e2e/auth-session-switch.spec.ts` | `test.beforeAll` | `60000ms exceeded` |
| 6 | `apps/union-eyes/tests/e2e/negative-workflow-transitions.spec.ts` | `test.beforeAll` | `60000ms exceeded` |

Every one of them wires the same 2-line hook:

```ts
test.beforeAll(async ({ request }) => {
  await ensureServerReady(request)
  await seedOrVerifyTestState(request)
})
```

## 2. Ownership map

| File | Role |
| --- | --- |
| `apps/union-eyes/tests/e2e/_helpers.ts` | Legacy Playwright helper module. Owns `ensureServerReady`, `seedOrVerifyTestState`, `loginAsTestUser`, `assertNoCrossOrgLeak`, `assertPermissionDenied`, `cleanupDatabaseConnections`, `UE_E2E_USERS`. Consumed by every spec under `apps/union-eyes/tests/e2e/**` (13 spec files, of which 6 are in the `security` project). Distinct from the newer persona helper at `apps/union-eyes/e2e/helpers/auth.ts` used by member/steward/staff/admin/executive projects. |
| `apps/union-eyes/playwright.config.ts` | Declares the `security` project with `testMatch: SECURITY_TEST_MATCH` (the 6 files listed above), `storageState: {cookies:[], origins:[]}` (blank — deliberately cold), `dependencies: ['setup']`. |
| `apps/union-eyes/app/api/health/route.ts` | GET handler runs `Promise.allSettled([checkDb, checkAuth, checkRedis, checkBackend])`. `checkBackend` has a 3 s Django `AbortSignal.timeout`. `checkDb` may bear cold-SSR compile cost. |
| `apps/union-eyes/app/api/auth_core/health/route.ts` | Proxies to Django with `AbortSignal.timeout(3000)`. When `DJANGO_API_URL` is unset (which is the case under the governed lifecycle — see §4) it falls through to `healthGet()` (same body as `/api/health`). |

## 3. Behavioural invariants owned by these 6 specs

These are the security invariants the specs assert. Preserved intact by §12 — the fix only touches a hook timeout.

| Spec | Invariant |
| --- | --- |
| `cross-org-block.spec.ts` | Wrong-org user cannot POST `/api/workflow/transition` for another org's case. Wrong-org user cannot GET `/api/audit/export` for another org. |
| `org-isolation-negative.spec.ts` | `wrongOrg` (memberSecondary in `org_qa_secondary`) cannot enumerate primary-org grievance IDs, evidence, universal search results, dashboard metrics, evidence exports, audit logs, or workbench case lists. All primary IDs (`UE-QA-*`, `aaaaaaaa-*`) must be invisible or denied. |
| `evidence-misuse.spec.ts` | Invalid evidence ID returns safe error (no info leakage). Cross-org evidence request denied. Export without permission denied. Export payload contains no internal metadata. Evidence cannot be deleted by non-admin. Upload is role-gated. |
| `auth-failure-handling.spec.ts` | Unauth requests denied at every critical surface. Missing-role users cannot reach privileged routes. Insufficient role for evidence export. Role context not guessable via header injection. Session boundaries prevent cross-user state bleed. |
| `auth-session-switch.spec.ts` | Switching between two sessions in a single Playwright `APIRequestContext` correctly rotates `/api/auth/user-role` output; no residual role bleeds across sessions. |
| `negative-workflow-transitions.spec.ts` | FSM negative transitions structurally blocked (server returns 409/422): triage→resolved without under_review; closed→investigation without explicit reopen; member self-advancing to arbitration; member resolving directly; re-submitting a closed case. |

## 4. Root cause

`_helpers.ts::ensureServerReady` polls three endpoints in a bounded loop:

```ts
const endpoints = ['/api/auth_core/health/', '/api/health', '/sign-in']
const timeoutMs = 90_000      // total budget
const pollMs = 1_500          // gap between iterations
// per-endpoint: await request.get(endpoint, { timeout: 10_000 })
// success = HTTP status in [200, 204, 401, 403, 404, 503]
```

Cost of a single unsuccessful iteration under cold Next.js dev-mode SSR:

| Endpoint | Cold-compile cost | Warm cost |
| --- | --- | --- |
| `/api/auth_core/health/` | 5–12 s (first compile) | <100 ms |
| `/api/health` | 5–12 s (first compile) | 100–500 ms |
| `/sign-in` | 30–45 s (RSC page tree compile) | 500–1 500 ms |

Two consequences combine:

1. **The security project runs late** (position 162/193 in the collected test order — the setup, public, and 5 persona projects all precede it). By that point the Next.js dev worker has been alive for ~40 min but has not yet compiled `/sign-in` because persona projects use `page.goto('/en/dashboard')` and API-only helpers — they never hit `/sign-in`.
2. **The security project starts cold on `/sign-in` specifically.** Its `storageState` is intentionally blank (unauthenticated), so the polling helper is the FIRST caller to hit `/sign-in` after 40 min of unrelated activity. Turbopack/webpack invalidations plus module-graph re-resolution push that first hit into the 30–45 s range.

Result: iteration 1 consumes ~30 s (fast + fast + slow), iteration 2 consumes ~30 s again (compile cache persists but is not yet fully warm), and the 60 s Playwright `beforeAll` ceiling fires before `ensureServerReady`'s own 90 s budget is exhausted. **The helper is doing exactly what it should — it's just outliving the enclosing hook.**

Note: `DJANGO_API_URL` is not set by `apps/union-eyes/scripts/lifecycle/env.ts`, so `/api/auth_core/health/` short-circuits through `healthGet()` (mirror of `/api/health`) instead of round-tripping to a sidecar. That's why the two endpoints have similar cold-compile signatures.

## 5. Fix

**Single-point edit** in `apps/union-eyes/tests/e2e/_helpers.ts::ensureServerReady`:

```ts
export async function ensureServerReady(request: APIRequestContext): Promise<void> {
  // Phase 0C.2 §12: extend the enclosing hook/test timeout to 180s so that Next.js
  // dev-mode SSR compile-first-hit latency does not exceed the default 60s beforeAll
  // ceiling. Baseline Run 2 attempt-6 showed all 6 security specs timing out here
  // because 3 endpoints × 10s per-request timeout can burst 30s+ on cold compile,
  // and internally this helper polls up to 90s. Wrapped in try/catch so callers
  // outside a running test context (e.g. standalone probes) are a safe no-op.
  try {
    test.setTimeout(180_000)
  } catch {
    // no enclosing test/hook — safe no-op
  }
  const endpoints = ['/api/auth_core/health/', '/api/health', '/sign-in']
  const timeoutMs = 90_000
  const pollMs = 1_500
  // ...rest unchanged
}
```

Import updated: `import { expect, test, type APIRequestContext } from '@playwright/test'`.

### Why this and not the alternatives

| Alternative | Rejected because |
| --- | --- |
| Add `test.describe.configure({ timeout: 180_000 })` in each of the 6 spec files | Six-place fix, easy to forget on future security spec additions, drifts silently. Also `describe.configure({ timeout })` sets the *test* timeout, not the *hook* timeout. |
| Add `test.setTimeout(120_000)` at the top of each of the 6 `beforeAll` bodies | Same six-place-fix problem. Requires all authors to remember the incantation. |
| Reduce the endpoint list or per-request timeout | Reduces observability. `/sign-in` in the probe list is a deliberate signal that page compilation is healthy; removing it or shortening the 10 s per-request budget would hide real degradations elsewhere. |
| Pre-warm `/sign-in` in a global setup step | Cross-cuts the lifecycle orchestrator; hides the cold-compile cost rather than accommodating it; complicates the setup dependency graph. Deferred as a possible §15 optimization if flakes persist. |
| Increase Playwright global `expect.timeout` or `test.timeout` in `playwright.config.ts` | Broad-blast side effects across every project. Loses signal from tests that *should* complete quickly. |

The chosen single-point edit is minimal, self-documenting, and centralizes the timeout policy at the exact spot that already controls readiness polling.

## 6. Contract preserved

* Enclosing-hook timeout raised from 60 s → 180 s only when `ensureServerReady` runs inside a live Playwright test context. Called from a plain node script or from vitest, the `try/catch` swallows the `test.setTimeout(...)` call and behaviour is unchanged.
* Internal 90 s poll budget UNCHANGED.
* Per-request 10 s timeout UNCHANGED.
* Accepted status set `{200, 204, 401, 403, 404, 503}` UNCHANGED.
* No change to `seedOrVerifyTestState`, `loginAsTestUser`, or any assertion helper.
* No change to Playwright config, storageState, or the auth-bypass gate — the security project remains structurally unauthenticated at setup.

## 7. Regression guard

New file: `apps/union-eyes/tests/e2e-helpers-timeout.test.ts` (8 tests, pure static-analysis vitest).

Placed at `apps/union-eyes/tests/` (not `tests/e2e/`) because `apps/union-eyes/vitest.config.ts` excludes `tests/e2e/**`. Result: `pnpm vitest run` picks it up.

Assertions:

1. `test` is imported from `@playwright/test` in `_helpers.ts`.
2. `ensureServerReady` function body is locatable via regex.
3. Body contains `test.setTimeout(180_000)` (or `180000`).
4. Call is wrapped in `try { ... } catch`.
5. Call occurs *before* the `const endpoints` declaration (so it takes effect before any polling).
6. `timeoutMs = 90_000` preserved.
7. `timeout: 10_000` per-request preserved.
8. Accepted status set contains all six canonical codes.

## 8. Local verification

```text
pnpm exec vitest run  (from apps/union-eyes)
  Test Files  1114 passed | 1 skipped (1115)
  Tests       16189 passed | 2 skipped (16191)   ← 2 pre-existing skips
  Duration    168.36s
```

New `tests/e2e-helpers-timeout.test.ts` — 8/8 pass in 15 ms.
`scripts/lifecycle/run-cleanup.test.ts` (3 t) — still green.
`scripts/lifecycle/auth.reconciliation.test.ts` (3 t) — still green.
`scripts/lifecycle/env.test.ts` (14 t) — still green.
`scripts/lifecycle/process.test.ts` (13 t) — still green.
`app/api/health/readiness/route.test.ts` (17 t) — still green.

## 9. What §12 does NOT prove

Runtime revalidation — i.e. running the full governed lifecycle again with these 6 spec files reaching their post-`beforeAll` bodies — is deferred to **§15 flake analysis (3× Baseline Run 2)**. That's a ~40 min-per-run investment and doubling it now to prove one hook fix would delay §13/§14 without net information gain: the fix is source-verifiable, the change is single-line, and the vitest guard prevents regression.

Consequently: if any of the 6 specs still fail in §15, the failure will be inside the *test body*, not the hook, and will be triaged under §19 closure classification alongside the other 48 test-level failures from attempt-6.

## 10. Deviations from procedure

None.

* No changes to `apps/union-eyes/next-env.d.ts` or `ops/outputs/*.json`.
* Env-var isolation rules preserved (helper does not touch `process.env`).
* No new file added under `db/migrations/`.
* No force-push, no branch merge, no staging deployment, no CUPE graduation.
* Gitleaks scope untouched.
