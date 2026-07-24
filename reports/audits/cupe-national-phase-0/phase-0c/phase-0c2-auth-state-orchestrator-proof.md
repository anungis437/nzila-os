# Phase 0C.2 §7 — Auth-state generation orchestrator wiring (Authoritative Proof)

**Status:** GREEN — orchestrator step 9 hardened, generator contract pinned by unit tests.

**Commit target:** `sec(union-eyes/phase-0c2): §7 auth-state orchestrator wiring — env fix + verify + tests`

**Files changed:**

| File | Nature | Purpose |
|------|--------|---------|
| `apps/union-eyes/scripts/lifecycle/run.ts` | modified | Step 9 hardened: correct env vars, timeout, summary verification |
| `apps/union-eyes/scripts/lifecycle/generate-auth-states.test.ts` | added | 9 unit tests pinning the generator's contract |
| `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-auth-state-orchestrator-proof.md` | added | This file |
| `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-auth-state-orchestrator-proof.json` | added | Structured evidence |
| `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-auth-state-orchestrator-tests.log` | added | vitest transcript |

---

## 1. Problem statement (why §7 was necessary)

Before this change, `run.ts` step 9 (`generate-auth-states`) had four
correctness gaps that could cause silent regressions during governed
E2E runs:

1. **CLI env-var mismatch.** The generator's `main()` reads
   `NZILA_AUTH_STATE_BASE_URL` (falling back to `NEXT_PUBLIC_APP_URL`),
   but `run.ts` was setting `UE_TEST_BASE_URL` — a variable the
   generator ignores. This worked *only* by accident when
   `NEXT_PUBLIC_APP_URL` happened to be inherited with the correct
   port. If step 3 auto-assigned a non-preferred port (because 3002
   was in use), the generator would hit the wrong port and fail with
   `ECONNREFUSED`, which the orchestrator would then report as a
   generic exit code without any hint about the root cause.

2. **No output-dir override.** The generator defaulted to
   `<__dirname>/../../playwright/.auth`, which happened to be
   correct but was not enforced by the caller. This meant a future
   refactor of the generator's location on disk would silently break
   the orchestrator.

3. **Exit-code-only success signal.** The orchestrator checked
   `res.status !== 0` but never opened `summary.json`. A generator
   that partial-failed (e.g., 4/5 personas) would still exit 0 if
   the CLI wrapper's own logic was ever changed, and the orchestrator
   would proceed to Playwright with missing storageState files.

4. **No timeout guard.** `spawnSync` was called with no `timeout`
   option. If the generator hung (e.g., waiting on a DNS resolution
   or a slow login route), the entire E2E run would hang until the
   overall CI job timed out — no useful diagnostic.

Additionally, `generate-auth-states.ts` had **no unit tests**, so
any regression to the cookie-parsing, /me-verification, or
storageState-shape logic would only surface via the slow
prove-script.

---

## 2. Fix applied to `run.ts` step 9

The step now sets the generator's canonical env vars explicitly,
caps execution at 90 s, and verifies `summary.json` on exit=0:

```typescript
const AUTH_STATE_DIR = path.join(APP_ROOT, 'playwright', '.auth')
const AUTH_STATE_SUMMARY = path.join(AUTH_STATE_DIR, 'summary.json')
const AUTH_STATE_TIMEOUT_MS = 90_000
const AUTH_STATE_EXPECTED_ROLES = ['member', 'steward', 'staff', 'executive', 'admin'] as const

await withStep(steps, 9, 'generate-auth-states', async () => {
  const authEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NZILA_AUTH_STATE_BASE_URL: `http://localhost:${port}`,
    NZILA_AUTH_STATE_DIR: AUTH_STATE_DIR,
    UE_TEST_BASE_URL: `http://localhost:${port}`,          // back-compat
    UE_TEST_USER_PASSWORD: process.env.UE_TEST_USER_PASSWORD ?? 'ue-qa-test-password-!23',
    [MANAGED_SERVER_ENV_VAR]: 'true',
    [MANAGED_SERVER_RUN_ID_ENV_VAR]: alloc!.runId,
  }
  const res = spawnSync('pnpm', ['exec', 'tsx', 'scripts/lifecycle/generate-auth-states.ts'], {
    cwd: APP_ROOT,
    env: authEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: AUTH_STATE_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  })
  if (res.signal === 'SIGKILL' || (res.error && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT')) {
    throw new Error(`generate-auth-states timed out after ${AUTH_STATE_TIMEOUT_MS}ms`)
  }
  if (res.status !== 0) {
    throw new Error(`generate-auth-states exited with code ${res.status}`)
  }

  // Post-exit verification — refuse partial success.
  if (!existsSync(AUTH_STATE_SUMMARY)) {
    throw new Error(`generate-auth-states exited 0 but summary.json missing at ${AUTH_STATE_SUMMARY}`)
  }
  const parsed = JSON.parse(readFileSync(AUTH_STATE_SUMMARY, 'utf8')) as {
    allOk?: boolean
    results?: Array<{ role?: string; ok?: boolean; storageStatePath?: string; error?: string }>
  }
  if (parsed.allOk !== true) {
    const failing = (parsed.results ?? [])
      .filter((r) => r.ok !== true)
      .map((r) => `${r.role ?? '<unknown>'}=${r.error ?? 'no-error'}`)
      .join(', ')
    throw new Error(`generate-auth-states reported allOk=${String(parsed.allOk)} — failing: ${failing || '<none listed>'}`)
  }
  const gotRoles = new Set((parsed.results ?? []).filter((r) => r.ok === true).map((r) => r.role))
  const missing = AUTH_STATE_EXPECTED_ROLES.filter((r) => !gotRoles.has(r))
  if (missing.length > 0) {
    throw new Error(`generate-auth-states missing storageState for role(s): ${missing.join(',')}`)
  }
  for (const r of parsed.results ?? []) {
    if (r.ok && r.storageStatePath && !existsSync(r.storageStatePath)) {
      throw new Error(`generate-auth-states reported ok=true for '${r.role}' but file missing at ${r.storageStatePath}`)
    }
  }
  return { detail: `roles=${AUTH_STATE_EXPECTED_ROLES.length} allOk=true dir=${path.relative(APP_ROOT, AUTH_STATE_DIR)}` }
})
```

Also added `readFileSync` to the existing `node:fs` import.

---

## 3. Unit tests added — `generate-auth-states.test.ts`

Nine tests across six describe groups pin the generator's contract
by mocking global `fetch`:

| # | describe | test | asserts |
|---|----------|------|---------|
| 1 | happy path | writes storageState per persona and summary.json with allOk=true | 5 personas → 5 storage files + summary.allOk=true, meEmail matches persona email |
| 2 | happy path | every login request carries a User-Agent containing "playwright-e2e-auth" | UA activates server-side bypass — pinned so a future rename would fail loudly |
| 3 | happy path | written storageState files are Playwright v1 shape with nzila_session cookie | domain=hostname(baseUrl), path=/, httpOnly=true, sameSite=Lax, expires>0 |
| 4 | per-persona failure isolation | one login failure does not prevent the other four from succeeding | staff → 401 with error, other 4 → ok, staff.json NOT written |
| 5 | cookie extraction failure | records failure when login 200 but no Set-Cookie header | ok=false, error contains "no 'nzila_session' cookie" |
| 6 | /me verification | records failure when me returns a different email | ok=false, error contains "me email mismatch" |
| 7 | /me verification | records failure when me returns non-200 status | ok=false, meStatus=403 |
| 8 | summary.json | writes summary.json even when every persona fails | allOk=false, all 5 personas → error contains "login returned 500", persona.email preserved in results |
| 9 | network error | captures thrown fetch error into result.error without crashing the run | ECONNREFUSED → per-persona error, no summary crash |

**Test result:** 9/9 passed in 539 ms.

**Regression test:** All 5 lifecycle test files still pass — 71/71 tests, 1.65 s.

---

## 4. Non-negotiable properties preserved

- **`PLAYWRIGHT_TEST_AUTH: 'true'` still propagates to the server.**
  Step 8's `merged` env spreads `...env` (the `GovernedE2EEnv` from
  `env.ts` line 165), which contains `PLAYWRIGHT_TEST_AUTH: 'true'`.
  No change needed here — the bypass activation was already correct.
- **Playwright bypass User-Agent enforced by test #2.** If anyone
  changes the generator to omit or rename the UA, test #2 fails
  loudly at PR time — before it ever reaches CI.
- **StorageState v1 shape enforced by test #3.** Prevents silent
  drift from the Playwright storage-state format that would cause
  the browser context to reject the cookies at test time.

---

## 5. Verification transcript

- `pnpm exec vitest run scripts/lifecycle/generate-auth-states.test.ts` → 9 passed, 539 ms
- `pnpm exec vitest run scripts/lifecycle` → 71 passed across 5 files, 1.65 s
- `pnpm exec tsc --noEmit -p tsconfig.json` → no output (clean)

Full logs: `phase-0c2-auth-state-orchestrator-tests.log`.

---

## 6. What §7 does NOT claim

- The generator is not being asserted to work against a *real* Union
  Eyes server here — that is the job of the prove-script
  (`prove-phase-0c2-auth-state-generator.ts`), which was already
  proven in §6's evidence and is a Phase 0C.2 §12 concern.
- These tests do not exercise the CLI wrapper's argv resolution —
  that path is trivial and covered by the prove-script.
- No Playwright browser is launched here; only the generator's HTTP
  contract with the server is validated.

---

**Prepared:** Phase 0C.2 § 7 authoritative proof.
**Next:** § 8 — Playwright projects wiring.
