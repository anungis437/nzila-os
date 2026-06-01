import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(TEST_DIR, '..')

const FORBIDDEN_TERMS = [
  { label: 'Grand River', pattern: /Grand River/i },
  { label: '7 West', pattern: /\b7 West\b/i },
  { label: 'CUPE Local 123', pattern: /CUPE Local 123/i },
  { label: 'Brandon', pattern: /\bBrandon\b/i },
  { label: 'Union365', pattern: /Union365/i },
] as const

function collectMatchingFiles(relativeDir: string, match: RegExp): string[] {
  const absoluteDir = path.join(APP_ROOT, relativeDir)
  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && match.test(entry.name))
    .map((entry) => path.posix.join(relativeDir, entry.name))
}

const CUPE4373_HYGIENE_FILES = [
  ...collectMatchingFiles('components/demo', /cupe4373/i),
  ...collectMatchingFiles('lib/demo', /cupe4373/i),
  'components/auth/cupe4373-persona-picker.tsx',
  'scripts/seed-cupe4373-demo.ts',
  'scripts/seed-cupe4373-members.ts',
  'app/api/admin/seed-cupe-pilot/route.ts',
  'app/components/admin/LoadCUPEPilotForm.tsx',
  'app/[locale]/dashboard/layout.tsx',
].sort()

describe('CUPE4373 demo hygiene', () => {
  it('keeps contaminated demo terms out of curated CUPE4373 surfaces', () => {
    const violations: string[] = []

    for (const relativeFile of CUPE4373_HYGIENE_FILES) {
      const absoluteFile = path.join(APP_ROOT, relativeFile)
      expect(fs.existsSync(absoluteFile), `${relativeFile} should exist`).toBe(true)

      const content = fs.readFileSync(absoluteFile, 'utf8')
      for (const term of FORBIDDEN_TERMS) {
        if (term.pattern.test(content)) {
          violations.push(`${relativeFile}: ${term.label}`)
        }
      }
    }

    expect(
      violations,
      `Remove contaminated demo terms from CUPE4373 surfaces: ${violations.join(', ')}`,
    ).toEqual([])
  })

  it('keeps public marketing homepage from forcing immediate dashboard redirect', () => {
    const homepage = fs.readFileSync(path.join(APP_ROOT, 'app/[locale]/page.tsx'), 'utf8')
    // Homepage may redirect *authenticated* users into the dashboard, but it
    // must not redirect anonymous visitors. We assert the redirect is gated
    // behind a session/role lookup rather than being a top-level redirect call.
    const hasUnconditionalRedirectToDashboard = /^\s*redirect\(["'`]\/(?:[a-z-]+\/)?dashboard/m.test(homepage)
    expect(hasUnconditionalRedirectToDashboard, 'Public homepage must not unconditionally redirect to /dashboard').toBe(false)
  })

  it('keeps dashboard routes guarded by an auth/role check', () => {
    const layout = fs.readFileSync(path.join(APP_ROOT, 'app/[locale]/dashboard/layout.tsx'), 'utf8')
    const guarded = /requireDashboardAccess|requireUser|hasMinRole|getServerSession|auth\(\)|currentUser\(\)|getUserRole/.test(layout)
    expect(guarded, 'Dashboard layout must enforce an auth/role guard').toBe(true)
  })

  it('keeps CUPE4373 dashboard routes implemented (page files exist)', () => {
    const required = [
      'app/[locale]/dashboard/page.tsx',
      'app/[locale]/dashboard/inbox/page.tsx',
      'app/[locale]/dashboard/priorities/page.tsx',
      'app/[locale]/dashboard/cases/page.tsx',
      'app/[locale]/dashboard/grievances/page.tsx',
      'app/[locale]/dashboard/documents/page.tsx',
      'app/[locale]/dashboard/members/page.tsx',
      'app/[locale]/dashboard/communications/page.tsx',
      'app/[locale]/dashboard/governance/page.tsx',
      'app/[locale]/dashboard/reports/page.tsx',
      'app/[locale]/dashboard/agreements/page.tsx',
      'app/[locale]/dashboard/calendar/page.tsx',
      'app/[locale]/dashboard/work/page.tsx',
    ]
    const missing = required.filter((rel) => !fs.existsSync(path.join(APP_ROOT, rel)))
    expect(missing, `Missing demo route files: ${missing.join(', ')}`).toEqual([])
  })
})