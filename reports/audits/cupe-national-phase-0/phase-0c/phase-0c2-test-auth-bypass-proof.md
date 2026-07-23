# Phase 0C.2 §4 — Playwright E2E Auth Bypass Hardening Proof

**Status:** GREEN
**Scope:** `packages/platform-auth/src/password/auth-service.ts`
**Verdict:** Bypass is structurally impossible outside a governed E2E lifecycle context.

---

## 1. Executive Summary

The Phase 0C.1 implementation of the Playwright E2E auth bypass relied on **two conditions**:

1. `PLAYWRIGHT_TEST_AUTH === 'true'` in the process environment.
2. Request `User-Agent` contains the substring `playwright-e2e-auth`.

Phase 0C.2 §4 replaces that with a **six-gate positive-list allow-list** that fails closed on
every misconfigured or production-shaped input. The bypass now requires **all six** of the
following to be simultaneously true; if any single gate is missing the request is treated
as an ordinary production request (normal password verification + MFA + risk assessment).

| # | Gate | Requirement | Failure mode |
|---|------|-------------|--------------|
| 1 | `PLAYWRIGHT_TEST_AUTH` | must equal literal `"true"` | refuse + warn once |
| 2 | `QA_TEST_ENV` | must equal literal `"true"` | refuse + warn once |
| 3 | `NODE_ENV` | must be `test` or `development` (never `production`, `staging`, undefined, or empty) | refuse + warn once |
| 4 | `DATABASE_URL` | hostname must resolve to a loopback host (`localhost`, `127.0.0.1`, `::1`, `[::1]`, `0.0.0.0`) | refuse + warn once |
| 5 | `NEXT_PUBLIC_APP_URL` | hostname must resolve to a loopback host | refuse + warn once |
| 6 | `User-Agent` | must contain `playwright-e2e-auth` | refuse silently (no warn) |

Loopback is enforced by a **positive-list** (`LOOPBACK_HOSTS`), not a negative-list of production
hint strings. This is intentional — a future production host or a novel provider hostname
would slip past a negative list, but can never satisfy a positive-list loopback check.

The bypass logic is exported as a pure function `isPlaywrightE2EAuthAllowed(input, env)` so
that direct tests can exercise every combination without mutating `process.env`.

---

## 2. Compatibility with the governed lifecycle

The governed E2E lifecycle continues to satisfy all six gates because the lifecycle
orchestrator already sets each variable before booting the Next.js server:

| Gate | Source | Value in governed context |
|------|--------|---------------------------|
| 1 `PLAYWRIGHT_TEST_AUTH` | [`env.ts:150`](apps/union-eyes/scripts/lifecycle/env.ts#L150) & [`run.ts:239`](apps/union-eyes/scripts/lifecycle/run.ts#L239) | `"true"` |
| 2 `QA_TEST_ENV` | [`env.ts:150`](apps/union-eyes/scripts/lifecycle/env.ts#L150) & [`run.ts:239`](apps/union-eyes/scripts/lifecycle/run.ts#L239) | `"true"` |
| 3 `NODE_ENV` | [`run.ts:244`](apps/union-eyes/scripts/lifecycle/run.ts#L244) | `"test"` |
| 4 `DATABASE_URL` | disposable-DB allocator → `<REDACTED_LOCAL_DEV_PG_URL>` (host = `localhost`) | loopback |
| 5 `NEXT_PUBLIC_APP_URL` | [`run.ts:242`](apps/union-eyes/scripts/lifecycle/run.ts#L242) | `http://localhost:{port}` |
| 6 `User-Agent` | Playwright storageState generator sets `playwright-e2e-auth` header | present |

The `bootServer(env)` call receives the full merged environment, so the Next.js server
process (and therefore `auth-service.ts` at runtime) sees every gate satisfied.

---

## 3. Defence-in-depth refusal matrix

Every one of these scenarios is directly proven by a test (see §4 below):

| Environment | Result |
|-------------|--------|
| Production (`NODE_ENV=production`, loopback flags all set, magic UA) | **REFUSED** — Gate 3 |
| Staging (`NODE_ENV=test`, but `NEXT_PUBLIC_APP_URL=https://staging.unioneyes.app`) | **REFUSED** — Gate 5 |
| Azure Flexible Server DB (`DATABASE_URL` host = `x.postgres.database.azure.com`) | **REFUSED** — Gate 4 |
| AWS RDS DB (`DATABASE_URL` host = `x.rds.amazonaws.com`) | **REFUSED** — Gate 4 |
| Supabase DB (`DATABASE_URL` host = `x.supabase.co`) | **REFUSED** — Gate 4 |
| Public IP DB (`DATABASE_URL` host = `8.8.8.8`) | **REFUSED** — Gate 4 |
| Azure Container Apps app URL | **REFUSED** — Gate 5 |
| Ordinary local dev without `QA_TEST_ENV=true` | **REFUSED** — Gate 2 |
| Any request that does not present the magic UA (even fully green env) | **REFUSED** — Gate 6 (silent) |
| Malformed/unparseable `DATABASE_URL` | **REFUSED** — fail-closed |
| Malformed/unparseable `NEXT_PUBLIC_APP_URL` | **REFUSED** — fail-closed |
| Empty or undefined `NODE_ENV` | **REFUSED** — fail-closed |

---

## 4. Test evidence

**Test file:** [`packages/platform-auth/src/password/auth-service-bypass.test.ts`](packages/platform-auth/src/password/auth-service-bypass.test.ts)
**Command:**

```
pnpm --filter @nzila/platform-auth exec vitest run src/password/auth-service-bypass.test.ts --reporter=verbose
```

**Result:** 32 / 32 tests pass, exit code 0. Full log:
[`phase-0c2-test-auth-bypass-tests.log`](reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-test-auth-bypass-tests.log).

**Full package regression** (`pnpm --filter @nzila/platform-auth exec vitest run`):
9 test files, **125 / 125 tests pass** (was 93 before §4). No regressions in
`assess.test.ts`, `admin.test.ts`, `password.test.ts`, `middleware.test.ts`,
`totp.test.ts`, `identity.test.ts`, `guards.test.ts`, `authorization.test.ts`.

**Typecheck** (`pnpm --filter @nzila/platform-auth typecheck`): exit code 0.

---

## 5. Test organisation

| Describe block | Tests | Focus |
|----------------|-------|-------|
| §4 baseline — all gates satisfied | 4 | ALLOWS bypass in every governed loopback shape |
| §4 gate 6 — User-Agent absence is silent | 3 | Missing/empty/ordinary UA refuses without warning |
| §4 gate 1 — PLAYWRIGHT_TEST_AUTH | 3 | undefined / "false" / "1" refuses (warns on undefined) |
| §4 gate 2 — QA_TEST_ENV | 2 | undefined / "false" refuses |
| §4 gate 3 — NODE_ENV never production | 4 | production / staging / undefined / empty refuses |
| §4 gate 4 — DATABASE_URL must be loopback | 6 | Azure / RDS / Supabase / undefined / unparseable / public IP refuses |
| §4 gate 5 — NEXT_PUBLIC_APP_URL must be loopback | 5 | production / staging / ACA / undefined / unparseable refuses |
| §4 defence-in-depth — worst-case leak scenarios | 4 | Production + full flag set still refuses; staging refuses; no UA refuses |
| §4 warn-once behaviour | 1 | 3 identical refusals ⇒ exactly 1 `console.warn` |

Total: **32 tests**.

---

## 6. Non-changes (preserved by design)

The following code paths were **not touched** by §4 and remain in the login flow exactly as
before the hardening:

- Password verification via `verifyPassword` and Argon2id rehash.
- Session issuance via `createSession` and `setSessionCookie`.
- Audit logging via `authAuditLog` inserts.
- Account lockout after `MAX_FAILED_ATTEMPTS` (5) with `LOCKOUT_DURATION_MS` (15 min).
- Rate limiting on password reset (`MAX_RESET_REQUESTS`, `RATE_LIMIT_WINDOW_MS`).
- MFA challenge issuance for accounts with TOTP enabled (bypass only skips MFA when
  all six gates are satisfied — a scenario that is by construction impossible outside
  a governed E2E run).
- Risk-assessment path via `assessRisk`.

The bypass only short-circuits MFA and risk assessment for fixture users in a governed
E2E run. The password *is still verified*, the session *is still written to Postgres*,
and the audit log *is still updated*.

---

## 7. Test-only surface

The following export exists solely so that unit tests can reset warn-once state between
scenarios; it is not intended for application use and is not re-exported from the package
index:

```ts
/** @internal Test-only: reset the per-process warn-once cache. */
export function __resetPlaywrightBypassWarnCacheForTests(): void
```

The pure gate function is also exported for direct testing:

```ts
export interface PlaywrightBypassEnv {
  PLAYWRIGHT_TEST_AUTH?: string | undefined
  QA_TEST_ENV?: string | undefined
  NODE_ENV?: string | undefined
  DATABASE_URL?: string | undefined
  NEXT_PUBLIC_APP_URL?: string | undefined
}
export function isPlaywrightE2EAuthAllowed(
  input: { userAgent?: string | null },
  env: PlaywrightBypassEnv,
): boolean
```

---

## 8. Verdict

**GREEN.** The Playwright authentication bypass is structurally impossible outside a
governed test execution:

- Positive-list loopback enforcement guarantees no future production host can accidentally
  satisfy Gates 4 or 5.
- Fail-closed handling of undefined / unparseable / empty inputs guarantees Gates 3–5
  never accidentally pass in a partial or misconfigured environment.
- Direct combination tests (32 / 32 pass) prove production refusal without touching the
  database or the login flow.
- No regressions in the existing 93 platform-auth tests — the full package suite reports
  125 / 125 pass.

Ready to proceed to §5 (managed-server handshake).
