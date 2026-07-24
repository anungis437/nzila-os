import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 0C.2 §11 (fix c) regression — run.ts finally-block cleanup.
 *
 * Guards the fix landed in `apps/union-eyes/scripts/lifecycle/run.ts` so
 * a future refactor cannot silently reintroduce the pre-§11 bug where
 * `stopServer()` was only invoked when the outer `boot` variable was
 * truthy. Because `boot` is only assigned when `withStep(...)` RETURNS a
 * value, a readiness-fail throw inside step 8 left `boot` undefined even
 * though `bootServer()` had already spawned a child and written pid.json,
 * orphaning the Next.js process and producing EADDRINUSE on the next run.
 *
 * The fix removes the `if (boot)` guard and always calls `stopServer()`
 * inside the finally block — `stopServer()` internally handles the
 * "no pid.json" case by returning `{ method: 'no-record' }`.
 */
describe('Phase 0C.2 §11 (fix c) — run.ts always-stop-server cleanup (source guard)', () => {
  const runSrc = fs.readFileSync(path.resolve(__dirname, 'run.ts'), 'utf8')

  it('calls stopServer() unconditionally inside the finally block', () => {
    // Grab everything between the outer `} finally {` and the next
    // step marker (Step 13 — Drop DB) so we only reason about the
    // cleanup region, not the happy-path body of step 8.
    const finallyMatch = runSrc.match(
      /}\s*finally\s*{([\s\S]*?)\/\/\s*Step 13/,
    )
    expect(finallyMatch, 'expected finally block preceding Step 13').not.toBeNull()
    const finallyBody = finallyMatch![1]

    // Assert the call site is present.
    expect(finallyBody).toMatch(/stopServer\s*\(/)

    // Assert the call is NOT gated by `if (boot)`. This is the exact
    // regression signature: any `if\s*\(\s*boot` immediately upstream
    // of stopServer indicates the pre-§11 (fix c) behaviour returned.
    const guardedPattern = /if\s*\(\s*boot\s*\)\s*{[^}]*stopServer/s
    expect(finallyBody).not.toMatch(guardedPattern)
  })

  it('preserves a step-12 record even when stopServer is a no-op', () => {
    // The finally block must still push a Step 12 record (outcome
    // ok/skipped/failed) so run-summary.json stays deterministic.
    const finallyMatch = runSrc.match(
      /}\s*finally\s*{([\s\S]*?)\/\/\s*Step 13/,
    )
    const finallyBody = finallyMatch![1]
    expect(finallyBody).toMatch(/step:\s*12/)
    expect(finallyBody).toMatch(/id:\s*['"]stop-server['"]/)
  })

  it('documents the fix c rationale in a source comment', () => {
    // A reviewer stumbling on the always-call must find the "why".
    // Keep the token stable so we can grep for it in future refactors.
    expect(runSrc).toMatch(/Phase 0C\.2 §11 \(fix c\)/)
    expect(runSrc).toMatch(/no-record/)
  })
})
