/**
 * CROSS_ORG_AUTH_001 — "Cross-org / cross-tenant routes require admin auth"
 *
 * Any API route whose path contains `cross-org` or `cross-tenant` exposes
 * data spanning multiple organisations. These routes MUST:
 *   1. Use the `withApi()` framework (not bare function exports)
 *   2. Require authentication (`auth: { required: true }`)
 *   3. Gate to admin role (`minRole: 'admin'`)
 *
 * A bare `djangoProxy()` call without `withApi()` is a bypass vector
 * because the Django layer's `requireAuth` default only ensures Clerk
 * auth, not role-based admin gating on the TS side.
 *
 * @invariant CROSS_ORG_AUTH_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  walkSync,
  readContent,
  relPath,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

/** Glob-style path segments that indicate cross-org data exposure */
const CROSS_ORG_SEGMENTS = ['cross-org', 'cross-tenant']

const APPS_DIR = join(ROOT, 'apps')

// ── Helpers ─────────────────────────────────────────────────────────────────

function isCrossOrgRoute(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return (
    normalized.endsWith('/route.ts') &&
    CROSS_ORG_SEGMENTS.some((seg) => normalized.includes(`/${seg}/`))
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CROSS_ORG_AUTH_001 — Cross-org routes require admin auth', () => {
  const allRouteFiles = walkSync(APPS_DIR).filter(isCrossOrgRoute)

  it('discovers cross-org route files to scan', () => {
    expect(
      allRouteFiles.length,
      'Expected to find at least one cross-org/cross-tenant route file',
    ).toBeGreaterThan(0)
  })

  it('every cross-org route uses withApi()', () => {
    const violations: Violation[] = []

    for (const file of allRouteFiles) {
      const content = readContent(file)
      if (!content.includes('withApi')) {
        violations.push({
          ruleId: 'CROSS_ORG_AUTH_001',
          filePath: relPath(file),
          offendingValue: 'Route does not use withApi() framework',
          remediation:
            'Wrap all exports in withApi({ auth: { required: true, minRole: "admin" } })',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('every cross-org route requires authentication', () => {
    const violations: Violation[] = []

    for (const file of allRouteFiles) {
      const content = readContent(file)
      if (content.includes('required: false')) {
        violations.push({
          ruleId: 'CROSS_ORG_AUTH_001',
          filePath: relPath(file),
          offendingValue: 'auth: { required: false } — cross-org route must require auth',
          remediation:
            'Set auth: { required: true, minRole: "admin" } for cross-org routes',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('every cross-org route requires admin role', () => {
    const violations: Violation[] = []

    for (const file of allRouteFiles) {
      const content = readContent(file)
      // Must have minRole set to admin (or owner/superadmin which are above admin)
      if (!content.includes("minRole: 'admin'") && !content.includes("minRole: 'owner'") && !content.includes("minRole: 'superadmin'")) {
        violations.push({
          ruleId: 'CROSS_ORG_AUTH_001',
          filePath: relPath(file),
          offendingValue: 'Missing minRole: "admin" — cross-org data requires admin gating',
          remediation:
            'Add minRole: "admin" (or higher) to the auth config in withApi()',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})
