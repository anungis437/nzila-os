/**
 * Contract Test — NACP-Exams App Feature Completeness
 *
 * Structural invariants for NACP-Exams buildout:
 *   1. Server action files exist with 'use server' directive
 *   2. Dashboard pages are async server components (not 'use client')
 *   3. Dashboard pages import from server actions
 *   4. Client form pages use 'use client' + useTransition
 *   5. Error/Loading boundaries exist for dashboard
 *   6. Quick actions use Link (not button)
 *   7. Evidence pipeline wired in write actions
 *   8. Sidebar layout has all 7 nav links
 *   9. Action files export correct functions
 *  10. No-console exception registered for error boundary
 *
 * @invariant NACP-01: Server actions exist with 'use server'
 * @invariant NACP-02: Dashboard pages are server components
 * @invariant NACP-03: Dashboard pages import server actions
 * @invariant NACP-04: Client form pages pattern
 * @invariant NACP-05: Error/Loading boundaries
 * @invariant NACP-06: Quick actions use Link
 * @invariant NACP-07: Evidence pipeline integration
 * @invariant NACP-08: Sidebar completeness
 * @invariant NACP-09: Action export correctness
 * @invariant NACP-10: No-console exception registered
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const NACP = join(ROOT, 'apps', 'nacp-exams')
const ACTIONS = join(NACP, 'lib', 'actions')
const DASH = join(NACP, 'app', '[locale]', 'dashboard')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── NACP-01: Server Actions Exist ───────────────────────────────────────────

describe('NACP-01 — Server action files with use server', () => {
  const actions = [
    'session-actions.ts',
    'candidate-actions.ts',
    'center-actions.ts',
    'subject-actions.ts',
    'integrity-actions.ts',
    'report-actions.ts',
  ]

  for (const file of actions) {
    it(`${file} exists`, () => {
      expect(existsSync(join(ACTIONS, file))).toBe(true)
    })

    it(`${file} has 'use server' directive`, () => {
      const src = readSafe(join(ACTIONS, file))
      expect(src).toContain("'use server'")
    })
  }
})

// ── NACP-02: Dashboard Pages are Server Components ──────────────────────────

describe('NACP-02 — Dashboard pages are server components', () => {
  const serverPages = [
    'sessions/page.tsx',
    'candidates/page.tsx',
    'centers/page.tsx',
    'subjects/page.tsx',
    'integrity/page.tsx',
    'reports/page.tsx',
  ]

  for (const page of serverPages) {
    it(`${page} does not have 'use client'`, () => {
      const src = readSafe(join(DASH, page))
      expect(src).not.toContain("'use client'")
    })

    it(`${page} has async default export`, () => {
      const src = readSafe(join(DASH, page))
      expect(src).toMatch(/export\s+default\s+async\s+function/)
    })
  }
})

// ── NACP-03: Dashboard Pages Import Server Actions ──────────────────────────

describe('NACP-03 — Dashboard pages import from server actions', () => {
  const imports: [string, string][] = [
    ['sessions/page.tsx', 'session-actions'],
    ['candidates/page.tsx', 'candidate-actions'],
    ['centers/page.tsx', 'center-actions'],
    ['subjects/page.tsx', 'subject-actions'],
    ['integrity/page.tsx', 'integrity-actions'],
    ['reports/page.tsx', 'report-actions'],
  ]

  for (const [page, action] of imports) {
    it(`${page} imports from ${action}`, () => {
      const src = readSafe(join(DASH, page))
      expect(src).toContain(action)
    })
  }
})

// ── NACP-04: Client Form Pages ──────────────────────────────────────────────

describe('NACP-04 — Client form pages use useTransition', () => {
  const clientPages = [
    'sessions/new/page.tsx',
    'candidates/new/page.tsx',
  ]

  for (const page of clientPages) {
    it(`${page} has 'use client' directive`, () => {
      const src = readSafe(join(DASH, page))
      expect(src).toContain("'use client'")
    })

    it(`${page} uses useTransition`, () => {
      const src = readSafe(join(DASH, page))
      expect(src).toContain('useTransition')
    })

    it(`${page} calls a server action`, () => {
      const src = readSafe(join(DASH, page))
      expect(src).toMatch(/import\s*{[^}]+}\s*from\s*'@\/lib\/actions\//)
    })
  }
})

// ── NACP-05: Error/Loading Boundaries ───────────────────────────────────────

describe('NACP-05 — Error/Loading boundaries', () => {
  it('loading.tsx exists in dashboard', () => {
    expect(existsSync(join(DASH, 'loading.tsx'))).toBe(true)
  })

  it('loading.tsx has animate-pulse', () => {
    const src = readSafe(join(DASH, 'loading.tsx'))
    expect(src).toContain('animate-pulse')
  })

  it('error.tsx exists in dashboard', () => {
    expect(existsSync(join(DASH, 'error.tsx'))).toBe(true)
  })

  it("error.tsx has 'use client'", () => {
    const src = readSafe(join(DASH, 'error.tsx'))
    expect(src).toContain("'use client'")
  })

  it('error.tsx has reset callback', () => {
    const src = readSafe(join(DASH, 'error.tsx'))
    expect(src).toContain('reset')
  })
})

// ── NACP-06: Quick Actions Use Link ─────────────────────────────────────────

describe('NACP-06 — Quick actions use Link, not button', () => {
  it('dashboard page imports Link from next/link', () => {
    const src = readSafe(join(DASH, 'page.tsx'))
    expect(src).toContain("from 'next/link'")
  })

  it('quick actions rendered as <Link>', () => {
    const src = readSafe(join(DASH, 'page.tsx'))
    expect(src).toContain('<Link')
    // Should NOT have button tags wrapping quick actions
    expect(src).not.toMatch(/<button[^>]*>[\s\S]*?{action\.icon}[\s\S]*?<\/button>/)
  })

  it('quick action hrefs point to real routes', () => {
    const src = readSafe(join(DASH, 'page.tsx'))
    expect(src).toContain("href: 'sessions/new'")
    expect(src).toContain("href: 'candidates/new'")
    expect(src).toContain("href: 'reports'")
    expect(src).toContain("href: 'integrity'")
  })
})

// ── NACP-07: Evidence Pipeline Integration ──────────────────────────────────

describe('NACP-07 — Evidence pipeline wired in write actions', () => {
  const actionsWithEvidence = [
    'session-actions.ts',
    'candidate-actions.ts',
    'center-actions.ts',
  ]

  for (const file of actionsWithEvidence) {
    it(`${file} imports evidence pipeline`, () => {
      const src = readSafe(join(ACTIONS, file))
      expect(src).toContain('buildExamEvidencePack')
    })
  }

  it('integrity-actions.ts imports verifySeal', () => {
    const src = readSafe(join(ACTIONS, 'integrity-actions.ts'))
    expect(src).toContain('verifySeal')
  })
})

// ── NACP-08: Sidebar Completeness ───────────────────────────────────────────

describe('NACP-08 — Sidebar layout has all 7 nav links', () => {
  const layout = readSafe(join(DASH, 'layout.tsx'))
  const expectedLinks = [
    'dashboard',
    'sessions',
    'candidates',
    'centers',
    'subjects',
    'integrity',
    'reports',
  ]

  for (const link of expectedLinks) {
    it(`sidebar contains link to ${link}`, () => {
      expect(layout).toContain(link)
    })
  }
})

// ── NACP-09: Action Export Correctness ──────────────────────────────────────

describe('NACP-09 — Action files export correct functions', () => {
  const actionExports: [string, string[]][] = [
    ['session-actions.ts', ['listSessions', 'getSessionStats', 'createSession', 'updateSessionStatus']],
    ['candidate-actions.ts', ['listCandidates', 'getCandidateStats', 'registerCandidate', 'updateCandidateStatus']],
    ['center-actions.ts', ['listCenters', 'getCenterStats', 'createCenter', 'updateCenterStatus']],
    ['subject-actions.ts', ['listSubjects', 'getSubjectStats', 'createSubject']],
    ['integrity-actions.ts', ['getIntegrityDashboard', 'verifyArtifact']],
    ['report-actions.ts', ['getReportSummary', 'getSubjectPerformance', 'getSessionReports']],
  ]

  for (const [file, exports] of actionExports) {
    for (const fn of exports) {
      it(`${file} exports ${fn}`, () => {
        const src = readSafe(join(ACTIONS, file))
        expect(src).toMatch(new RegExp(`export\\s+async\\s+function\\s+${fn}\\b`))
      })
    }
  }
})

// ── NACP-10: No-Console Exception ───────────────────────────────────────────

// The time-boxed no-console exception for the dashboard error boundary (expired
// 2026-11-17) was retired by its real fix: the boundary reports through
// @nzila/os-core/browser-diagnostics instead of console.error. The contract is now
// that no exception is needed and none is held.
describe('NACP-10 — No-console governance exception retired by the real fix', () => {
  const boundary = readSafe(join(DASH, 'error.tsx'))

  it('no-console.json holds no exception for nacp-exams', () => {
    const exceptions = JSON.parse(readSafe(join(ROOT, 'governance', 'exceptions', 'no-console.json'))) as {
      entries: { path: string }[]
    }
    expect(exceptions.entries.filter((entry) => entry.path.includes('nacp-exams'))).toEqual([])
  })

  it('the dashboard error boundary reports through browser diagnostics, not console', () => {
    expect(boundary).toContain("from '@nzila/os-core/browser-diagnostics'")
    expect(boundary).toMatch(/recordBrowserError\s*\(/)
    expect(boundary).not.toMatch(/\bconsole\s*\./)
  })
})
