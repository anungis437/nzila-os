import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 0C.2 §11 regression — loginAsRole storageState reconciliation.
 *
 * Guards the fix landed in `apps/union-eyes/e2e/helpers/auth.ts` so a
 * future refactor cannot silently reintroduce the pre-§11 behaviour
 * where a synthetic `nzila_session=ue-seed-session-*` cookie overwrote
 * the real session cookie loaded from `playwright/.auth/<role>.json`.
 *
 * Lives under `scripts/lifecycle/` (not under `e2e/`) because the app's
 * vitest.config.ts excludes `e2e/**` — the Playwright directory is
 * strictly a Playwright execution surface. This source-level guard
 * runs alongside the other Phase 0C.2 lifecycle regression tests.
 *
 * Runtime validation of the reconciled behaviour is exercised by the
 * governed Playwright suite (Baseline Run 2+).
 */
describe('Phase 0C.2 §11 — loginAsRole storageState reconciliation (source guard)', () => {
  const authSrc = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'e2e', 'helpers', 'auth.ts'),
    'utf8',
  )

  it('inspects existing cookies inside the PLAYWRIGHT_TEST_AUTH branch', () => {
    expect(authSrc).toMatch(/page\.context\(\)\.cookies\(cookieUrl\)/)
  })

  it('short-circuits synthetic cookie injection when a real session is present', () => {
    expect(authSrc).toMatch(/hasRealSession/)
    expect(authSrc).toMatch(/if\s*\(hasRealSession\)/)
  })

  it('preserves legacy synthetic-cookie fallback for specs without storageState', () => {
    expect(authSrc).toMatch(/ue-seed-session-\$\{fixture\.userId\}/)
  })
})
