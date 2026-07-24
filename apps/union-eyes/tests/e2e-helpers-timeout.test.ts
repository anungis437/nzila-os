/**
 * Phase 0C.2 §12 — cross-org security tests: beforeAll timeout guard
 *
 * Baseline Run 2 attempt-6 (canonical run 20260724022239_79178c) showed all 6
 * spec files in the Playwright `security` project timing out in their
 * `test.beforeAll` hook at the default 60 000 ms ceiling. Every failure traced
 * to `tests/e2e/_helpers.ts::ensureServerReady(...)` — which internally polls
 * up to 90 s and makes 3 endpoint requests per iteration each capped at 10 s.
 * In Next.js dev mode with a cold worker the first SSR compile of `/sign-in`
 * alone can burst 30–45 s, so two poll iterations exceed the 60 s hook
 * ceiling.
 *
 * §12 fix: `ensureServerReady` now calls `test.setTimeout(180_000)` on entry
 * (wrapped in try/catch so it is a safe no-op outside a live test/hook
 * context). This raises the enclosing beforeAll/beforeEach/test timeout to
 * 180 s so `ensureServerReady`'s own 90 s inner budget can fully expire before
 * Playwright kills the hook.
 *
 * This vitest source-guard pins the fix in `_helpers.ts` so it cannot regress
 * silently. It is a pure static-analysis test — it does not execute
 * `_helpers.ts` (which would require a Playwright runtime).
 *
 * Placed at `apps/union-eyes/tests/` (NOT `tests/e2e/`) because vitest's
 * `exclude` in `vitest.config.ts` explicitly skips `tests/e2e/**`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const HELPERS_PATH = resolve(HERE, 'e2e', '_helpers.ts')
const HELPERS_SOURCE = readFileSync(HELPERS_PATH, 'utf-8')

// Extract the ensureServerReady function body once — reused across assertions.
const ENSURE_FN_MATCH = HELPERS_SOURCE.match(
  /export\s+async\s+function\s+ensureServerReady\s*\([^)]*\)\s*:\s*Promise<void>\s*\{([\s\S]*?)\n\}/,
)

describe('Phase 0C.2 §12 — _helpers.ts ensureServerReady beforeAll timeout', () => {
  it('imports `test` from @playwright/test so it can call test.setTimeout', () => {
    // The import must include `test` alongside the pre-existing `expect` and
    // `APIRequestContext` type. A separate `import test from ...` line is not
    // acceptable because it fragments the module contract.
    expect(HELPERS_SOURCE).toMatch(
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/,
    )
  })

  it('locates the ensureServerReady function body', () => {
    expect(
      ENSURE_FN_MATCH,
      'ensureServerReady function not found in _helpers.ts',
    ).not.toBeNull()
  })

  it('calls test.setTimeout(180_000) inside ensureServerReady', () => {
    const body = ENSURE_FN_MATCH![1]
    // 180_000 (with underscore) OR 180000 (without) both acceptable.
    expect(body).toMatch(/test\.setTimeout\(\s*180[_]?000\s*\)/)
  })

  it('wraps test.setTimeout in try/catch so it is a safe no-op outside a hook', () => {
    // The try/catch must enclose the setTimeout call. If someone removes the
    // guard the helper becomes unusable from plain scripts (e.g. lifecycle
    // orchestrator probes) that happen to import it.
    const body = ENSURE_FN_MATCH![1]
    // Look for a `try { ... test.setTimeout(...) ... } catch` shape. Use [\s\S]
    // to tolerate multi-line and comments inside the try block.
    expect(body).toMatch(
      /try\s*\{[\s\S]*?test\.setTimeout\(\s*180[_]?000\s*\)[\s\S]*?\}\s*catch/,
    )
  })

  it('places the timeout call BEFORE the endpoints iteration begins', () => {
    // Regression guard: if the call sinks below the poll loop it does not run
    // until the first fetch already returned, defeating the purpose of the fix.
    const body = ENSURE_FN_MATCH![1]
    const setTimeoutIdx = body.indexOf('test.setTimeout(')
    const endpointsIdx = body.indexOf('const endpoints')
    expect(setTimeoutIdx, 'test.setTimeout call not found').toBeGreaterThan(-1)
    expect(endpointsIdx, 'endpoints constant not found').toBeGreaterThan(-1)
    expect(setTimeoutIdx).toBeLessThan(endpointsIdx)
  })

  it('raises the internal poll budget to 180_000 ms (Phase 0C.2R §8 / FSR-A repair)', () => {
    // Phase 0C.2R §8 (FSR-A repair): §BR-9 Run 3 showed 30/50 baseline failures
    // sharing the identical `Server readiness check timed out after 90000ms`
    // signature across 29 unique specs in 8 projects. The prior 90_000 ms
    // helper budget wasted 90 s of headroom relative to the §12 enclosing
    // `test.setTimeout(180_000)`. Raising the internal budget to 180_000 ms
    // aligns the helper with its caller's ceiling.
    //
    // See reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-failure-signature-register.md
    // §7.3 for the full blast-radius table.
    const body = ENSURE_FN_MATCH![1]
    expect(body).toMatch(/const\s+timeoutMs\s*=\s*180[_]?000/)
    // Explicitly reject the pre-repair 90_000 value so a merge that restores
    // it fails fast.
    expect(body).not.toMatch(/const\s+timeoutMs\s*=\s*90[_]?000/)
  })

  it('raises the per-request Playwright timeout to 30_000 ms (Phase 0C.2R §8 / FSR-A repair)', () => {
    // Per-request 10 s cap tripped inside a single cold `/sign-in` SSR compile
    // before the other two endpoints could be polled. 30 s gives each endpoint
    // enough headroom to complete a legitimately-slow first hit while still
    // being short enough that a persistent server hang throws inside the
    // enclosing 180 s test wrapper.
    const body = ENSURE_FN_MATCH![1]
    expect(body).toMatch(/const\s+perRequestTimeoutMs\s*=\s*30[_]?000/)
    // The get() call must reference the constant (not a hard-coded literal),
    // so `perRequestTimeoutMs` remains the single source of truth.
    expect(body).toMatch(/request\.get\([^)]+\{\s*timeout:\s*perRequestTimeoutMs\s*\}\)/)
    // Explicitly reject the pre-repair 10_000 literal so it cannot silently
    // return.
    expect(body).not.toMatch(/timeout:\s*10[_]?000/)
  })

  it('accepts the canonical health status set (200/204/401/403/404/503)', () => {
    // Guard against accidental narrowing of the accepted-status list, which
    // would cause spurious beforeAll timeouts when the sidecar reports
    // degraded (503) or when /sign-in short-circuits with 401.
    const body = ENSURE_FN_MATCH![1]
    for (const status of [200, 204, 401, 403, 404, 503]) {
      expect(body).toMatch(new RegExp(`\\b${status}\\b`))
    }
  })
})
