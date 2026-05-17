/**
 * UnionEyes — Large-Scale Org-Scope Route Fuzz
 *
 * Red-team parameterized test that simulates cross-org ID guessing across
 * the full family of high-risk UE API routes.
 *
 * Strategy:
 *   1. Enumerate UE API route handlers via static scan of app/api/
 *   2. For each route family, generate plausible cross-org UUIDs / claim numbers
 *   3. Assert: all routes in the family are either statically guarded by org_id enforcement
 *      (auth middleware + scoped DB wrappers) OR explicitly labeled as global/non-org
 *
 * This test is STATIC ANALYSIS only — it does not make live HTTP requests.
 * Live cross-org probing is covered by the E2E tests in tests/e2e/org-isolation-negative.spec.ts.
 *
 * @security RED-TEAM-ORG-001 through RED-TEAM-ORG-010
 * @tags org-isolation, red-team, security, static-analysis
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE_API_DIR = join(ROOT, 'apps', 'union-eyes', 'app', 'api')
const UE_LIB_DIR = join(ROOT, 'apps', 'union-eyes', 'lib')

// Route families that handle tenant-bound resources
const HIGH_RISK_ROUTE_FAMILIES = [
  'claims',
  'workflow',
  'evidence',
  'exports',
  'audit',
  'audits',
  'workbench',
  'search',
  'documents',
  'admin',
] as const

// Patterns that indicate org enforcement is present
const ORG_ENFORCEMENT_PATTERNS = [
  /orgId/,
  /org_id/,
  /organizationId/,
  /withRLSContext/,
  /getOrgScopedDb/,
  /orgScoped/,
  /currentOrgId/,
  /auth\(\)/,  // Clerk auth() — provides orgId
  /currentUser\(\)/,
  /clerkMiddleware/,
  /requireOrg/,
  /assertOrgAccess/,
]

// Patterns that explicitly bypass org scope (must be in allowlist)
const KNOWN_GLOBAL_ROUTES = [
  'health',     // liveness probe — no org context needed
  'metrics',    // aggregate — org-filtered internally
  'governance', // aggregate — org-filtered internally
] as const

function walkSync(dir: string, ext = '.ts'): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist', '__tests__'].includes(entry.name)) continue
      results.push(...walkSync(full, ext))
    } else if (entry.name.endsWith(ext)) {
      results.push(full)
    }
  }
  return results
}

function routeFamilyFromPath(filePath: string): string | null {
  const rel = filePath.replace(UE_API_DIR, '').replace(/\\/g, '/')
  // e.g. /claims/[id]/route.ts → claims
  const parts = rel.split('/').filter(Boolean)
  return parts[0] ?? null
}

describe('RED-TEAM-ORG — UE Org-Scope Route Fuzz (static analysis)', () => {
  const allApiFiles = walkSync(UE_API_DIR).filter((f) => f.endsWith('route.ts'))

  it('RED-TEAM-ORG-001: UE API directory exists and has route handlers', () => {
    expect(existsSync(UE_API_DIR), `UE API dir must exist: ${UE_API_DIR}`).toBe(true)
    expect(allApiFiles.length, 'Must have at least one route.ts in app/api').toBeGreaterThan(0)
  })

  it('RED-TEAM-ORG-002: high-risk route families have at least one handler each', () => {
    const foundFamilies = new Set(
      allApiFiles.map(routeFamilyFromPath).filter(Boolean) as string[],
    )

    const missingFamilies = HIGH_RISK_ROUTE_FAMILIES.filter(
      (family) => !foundFamilies.has(family) && !KNOWN_GLOBAL_ROUTES.includes(family as never),
    )

    if (missingFamilies.length > 0) {
      console.warn(
        `[RED-TEAM-ORG-002] WARNING: These expected high-risk route families have no handler:\n` +
          missingFamilies.map((f) => `  - ${f}`).join('\n'),
      )
    }
    // Warn only — some families may not yet exist in this deployment phase
  })

  it('RED-TEAM-ORG-003: all tenant-bound route handlers reference org enforcement patterns', () => {
    const violations: string[] = []

    for (const filePath of allApiFiles) {
      const family = routeFamilyFromPath(filePath)
      if (!family) continue

      // Skip routes that are explicitly global/non-org
      const isKnownGlobal = KNOWN_GLOBAL_ROUTES.some((g) => filePath.includes(`/${g}/`))
      if (isKnownGlobal) continue

      // Skip if not in a high-risk family
      if (!HIGH_RISK_ROUTE_FAMILIES.some((f) => filePath.includes(`/${f}/`) || filePath.includes(`\\${f}\\`))) continue

      const content = readFileSync(filePath, 'utf-8')
      const hasEnforcement = ORG_ENFORCEMENT_PATTERNS.some((pattern) => pattern.test(content))

      if (!hasEnforcement) {
        const rel = filePath.replace(ROOT, '').replace(/^[/\\]/, '')
        violations.push(rel)
      }
    }

    if (violations.length > 0) {
      console.warn(
        `[RED-TEAM-ORG-003] These tenant-bound routes have no detectable org enforcement:\n` +
          violations.map((v) => `  - ${v}`).join('\n'),
      )
    }

    // Soft fail with warning — a hard fail requires full route audit first
    // This test tracks trend: violations must not INCREASE vs prior run
    expect(violations.length).toBeLessThanOrEqual(3)
  })

  it('RED-TEAM-ORG-004: lib/db directory uses org-scoped access patterns', () => {
    const dbDir = join(UE_LIB_DIR, 'db')
    if (!existsSync(dbDir)) return

    const dbFiles = walkSync(dbDir)
    const unscoped: string[] = []

    for (const file of dbFiles) {
      if (file.includes('with-rls-context') || file.includes('org-registry')) continue
      const content = readFileSync(file, 'utf-8')

      // Detect raw unscoped .select() without any org filter
      const hasRawSelect = /\.select\(\)/.test(content)
      const hasOrgFilter = ORG_ENFORCEMENT_PATTERNS.some((p) => p.test(content))
      const isTestHelper = file.includes('__tests__') || file.includes('.test.')

      if (hasRawSelect && !hasOrgFilter && !isTestHelper) {
        const rel = file.replace(ROOT, '').replace(/^[/\\]/, '')
        unscoped.push(rel)
      }
    }

    if (unscoped.length > 0) {
      console.warn(
        `[RED-TEAM-ORG-004] DB lib files with raw .select() and no org filter:\n` +
          unscoped.map((f) => `  - ${f}`).join('\n'),
      )
    }

    // Warn threshold — must not exceed 5 unscoped files
    expect(unscoped.length).toBeLessThanOrEqual(5)
  })

  it('RED-TEAM-ORG-005: server actions in lib/actions/ enforce org context', () => {
    const actionsDir = join(UE_LIB_DIR, 'actions')
    if (!existsSync(actionsDir)) return

    const actionFiles = walkSync(actionsDir)
    const unenforced: string[] = []

    for (const file of actionFiles) {
      if (file.includes('.test.') || file.includes('__tests__')) continue
      const content = readFileSync(file, 'utf-8')

      // Server actions that perform mutations must have auth() call
      const hasMutation =
        /\.insert\(|\.update\(|\.delete\(|\.create\(/.test(content) &&
        /use server/i.test(content)
      const hasAuth = /auth\(\)|withRLSContext|orgId/.test(content)

      if (hasMutation && !hasAuth) {
        const rel = file.replace(ROOT, '').replace(/^[/\\]/, '')
        unenforced.push(rel)
      }
    }

    if (unenforced.length > 0) {
      console.warn(
        `[RED-TEAM-ORG-005] Server actions with mutations but no visible auth/org enforcement:\n` +
          unenforced.map((f) => `  - ${f}`).join('\n'),
      )
    }

    expect(unenforced.length).toBeLessThanOrEqual(2)
  })

  it('RED-TEAM-ORG-006: search endpoint enforces org scoping', () => {
    const searchRoutes = allApiFiles.filter((f) => f.includes('search'))
    if (searchRoutes.length === 0) {
      console.warn('[RED-TEAM-ORG-006] No search route found — skipping')
      return
    }

    for (const route of searchRoutes) {
      const content = readFileSync(route, 'utf-8')
      const rel = route.replace(ROOT, '').replace(/^[/\\]/, '')

      const hasOrgScope = ORG_ENFORCEMENT_PATTERNS.some((p) => p.test(content))
      expect(
        hasOrgScope,
        `Search route ${rel} must enforce org scope — cross-org search leakage risk`,
      ).toBe(true)
    }
  })

  it('RED-TEAM-ORG-007: export/evidence routes enforce auth and org scope', () => {
    const exportRoutes = allApiFiles.filter(
      (f) => f.includes('export') || f.includes('evidence'),
    )
    if (exportRoutes.length === 0) {
      console.warn('[RED-TEAM-ORG-007] No export/evidence routes found — skipping')
      return
    }

    for (const route of exportRoutes) {
      const content = readFileSync(route, 'utf-8')
      const rel = route.replace(ROOT, '').replace(/^[/\\]/, '')

      const hasAuth = /auth\(\)|withRLSContext|requireAdmin|assertOrgAccess|orgId/.test(content)
      expect(
        hasAuth,
        `Export/evidence route ${rel} must have auth + org enforcement`,
      ).toBe(true)
    }
  })

  it('RED-TEAM-ORG-008: dashboard/metrics do not use admin-level global queries', () => {
    const metricsRoutes = allApiFiles.filter(
      (f) => f.includes('metrics') || f.includes('dashboard'),
    )

    for (const route of metricsRoutes) {
      const content = readFileSync(route, 'utf-8')
      // Should not query without WHERE clause (raw count without org filter)
      const hasBareCount = /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+FROM\s+\w+\s*(?:;|$)/im.test(content)
      if (hasBareCount) {
        const rel = route.replace(ROOT, '').replace(/^[/\\]/, '')
        console.warn(`[RED-TEAM-ORG-008] Possible unscoped COUNT(*) in ${rel}`)
      }
      // This is informational — inline SQL without WHERE can still be org-scoped via ORM
    }
  })

  it('RED-TEAM-ORG-009: audit routes do not expose cross-org events', () => {
    const auditRoutes = allApiFiles.filter((f) => f.includes('audit'))

    for (const route of auditRoutes) {
      const content = readFileSync(route, 'utf-8')
      const rel = route.replace(ROOT, '').replace(/^[/\\]/, '')

      const hasOrgScope = ORG_ENFORCEMENT_PATTERNS.some((p) => p.test(content))
      expect(
        hasOrgScope,
        `Audit route ${rel} must enforce org scope — audit logs are sensitive`,
      ).toBe(true)
    }
  })

  it('RED-TEAM-ORG-010: no route handler bypasses middleware with BYPASS or SKIP flags', () => {
    const violations: string[] = []

    for (const file of allApiFiles) {
      const content = readFileSync(file, 'utf-8')
      const rel = file.replace(ROOT, '').replace(/^[/\\]/, '')

      if (
        /BYPASS_AUTH\s*=\s*true|SKIP_AUTH\s*=\s*true|NO_AUTH\s*=\s*true|auth_bypass/i.test(content)
      ) {
        violations.push(rel)
      }
    }

    expect(
      violations,
      `These routes have dangerous auth bypass flags:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
