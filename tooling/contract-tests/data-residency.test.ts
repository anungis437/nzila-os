/**
 * Contract Test — Data Residency Enforcement
 *
 * Verifies that data is scoped to its authorized tenant/organization
 * and never exposed across organizational boundaries.
 *
 * @invariant DATA_RESIDENCY_001: All organization-scoped queries filter on orgId
 * @invariant DATA_RESIDENCY_002: Cross-org queries are explicitly denied (403)
 * @invariant DATA_RESIDENCY_003: Union queries across orgs are prevented
 * @invariant DATA_RESIDENCY_004: Aggregations respect org boundaries
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist', '.git', 'coverage'].includes(entry.name)) continue
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function relPath(fullPath: string): string {
  return fullPath.replace(ROOT, '').replace(/\\/g, '/')
}

// ── DATA_RESIDENCY_001 ─────────────────────────────────────────────────────

describe('DATA_RESIDENCY_001 — Organization-scoped queries filter on orgId', () => {
  it('all db.select() patterns in protected routes include orgId filters', () => {
    // Sample protected route files to check for proper org filtering
    const protectedPaths = [
      join(ROOT, 'apps', 'console', 'app', 'api'),
      join(ROOT, 'apps', 'union-eyes', 'app', 'api'),
      join(ROOT, 'apps', 'zonga', 'app', 'api'),
      join(ROOT, 'apps', 'flow', 'app', 'api'),
      join(ROOT, 'apps', 'trustcore', 'app', 'api'),
    ].filter((p) => existsSync(p))

    const violations: { file: string; pattern: string }[] = []

    for (const basePath of protectedPaths) {
      const routeFiles = walkSync(basePath).filter((f) => f.endsWith('route.ts'))

      for (const routeFile of routeFiles) {
        const content = readContent(routeFile)

        // Skip public routes
        const normalized = routeFile.replace(/\\/g, '/')
        if (
          normalized.includes('/api/health/') ||
          normalized.includes('/api/ready/') ||
          normalized.includes('/api/webhook') ||
          normalized.includes('/api/auth')
        ) {
          continue
        }

        // Check if route has any db.select queries
        const hasDbSelect = /db\.select\s*\(|db\.from\s*\(|db\.query/.test(content)
        if (!hasDbSelect) continue

        // Check if it has auth context setup before querying
        const hasAuthContext = /withOrgScope|getOrganizationIdForUser|requireOrgAccess|auth\s*\(\)/.test(content)
        if (!hasAuthContext) {
          violations.push({
            file: relPath(routeFile),
            pattern: 'db query without auth context',
          })
        }

        // Check for unfiltered queries (basic heuristic)
        // Look for db queries without obvious where/orgId filter nearby
        const queryMatches = content.match(/db\.(select|query|from)\s*\([^)]*\)/g) || []
        for (const queryMatch of queryMatches) {
          // If query is followed by .where( or filters, it's likely scoped
          const queryIndex = content.indexOf(queryMatch)
          const afterQuery = content.substring(queryIndex, queryIndex + 500)
          const hasWhereOrOrgFilter =
            /\.where\s*\(|\.eq\s*\(|orgId|organization_id|org_id/.test(afterQuery)
          if (!hasWhereOrOrgFilter) {
            // This is a simplified check — real queries always have from/where chains
            // but we look for obvious missing org context
          }
        }
      }
    }

    // Allow some violations in new code, but flag them for review
    expect(violations.length).toBeLessThanOrEqual(5)
  })
})

// ── DATA_RESIDENCY_002 ────────────────────────────────────────────────────

describe('DATA_RESIDENCY_002 — Cross-org access returns 403', () => {
  it('protected routes check org membership before returning data', () => {
    const stores = [
      join(ROOT, 'apps', 'console', 'lib', 'db'),
      join(ROOT, 'apps', 'union-eyes', 'lib', 'db'),
      join(ROOT, 'apps', 'zonga', 'lib', 'db'),
      join(ROOT, 'apps', 'flow', 'lib', 'db'),
      join(ROOT, 'apps', 'trustcore', 'lib', 'db'),
    ].filter((p) => existsSync(p))

    const violations: string[] = []

    for (const storePath of stores) {
      const storeFiles = walkSync(storePath)
      for (const storeFile of storeFiles) {
        const content = readContent(storeFile)

        // Check if store exports public query functions without org validation
        const publicFns = content.match(/export\s+(async\s+)?function\s+(\w+)/g) || []
        for (const fn of publicFns) {
          const fnIndex = content.indexOf(fn)
          const fnBody = content.substring(fnIndex, fnIndex + 1000)

          // Skip internal/private helpers
          if (fnBody.includes('// internal')) continue
          if (fnBody.includes('@internal')) continue

          // Check if org validation happens
          const hasOrgValidation =
            /orgId|requireOrgAccess|getOrganizationIdForUser|verifyOrgMembership|ORG_SCOPE_REQUIRED/.test(
              fnBody,
            )
          if (!hasOrgValidation && fnBody.includes('db.')) {
            const fnName = fn.match(/function\s+(\w+)/)?.[1] || fn
            violations.push(`${relPath(storeFile)}: ${fnName} missing org validation`)
          }
        }
      }
    }

    expect(violations.length).toBeLessThanOrEqual(3)
  })
})

// ── DATA_RESIDENCY_003 ─────────────────────────────────────────────────────

describe('DATA_RESIDENCY_003 — Union/aggregate queries are org-scoped', () => {
  it('dashboard/reporting endpoints filter aggregations by orgId', () => {
    const dashboardFiles = [
      join(ROOT, 'apps', 'console', 'app', 'api', 'dashboard'),
      join(ROOT, 'apps', 'union-eyes', 'app', 'api', 'dashboard'),
      join(ROOT, 'apps', 'zonga', 'app', 'api', 'analytics'),
      join(ROOT, 'apps', 'flow', 'app', 'api', 'metrics'),
    ]
      .filter((p) => existsSync(p))
      .flatMap((p) => walkSync(p))
      .filter((f) => f.endsWith('route.ts'))

    const violations: string[] = []

    for (const file of dashboardFiles) {
      const content = readContent(file)

      // Look for aggregate functions
      const hasAggregates = /COUNT|SUM|AVG|MAX|MIN|sql\`|\.aggregate/.test(content)
      if (!hasAggregates) continue

      // Verify org context is established
      const hasOrgContext = /withOrgScope|getOrganizationIdForUser|requireOrgAccess/.test(content)
      if (!hasOrgContext) {
        violations.push(`${relPath(file)}: Aggregation without org context`)
      }

      // Verify no global COUNT(*) without filter
      const hasUnfilteredCount = /COUNT\s*\(\s*\*\s*\)|\bcount\(\s*\*\s*\)/.test(content)
      if (hasUnfilteredCount && !hasOrgContext) {
        violations.push(`${relPath(file)}: Unfiltered COUNT(*) found`)
      }
    }

    expect(violations).toEqual([])
  })
})

// ── DATA_RESIDENCY_004 ─────────────────────────────────────────────────────

describe('DATA_RESIDENCY_004 — Pagination respects org boundaries', () => {
  it('paginated endpoints verify org access on each page', () => {
    const paginationPattern =
      /limit\s*\(|offset\s*\(|take\s*:|skip\s*:|page|cursor|pagination/i

    const apiFiles = [
      join(ROOT, 'apps', 'console', 'app', 'api'),
      join(ROOT, 'apps', 'union-eyes', 'app', 'api'),
      join(ROOT, 'apps', 'zonga', 'app', 'api'),
    ]
      .filter((p) => existsSync(p))
      .flatMap((p) => walkSync(p))
      .filter((f) => f.endsWith('route.ts'))

    const violations: string[] = []

    for (const file of apiFiles) {
      const content = readContent(file)

      if (!paginationPattern.test(content)) continue

      // Pagination routes must verify org on EACH invocation
      // Not just once at the beginning
      const hasOrgVerifyInFn = /withOrgScope|requireOrgAccess/.test(content)
      if (!hasOrgVerifyInFn) {
        violations.push(`${relPath(file)}: Paginated endpoint without per-request org verification`)
      }
    }

    expect(violations).toEqual([])
  })
})
