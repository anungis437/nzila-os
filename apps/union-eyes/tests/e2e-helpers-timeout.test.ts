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

  it('preserves the pre-existing 90_000 ms internal poll budget', () => {
    // The §12 fix must not reduce the internal readiness poll window; it only
    // raises the enclosing test/hook ceiling so the inner loop can run to
    // completion. Regression guard against accidental double-shrinking.
    const body = ENSURE_FN_MATCH![1]
    expect(body).toMatch(/const\s+timeoutMs\s*=\s*90[_]?000/)
  })

  it('leaves the request per-attempt timeout at 10_000 ms', () => {
    // Playwright APIRequestContext.get({ timeout }) upper bound. Reducing it
    // would help beforeAll timing but hide legitimate slow endpoints. Kept
    // fixed as a governance signal.
    const body = ENSURE_FN_MATCH![1]
    expect(body).toMatch(/timeout:\s*10[_]?000/)
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
