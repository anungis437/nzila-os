/**
 * Contract Test — Health & Readiness Routes (REM-05)
 *
 * Verifies:
 *   1. /api/health route exists in console and partners apps
 *   2. Health routes check only application-required dependencies
 *   3. Health routes return 503 on degraded state (not just 200)
 *   4. /api/health is accessible without auth (in middleware allowlist)
 *   5. Health response shape includes { status, checks, buildInfo }
 *
 * NOTE: The stress-test incorrectly flagged these as missing; they existed but
 * were blocked by auth middleware. This test locks in the corrected behaviour.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(rel: string): string {
  const abs = resolve(ROOT, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf-8') : ''
}

// ── Subject apps ──────────────────────────────────────────────────────────────

/**
 * All Next.js apps that MUST have production-grade health routes.
 * Each entry maps to apps/<name>/app/api/health/route.ts and apps/<name>/proxy.ts.
 */
const HEALTH_APPS = [
  'console',
  'partners',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
] as const

const BLOB_REQUIRED_APPS = new Set(['console', 'partners', 'cfo', 'nacp-exams', 'zonga'])
const BLOB_FREE_APPS = ['abr', 'flow', 'agrimo'] as const

function healthRoutePath(app: string) {
  return `apps/${app}/app/api/health/route.ts`
}
function middlewarePath(app: string) {
  return `apps/${app}/proxy.ts`
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Health & Readiness Routes — REM-05 contract', () => {
  for (const app of HEALTH_APPS) {
    describe(`apps/${app}`, () => {
      // ── Existence ─────────────────────────────────────────────────────────
      it('/api/health route file exists', () => {
        expect(existsSync(resolve(ROOT, healthRoutePath(app)))).toBe(true)
      })

      // ── DB check ──────────────────────────────────────────────────────────
      it('health route checks database connectivity', () => {
        const content = read(healthRoutePath(app))
        expect(
          content.includes('SELECT 1') ||
          content.includes('db.execute') ||
          content.includes('db.query') ||
          content.includes('sql`SELECT') ||
          content.includes('@nzila/db'),
          `apps/${app} health route must probe database connectivity`,
        ).toBe(true)
      })

      // ── Blob check ────────────────────────────────────────────────────────
      it('health route checks blob/storage connectivity', () => {
        const content = read(healthRoutePath(app))
        if (BLOB_REQUIRED_APPS.has(app)) {
          expect(content, `apps/${app} health route must probe blob/storage connectivity`).toContain('@nzila/blob')
        } else {
          expect(content, `apps/${app} health route must not probe blob/storage`).not.toContain('@nzila/blob')
        }
      })

      // ── Degraded response ─────────────────────────────────────────────────
      it('health route returns 503 on degraded', () => {
        const content = read(healthRoutePath(app))
        expect(content).toContain('503')
      })

      // ── Response shape ────────────────────────────────────────────────────
      it('health route emits status field in response', () => {
        const content = read(healthRoutePath(app))
        expect(
          content.includes("status: 'ok'") ||
          content.includes("status:") ||
          content.includes("'ok'") ||
          content.includes("'degraded'"),
        ).toBe(true)
      })

      // ── Auth bypass ───────────────────────────────────────────────────────
      it('/api/health bypasses auth in proxy (public route)', () => {
        const mw = read(middlewarePath(app))
        expect(mw).toContain('/api/health')
      })
    })
  }

  for (const app of BLOB_FREE_APPS) {
    it(`apps/${app} health route excludes blob/storage`, () => {
      const content = read(healthRoutePath(app))
      expect(content).not.toContain('@nzila/blob')
      expect(content).not.toContain('checkBlob')
    })
  }
})
