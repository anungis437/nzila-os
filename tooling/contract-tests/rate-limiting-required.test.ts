/**
 * Contract Test — Rate Limiting Required
 *
 * Structural invariant: All public-facing routes must be rate-limited.
 * Org-scoped rate limiting must be available in os-core. The Console
 * middleware must enforce IP-based rate limiting.
 *
 * @invariant RATE_LIMITING_REQUIRED_002
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('RATE_LIMITING_REQUIRED_002 — Rate limiting on public routes', () => {
  it('os-core exports rateLimit primitives', () => {
    const rateLimitPath = join(ROOT, 'packages', 'os-core', 'src', 'rateLimit.ts')
    expect(existsSync(rateLimitPath), 'packages/os-core/src/rateLimit.ts must exist').toBe(true)

    const content = readFileSync(rateLimitPath, 'utf-8')
    expect(content).toContain('checkRateLimit')
    expect(content).toContain('rateLimitHeaders')
  })

  it('os-core exports org-scoped rate limiting', () => {
    const orgRateLimitPath = join(ROOT, 'packages', 'os-core', 'src', 'orgRateLimit.ts')
    expect(existsSync(orgRateLimitPath), 'packages/os-core/src/orgRateLimit.ts must exist').toBe(true)

    const content = readFileSync(orgRateLimitPath, 'utf-8')
    expect(content).toContain('export function checkOrgRateLimit')
    expect(content).toContain('classifyRoute')
    expect(content).toContain('orgRateLimitHeaders')
    expect(content).toContain('getThrottleLog')
    expect(content).toContain('getThrottleStats')
  })

  it('os-core package.json exports orgRateLimit sub-path', () => {
    const pkgPath = join(ROOT, 'packages', 'os-core', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.exports['./orgRateLimit']).toBeDefined()
  })

  it('Console proxy applies rate limiting', () => {
    const mwPath = join(ROOT, 'apps', 'console', 'proxy.ts')
    const content = readFileSync(mwPath, 'utf-8')

    expect(content).toContain('checkRateLimit')
    expect(content).toContain('rateLimitHeaders')
    expect(content).toContain('429')
    expect(content).toContain('Too Many Requests')
  })

  it('rate limit is IP-based with configurable max and window', () => {
    const mwPath = join(ROOT, 'apps', 'console', 'proxy.ts')
    const content = readFileSync(mwPath, 'utf-8')

    expect(content).toContain('RATE_LIMIT_MAX')
    expect(content).toContain('RATE_LIMIT_WINDOW_MS')
    expect(content).toContain('x-forwarded-for')
  })

  it('DB schema includes rate limit throttle logging table', () => {
    const schemaPath = join(ROOT, 'packages', 'db', 'src', 'schema', 'platform.ts')
    const content = readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('platformRateLimitThrottles')
  })
})
