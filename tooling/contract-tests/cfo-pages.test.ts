/**
 * Contract Test — CFO Dashboard Pages
 *
 * Structural invariants:
 *   1. Every sidebar nav item has a corresponding page.tsx
 *   2. Every page is a server component (no 'use client')
 *   3. Every page calls auth() for authentication
 *   4. Every page imports from server actions (not direct DB)
 *   5. Pages use the CFO design system (Lucide icons, foreground colors)
 *
 * @invariant CFO-PAGE-01: All 13 dashboard pages exist
 * @invariant CFO-PAGE-02: Auth guard on every page
 * @invariant CFO-PAGE-03: Server component discipline
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const CFO_DASHBOARD = join(ROOT, 'apps', 'cfo', 'app', '[locale]', 'dashboard')

const PAGES = [
  'clients',
  'clients/[id]',
  'ledger',
  'reports',
  'advisory-ai',
  'integrations',
  'documents',
  'tasks',
  'alerts',
  'ai-insights',
  'messages',
  'workflows',
  'settings',
  'security',
  'audit',
  'platform-admin',
  'client-portal',
  'notifications',
  'documents/upload',
  'workflows/new',
  'workflows/[id]',
]

describe('CFO-PAGE-01 — All 21 dashboard pages exist', () => {
  for (const page of PAGES) {
    it(`dashboard/${page}/page.tsx exists`, () => {
      const pagePath = join(CFO_DASHBOARD, page, 'page.tsx')
      expect(existsSync(pagePath), `Missing: apps/cfo/app/[locale]/dashboard/${page}/page.tsx`).toBe(true)
    })
  }
})

describe('CFO-PAGE-02 — Every page calls auth()', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} authenticates via auth()`, () => {
      const pagePath = join(CFO_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain('auth()')
      expect(content).toContain('@nzila/platform-auth')
    })
  }
})

describe('CFO-PAGE-03 — Pages are server components (no "use client")', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} is a server component`, () => {
      const pagePath = join(CFO_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).not.toContain("'use client'")
      expect(content).not.toContain('"use client"')
    })
  }
})

describe('CFO-PAGE — Pages import from server actions (not direct DB)', () => {
  const ACTION_IMPORT_MAP: Record<string, string[]> = {
    'clients': ['client-actions'],
    'clients/[id]': ['client-actions'],
    'ledger': ['ledger-actions'],
    'reports': ['report-actions'],
    'advisory-ai': ['advisory-actions'],
    'integrations': ['integration-actions'],
    'documents': ['misc-actions'],
    'tasks': ['misc-actions'],
    'alerts': ['misc-actions'],
    'ai-insights': ['advisory-actions'],
    'messages': ['misc-actions'],
    'workflows': ['misc-actions'],
    'settings': ['misc-actions'],
    'security': ['security-actions'],
    'audit': ['audit-actions'],
    'platform-admin': ['platform-admin-actions'],
    'client-portal': ['misc-actions', 'advisory-actions'],
    'notifications': ['notification-actions'],
    'workflows/[id]': ['workflow-actions'],
  }

  for (const [page, actionFiles] of Object.entries(ACTION_IMPORT_MAP)) {
    it(`dashboard/${page} imports from ${actionFiles.join(', ')}`, () => {
      const pagePath = join(CFO_DASHBOARD, page, 'page.tsx')
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

describe('CFO-PAGE — Pages redirect unauthenticated users', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} redirects to /sign-in`, () => {
      const pagePath = join(CFO_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toContain("redirect('/sign-in')")
    })
  }
})

describe('CFO-PAGE — Pages export default async function', () => {
  for (const page of PAGES) {
    it(`dashboard/${page} has async default export`, () => {
      const pagePath = join(CFO_DASHBOARD, page, 'page.tsx')
      if (!existsSync(pagePath)) return
      const content = readFileSync(pagePath, 'utf-8')
      expect(content).toMatch(/export\s+default\s+async\s+function/)
    })
  }
})

// ─── Phase 2 error / loading boundaries ──────────────────────────────

const PHASE2_ROUTES = [
  'security',
  'audit',
  'platform-admin',
  'client-portal',
  'notifications',
  'documents/upload',
  'workflows/new',
  'workflows/[id]',
]

describe('CFO-PAGE — Phase 2 routes have error boundaries', () => {
  for (const route of PHASE2_ROUTES) {
    it(`dashboard/${route}/error.tsx exists and is a client component`, () => {
      const errPath = join(CFO_DASHBOARD, route, 'error.tsx')
      expect(existsSync(errPath), `Missing: dashboard/${route}/error.tsx`).toBe(true)
      const content = readFileSync(errPath, 'utf-8')
      expect(content).toContain("'use client'")
      expect(content).toContain('reset')
    })
  }
})

describe('CFO-PAGE — Phase 2 routes have loading skeletons', () => {
  for (const route of PHASE2_ROUTES) {
    it(`dashboard/${route}/loading.tsx exists and shows skeleton`, () => {
      const loadPath = join(CFO_DASHBOARD, route, 'loading.tsx')
      expect(existsSync(loadPath), `Missing: dashboard/${route}/loading.tsx`).toBe(true)
      const content = readFileSync(loadPath, 'utf-8')
      expect(content).toContain('animate-pulse')
    })
  }
})

describe('CFO-PAGE — Sidebar has all Phase 2 nav items', () => {
  it('dashboard-shell.tsx contains nav items for all Phase 2 routes', () => {
    const shellPath = join(ROOT, 'apps', 'cfo', 'app', '[locale]', 'dashboard', 'dashboard-shell.tsx')
    const content = readFileSync(shellPath, 'utf-8')
    for (const route of ['security', 'audit', 'platform-admin', 'client-portal', 'notifications']) {
      expect(content, `Sidebar missing href for ${route}`).toContain(`"${route}"`)
    }
  })
})
