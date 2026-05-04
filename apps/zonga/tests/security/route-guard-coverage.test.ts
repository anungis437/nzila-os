/**
 * Route guard coverage — Phase 3 Scenarios 5, 6, 8.
 *
 * These tests are deliberately introspection-based: they read the on-disk
 * source of `proxy.ts` and `app/api/payouts/route.ts` and assert that the
 * expected guard primitives are present. If a future change removes a
 * guard, public matcher entry, or fail-closed branch, the relevant test
 * will fail — preventing silent regressions to Zonga's controlled-launch
 * security posture.
 *
 * Scenario 5 — Middleware/proxy failure fails closed for protected routes.
 * Scenario 6 — Public marketing routes remain accessible (matcher present).
 * Scenario 8 — Future routes cannot bypass `withOrgScope` / `requireRole`
 *               for payout mutation without breaking the contract.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const proxySrc = readFileSync(resolve(__dirname, '../../proxy.ts'), 'utf8')
const payoutRouteSrc = readFileSync(
  resolve(__dirname, '../../app/api/payouts/route.ts'),
  'utf8',
)

describe('Scenario 6 — public marketing routes remain accessible', () => {
  const publicMatcherEntries = [
    "'/'",
    "'/about(.*)'",
    "'/pricing(.*)'",
    "'/contact(.*)'",
    "'/artists(.*)'",
    "'/events(.*)'",
    "'/for-labels(.*)'",
  ]

  for (const entry of publicMatcherEntries) {
    it(`proxy.ts publicly matches ${entry}`, () => {
      expect(proxySrc).toContain(entry)
    })
  }

  it('proxy.ts skips locale redirect for marketing pages via isMarketingPath', () => {
    expect(proxySrc).toMatch(/isMarketingPath\s*\(/)
  })

  it('proxy.ts whitelists /api/auth and /api/health public APIs', () => {
    expect(proxySrc).toContain("'/api/auth(.*)'")
    expect(proxySrc).toContain("'/api/health(.*)'")
  })
})

describe('Scenario 5 — middleware fails CLOSED for protected routes', () => {
  it('proxy.ts wraps handler in try/catch with MIDDLEWARE_FAILURE 503 branch', () => {
    expect(proxySrc).toMatch(/catch\s*\(\s*err\b/)
    expect(proxySrc).toContain('MIDDLEWARE_FAILURE')
    expect(proxySrc).toContain('status: 503')
  })

  it('proxy.ts only allows fail-OPEN fallback in development', () => {
    expect(proxySrc).toMatch(
      /process\.env\.NODE_ENV\s*===\s*'development'[\s\S]*?NextResponse\.next\(\)/,
    )
  })

  it('proxy.ts enforces auth.protect() for non-public routes', () => {
    expect(proxySrc).toMatch(/if\s*\(\s*!isPublicRoute\s*\(\s*request\s*\)\s*\)/)
    expect(proxySrc).toMatch(/await\s+auth\.protect\s*\(\s*\)/)
  })

  it('proxy.ts uses authMiddleware from @nzila/platform-auth/entra/server', () => {
    expect(proxySrc).toContain('@nzila/platform-auth/entra/server')
    expect(proxySrc).toMatch(/authMiddleware\s*\(/)
  })
})

describe('Scenario 8 — payout route cannot bypass org/role guards', () => {
  it('GET handler is wrapped in withOrgScope', () => {
    const getBlock = payoutRouteSrc.match(
      /export\s+async\s+function\s+GET[\s\S]*?(?=\n(?:export\s+async\s+function|const\s+\w+\s*=))/,
    )
    expect(getBlock).not.toBeNull()
    expect(getBlock?.[0]).toMatch(/withOrgScope\s*\(\s*request/)
  })

  it('POST handler is wrapped in withOrgScope', () => {
    const postBlock = payoutRouteSrc.match(
      /export\s+async\s+function\s+POST[\s\S]*$/,
    )
    expect(postBlock).not.toBeNull()
    expect(postBlock?.[0]).toMatch(/withOrgScope\s*\(\s*request/)
  })

  it('GET handler enforces requireRole with finance_admin or client_admin', () => {
    const getBlock = payoutRouteSrc.match(
      /export\s+async\s+function\s+GET[\s\S]*?(?=\n(?:export\s+async\s+function|const\s+\w+\s*=))/,
    )
    expect(getBlock?.[0]).toMatch(
      /requireRole\s*\(\s*orgId\s*,\s*\[\s*'finance_admin'\s*,\s*'client_admin'\s*\]\s*\)/,
    )
  })

  it('POST handler enforces requireRole with finance_admin only', () => {
    const postBlock = payoutRouteSrc.match(
      /export\s+async\s+function\s+POST[\s\S]*$/,
    )
    expect(postBlock?.[0]).toMatch(
      /requireRole\s*\(\s*orgId\s*,\s*\[\s*'finance_admin'\s*\]\s*\)/,
    )
  })

  it('POST handler returns the role guard response when role check fails', () => {
    const postBlock = payoutRouteSrc.match(
      /export\s+async\s+function\s+POST[\s\S]*$/,
    )
    expect(postBlock?.[0]).toMatch(/if\s*\(\s*!roleGuard\.ok\s*\)\s*return\s+roleGuard\.response/)
  })

  it('POST handler enforces decision preflight before executing payout', () => {
    const postBlock = payoutRouteSrc.match(
      /export\s+async\s+function\s+POST[\s\S]*$/,
    )
    // The preflight enforceDecision must appear BEFORE executePayout.
    const text = postBlock?.[0] ?? ''
    const preflightIdx = text.indexOf('enforceDecision')
    const executeIdx = text.indexOf('executePayout')
    expect(preflightIdx).toBeGreaterThan(-1)
    expect(executeIdx).toBeGreaterThan(-1)
    expect(preflightIdx).toBeLessThan(executeIdx)
  })

  it('payout route imports guards from @/lib/api-guards (not bypassed)', () => {
    expect(payoutRouteSrc).toMatch(
      /import\s*\{\s*withOrgScope\s*,\s*requireRole\s*\}\s*from\s*'@\/lib\/api-guards'/,
    )
  })
})
