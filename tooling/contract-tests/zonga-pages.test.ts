/**
 * Contract Test — Zonga Dashboard Pages
 *
 * Structural invariants:
 *   1. Every sidebar nav item has a corresponding page.tsx
 *   2. Every page is a server component (no 'use client')
 *   3. Every page calls auth() for authentication
 *   4. Every page imports from server actions (not direct DB)
 *   5. Pages use Zonga design system (Card from @nzila/ui)
 *
 * @invariant ZNG-PAGE-01: All 7 dashboard sub-pages exist
 * @invariant ZNG-PAGE-02: Auth guard on every page
 * @invariant ZNG-PAGE-03: Server component discipline
 * @invariant ZNG-PAGE-04: @nzila/ui Card component usage
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA_DASHBOARD = join(ROOT, 'apps', 'zonga', 'app', '[locale]', 'dashboard')

const PAGES = [
  'catalog',
  'creators',
  'revenue',
  'payouts',
  'releases',
  'analytics',
  'integrity',
]

describe('ZNG-PAGE-01 — All 7 dashboard sub-pages exist', () => {
  for (const page of PAGES) {
    it(`dashboard/${page}/page.tsx exists`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      expect(existsSync(pagePath), `Missing: apps/zonga/app/[locale]/dashboard/${page}/page.tsx`).toBe(true)
    })
  }
})

describe('ZNG-PAGE-02 — Every page calls auth()', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} authenticates via auth()`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('auth()')
      expect(content).toContain('@nzila/platform-auth')
    })
  }
})

describe('ZNG-PAGE-03 — Pages are server components (no "use client")', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} is a server component`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).not.toContain("'use client'")
      expect(content).not.toContain('"use client"')
    })
  }
})

describe('ZNG-PAGE-04 — Pages use Card from @nzila/ui', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} imports Card component`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain("from '@nzila/ui'")
      expect(content).toContain('Card')
    })
  }
})

describe('ZNG-PAGE — Pages import from server actions (not direct DB)', () => {
  const ACTION_IMPORT_MAP: Record<string, string[]> = {
    'catalog': ['catalog-actions'],
    'creators': ['creator-actions'],
    'revenue': ['revenue-actions'],
    'payouts': ['payout-actions'],
    'releases': ['release-actions'],
    'analytics': ['release-actions'],
    'integrity': ['release-actions'],
  }

  for (const [page, actionFiles] of Object.entries(ACTION_IMPORT_MAP)) {
    it(`dashboard/${page} imports from ${actionFiles.join(', ')}`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      for (const action of actionFiles) {
        expect(content).toContain(action)
      }
      // Must NOT import directly from @nzila/db
      expect(content).not.toContain("from '@nzila/db")
    })
  }
})

describe('ZNG-PAGE — Pages redirect unauthenticated users', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} redirects to /sign-in`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain("redirect('/sign-in')")
    })
  }
})

describe('ZNG-PAGE — Pages export default async function', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} has async default export`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toMatch(/export\s+default\s+async\s+function/)
    })
  }
})

describe('ZNG-PAGE — Zonga design system compliance', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} uses text-navy for headings`, () => {
      const pagePath = join(ZONGA_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('text-navy')
    })
  }
})
