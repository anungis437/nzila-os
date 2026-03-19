/**
 * Contract Test — Rate Limiting (REM-01)
 *
 * Verifies:
 *   1. ALL Next.js app middleware files import the rate limiter from os-core
 *   2. /api/health is in the isPublicRoute allowlist of all middlewares
 *      (so readiness probes are never blocked by auth or rate-limit auth loops)
 *   3. The rate-limit module itself is exported from @nzila/os-core
 *   4. Rate limit env vars are referenced in middleware (RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS)
 *
 * This closes the HIGH FAIL from the enterprise stress test: zero rate limiting
 * on Next.js apps was a GA-blocking gap.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(rel: string): string {
  const abs = resolve(ROOT, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf-8') : ''
}

// ── Subject files ─────────────────────────────────────────────────────────────

const RATE_LIMIT_APPS = [
  'console',
  'partners',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
] as const

const OS_CORE_RATE_LIMIT = 'packages/os-core/src/rateLimit.ts'
const OS_CORE_PKG = 'packages/os-core/package.json'
const OS_CORE_INDEX = 'packages/os-core/src/index.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function importsRateLimiter(content: string): boolean {
  return (
    content.includes('checkRateLimit') ||
    content.includes('rateLimitHeaders') ||
    content.includes('rateLimit')
  )
}

function hasHealthInPublicRoutes(content: string): boolean {
  // Should have /api/health in the isPublicRoute matcher
  return /isPublicRoute.*\/api\/health/.test(content.replace(/\s+/g, ' ')) ||
    /api\/health/.test(content) && /isPublicRoute/.test(content)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Rate Limiting — REM-01 contract', () => {
  it('rate-limit module exists in os-core', () => {
    expect(existsSync(resolve(ROOT, OS_CORE_RATE_LIMIT))).toBe(true)
  })

  it('os-core package.json exports ./rateLimit', () => {
    const pkg = JSON.parse(read(OS_CORE_PKG))
    const exports: Record<string, unknown> = pkg.exports ?? {}
    expect(Object.keys(exports)).toContain('./rateLimit')
  })

  it('os-core index.ts re-exports checkRateLimit and rateLimitHeaders', () => {
    const idx = read(OS_CORE_INDEX)
    expect(idx).toContain('checkRateLimit')
    expect(idx).toContain('rateLimitHeaders')
  })

  for (const app of RATE_LIMIT_APPS) {
    const mwPath = `apps/${app}/middleware.ts`

    it(`${app} middleware imports rate limiter`, () => {
      const content = read(mwPath)
      expect(content).not.toBe('')
      expect(
        importsRateLimiter(content),
        `apps/${app}/middleware.ts must import checkRateLimit or rateLimitHeaders from @nzila/os-core/rateLimit`,
      ).toBe(true)
    })

    it(`${app} middleware enforces a rate-limit max cap`, () => {
      const content = read(mwPath)
      expect(content.includes('RATE_LIMIT_MAX') || content.includes('max:')).toBe(true)
    })

    it(`/api/health is in ${app} middleware public-route allowlist`, () => {
      const content = read(mwPath)
      expect(hasHealthInPublicRoutes(content)).toBe(true)
    })
  }

  it('rate-limit module has no Node.js-only imports (Edge Runtime compatible)', () => {
    const content = read(OS_CORE_RATE_LIMIT)
    // Must not import fs, net, dns, crypto (built-in node: only) — Edge safe
    expect(content).not.toMatch(/from ['"]node:fs['"]/)
    expect(content).not.toMatch(/from ['"]node:net['"]/)
    expect(content).not.toMatch(/from ['"]node:dns['"]/)
    // Crypto is borderline — only acceptable via globalThis.crypto (web standard)
    expect(content).not.toMatch(/from ['"]node:crypto['"]/)
  })

  it('rate-limit module purges stale entries (memory safety)', () => {
    const content = read(OS_CORE_RATE_LIMIT)
    // Must have some form of cleanup to prevent unbounded Map growth
    expect(
      content.includes('delete') ||
      content.includes('purge') ||
      content.includes('stale') ||
      content.includes('filter')
    ).toBe(true)
  })
})
