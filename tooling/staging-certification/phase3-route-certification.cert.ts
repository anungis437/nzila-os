/**
 * PHASE 3 — Browser-Level Route and Page Certification
 *
 * Verifies that every deployed app's critical routes exist in the
 * file system and are properly structured (page.tsx, route.ts, layout.tsx).
 *
 * For routes that need browser validation (Playwright), validates
 * the test coverage exists and that smoke tests are defined.
 *
 * Tests:
 *  1. Dashboard page exists in union-eyes
 *  2. Cases/grievances pages exist
 *  3. Finance/billing pages exist
 *  4. Admin/console surfaces exist
 *  5. Onboarding/setup screens exist  
 *  6. Document/export screens exist
 *  7. Auth redirect pages exist (sign-in, sign-up)
 *  8. Health/API endpoints exist
 *  9. Playwright smoke tests exist for critical flows
 * 10. No page.tsx + route.ts conflicts in any segment
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')
const UE = join(APPS_DIR, 'union-eyes')
const UE_APP = join(UE, 'app')

function routeExists(appDir: string, ...segments: string[][]): boolean {
  return segments.some(path => {
    const full = join(appDir, 'app', ...path)
    return existsSync(full)
  })
}

function findRouteFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 8 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (entry === 'node_modules' || entry === '.next') continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (pattern.test(entry)) results.push(full.slice(dir.length).replace(/\\/g, '/'))
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

describe('CERT-PHASE-3 — Browser-Level Route Certification', () => {
  // ── Union-Eyes Critical Routes ────────────────────────────────────────
  describe('union-eyes critical pages', () => {
    const ueRoutes = findRouteFiles(UE_APP, /^(page|route|layout)\.(tsx?|jsx?)$/)

    it('has dashboard page', () => {
      expect(ueRoutes.some(r => r.includes('dashboard'))).toBe(true)
    })

    it('has cases/grievances pages', () => {
      const hasClaims = ueRoutes.some(r => r.includes('claims') || r.includes('grievance') || r.includes('cases'))
      expect(hasClaims).toBe(true)
    })

    it('has finance/billing pages', () => {
      const hasFinance = ueRoutes.some(r =>
        r.includes('finance') || r.includes('billing') || r.includes('dues')
      )
      expect(hasFinance).toBe(true)
    })

    it('has admin pages', () => {
      const hasAdmin = ueRoutes.some(r => r.includes('admin') || r.includes('settings'))
      expect(hasAdmin).toBe(true)
    })

    it('has member/org management pages', () => {
      const hasMembers = ueRoutes.some(r => r.includes('member') || r.includes('org'))
      expect(hasMembers).toBe(true)
    })

    it('has document pages', () => {
      const hasDocs = ueRoutes.some(r => r.includes('document') || r.includes('export'))
      expect(hasDocs).toBe(true)
    })

    it('has sign-in and sign-up pages or catch-all auth', () => {
      const hasAuth = ueRoutes.some(r =>
        r.includes('sign-in') || r.includes('sign-up') || r.includes('login')
      )
      expect(hasAuth).toBe(true)
    })

    it('has health/status API endpoint', () => {
      const hasHealth = ueRoutes.some(r => r.includes('health'))
      expect(hasHealth).toBe(true)
    })

    it('has sufficient total route coverage (>30 pages/apis)', () => {
      const pageAndApi = ueRoutes.filter(r => /\/(page|route)\.(tsx?|jsx?)$/.test(r))
      expect(pageAndApi.length).toBeGreaterThan(30)
    })
  })

  // ── Console Critical Routes ───────────────────────────────────────────
  describe('console critical pages', () => {
    const consoleApp = join(APPS_DIR, 'console', 'app')
    const consoleRoutes = findRouteFiles(consoleApp, /^(page|route|layout)\.(tsx?|jsx?)$/)

    it('has org management pages', () => {
      const hasOrgs = consoleRoutes.some(r => r.includes('org'))
      expect(hasOrgs).toBe(true)
    })

    it('has dashboard or home page', () => {
      const hasHome = consoleRoutes.some(r =>
        r === '/page.tsx' || r.includes('dashboard')
      )
      expect(hasHome).toBe(true)
    })
  })

  // ── No page+route conflicts ───────────────────────────────────────────
  describe('route conflict detection (all apps)', () => {
    it('no deployed app has page.tsx + route.ts conflict in same segment', () => {
      const conflicts: string[] = []

      for (const app of ['web', 'console', 'partners', 'union-eyes', 'cfo', 'zonga']) {
        const appDir = join(APPS_DIR, app, 'app')
        if (!existsSync(appDir)) continue

        const routes = findRouteFiles(appDir, /^(page|route)\.(tsx?|jsx?)$/)
        const bySegment = new Map<string, Set<string>>()

        for (const r of routes) {
          const seg = r.replace(/\/[^/]+$/, '') || '/'
          const type = r.includes('page.') ? 'page' : 'api'
          const set = bySegment.get(seg) ?? new Set()
          set.add(type)
          bySegment.set(seg, set)
        }

        for (const [seg, types] of bySegment) {
          if (types.has('page') && types.has('api')) {
            conflicts.push(`${app}:${seg}`)
          }
        }
      }

      expect(conflicts).toEqual([])
    })
  })

  // ── Playwright E2E test coverage ──────────────────────────────────────
  describe('E2E test coverage exists', () => {
    it('union-eyes has Playwright config', () => {
      expect(existsSync(join(UE, 'playwright.config.ts'))).toBe(true)
    })

    it('smoke tests exist and cover public pages', () => {
      const smokePath = join(UE, 'e2e', 'smoke.spec.ts')
      expect(existsSync(smokePath)).toBe(true)
      const content = readFileSync(smokePath, 'utf-8')
      expect(content).toContain('marketing page')
      expect(content).toContain('API health')
    })

    it('dashboard e2e tests exist', () => {
      const dashPath = join(UE, 'e2e', 'dashboard.spec.ts')
      expect(existsSync(dashPath)).toBe(true)
      const content = readFileSync(dashPath, 'utf-8')
      expect(content).toContain('dashboard')
    })

    it('CAPE feature e2e tests exist', () => {
      const capePath = join(UE, 'e2e', 'cape-features.spec.ts')
      expect(existsSync(capePath)).toBe(true)
      const content = readFileSync(capePath, 'utf-8')
      expect(content).toContain('Grievance')
    })
  })
})
