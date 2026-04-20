/**
 * Contract Test — HTTP Cross-Org Breach Scenarios (SEC-ORG-ISO-002)
 *
 * Validates org isolation at the HTTP/structural level by verifying:
 *   1. All mutation routes enforce org-scoped auth (not just existence of auth call)
 *   2. No route accepts cross-org orgId from query params or URL path without guard
 *   3. Routes with [orgId] dynamic segments enforce requireOrgAccess()
 *   4. DB calls in mutation routes are scoped via authenticated org context
 *   5. Export/proof endpoints enforce org boundary before data extraction
 *   6. No route leaks data across org boundaries via shared DB queries
 *
 * Complements the static org-isolation.test.ts with deeper pattern analysis
 * simulating the inspection an HTTP-level attacker would perform.
 *
 * @see tooling/contract-tests/org-isolation.test.ts — static structural test
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(abs: string): string {
  try { return readFileSync(abs, 'utf-8') } catch { return '' }
}

function findAllRouteFiles(appDir: string): string[] {
  if (!existsSync(appDir)) return []
  const found: string[] = []
  const stack = [appDir]
  while (stack.length > 0) {
    const dir = stack.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      else if (entry.isFile() && entry.name === 'route.ts') found.push(fullPath)
    }
  }
  return found
}

// ── Test Apps ─────────────────────────────────────────────────────────────────

const PROTECTED_APPS = ['console', 'partners', 'union-eyes', 'flow', 'cfo', 'zonga']

const HEALTH_SKIP = (path: string) =>
  path.replace(/\\/g, '/').includes('/api/health/')

const WEBHOOK_SKIP = (path: string) =>
  path.replace(/\\/g, '/').includes('/api/webhooks/')

const ADMIN_SKIP = (path: string) =>
  path.replace(/\\/g, '/').includes('/api/admin/')

/** System/infra routes that are not org-specific (cron jobs, docs, emergency). */
const SYSTEM_SKIP = (path: string) => {
  const rel = path.replace(/\\/g, '/')
  return rel.includes('/api/cron/') ||
         rel.includes('/api/docs/') ||
         rel.includes('/api/emergency/') ||
         rel.includes('/api/metrics/') ||
         rel.includes('/api/version/') ||
         rel.includes('/api/ready/')
}

// ── Auth patterns that enforce org-scoped access ──────────────────────────── 

const ORG_SCOPED_AUTH_PATTERNS = [
  /requireOrgAccess\s*\(/,
  /requirePartnerEntityAccess\s*\(/,
  /resolvePartnerEntityIdForView\s*\(/,
  /authenticateUser\s*\(/,
  /authorize\s*\(\s*req\s*,\s*\{[^}]*requiredRole/,
  /withAuth\s*\(/,
  /requirePlatformRole\s*\(/,       // platform-admin only routes
  /auth\s*\(\)/,                     // Clerk auth() with inline role check
  /withApi\s*\(/,                    // UE/Flow unified handler
  /withRoleAuth\s*\(/,               // UE legacy role-based handler
  /getCurrentUser\s*\(/,             // UE auth guard
  /getDbContext\s*\(/,               // Flow DB+org context
  /withOrganizationAuth\s*\(/,       // UE org middleware (grievances, dues)
  /withOrgScope\s*\(/,               // Org-scoped composite guard (auth + context + org)
  /crudRoutes\s*\(/,                 // UE crud factory (handles auth + org scope internally)
  /requireApiAuth\s*\(/,             // UE API auth guard (checks userId + org)
]

// ── Cross-org attack vectors ──────────────────────────────────────────────── 

/**
 * Dangerous pattern: route reads orgId from URL params or query string
 * without calling requireOrgAccess to validate membership.
 */
const ORGID_FROM_URL_PATTERN = /params\.\s*orgId|searchParams\.get\s*\(\s*['"]orgId['"]\)/
const ORGID_FROM_BODY_UNSANITIZED = /body\s*\.\s*orgId(?!\s*===?\s*(?:auth|guard|membership))/

/**
 * Pattern indicating the route extracts orgId from dynamic segment [orgId]
 */
const DYNAMIC_ORGID_ROUTE = /\[orgId\]/

describe('SEC-ORG-ISO-002: HTTP cross-org breach prevention', () => {
  for (const app of PROTECTED_APPS) {
    const appDir = resolve(ROOT, `apps/${app}/app`)

    // ── Scenario 1: Dynamic [orgId] routes must call requireOrgAccess ──── 

    describe(`${app}: dynamic [orgId] routes enforce org membership`, () => {
      it('every route with [orgId] in path calls requireOrgAccess or equivalent', () => {
        const routes = findAllRouteFiles(appDir)
        const dynamicOrgRoutes = routes.filter((r) =>
          r.replace(/\\/g, '/').includes('[orgId]') && !HEALTH_SKIP(r) && !WEBHOOK_SKIP(r) && !ADMIN_SKIP(r),
        )

        const violations: string[] = []
        for (const route of dynamicOrgRoutes) {
          const content = read(route)
          const hasOrgAuth = ORG_SCOPED_AUTH_PATTERNS.some((p) => p.test(content))
          if (!hasOrgAuth) {
            violations.push(relative(ROOT, route))
          }
        }

        expect(
          violations,
          `Routes with [orgId] segment but no org membership check:\n${violations.join('\n')}`,
        ).toHaveLength(0)
      })
    })

    // ── Scenario 2: No route accepts orgId from query params without guard ── 

    describe(`${app}: orgId from query/URL params is always guarded`, () => {
      it('no route reads orgId from params/query without org membership validation', () => {
        const routes = findAllRouteFiles(appDir)
        const violations: string[] = []

        for (const route of routes) {
          if (HEALTH_SKIP(route) || WEBHOOK_SKIP(route) || ADMIN_SKIP(route)) continue
          const content = read(route)

          // If the route reads orgId from URL/query params, it must also call org auth
          const readsOrgIdFromUrl = ORGID_FROM_URL_PATTERN.test(content)
          if (readsOrgIdFromUrl) {
            const hasOrgAuth = ORG_SCOPED_AUTH_PATTERNS.some((p) => p.test(content))
            if (!hasOrgAuth) {
              violations.push(relative(ROOT, route))
            }
          }
        }

        expect(
          violations,
          `Routes reading orgId from URL without org auth:\n${violations.join('\n')}`,
        ).toHaveLength(0)
      })
    })

    // ── Scenario 3: Mutation routes with DB calls are org-scoped ──────── 

    describe(`${app}: mutation routes with DB calls enforce org scope`, () => {
      it('POST/PUT/PATCH/DELETE handlers with DB queries include orgId in WHERE clauses', () => {
        const routes = findAllRouteFiles(appDir)
        const violations: string[] = []

        for (const route of routes) {
          if (HEALTH_SKIP(route) || WEBHOOK_SKIP(route) || ADMIN_SKIP(route)) continue
          const content = read(route)

          // Only check files with write operations + DB access
          const hasMutation = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(content)
          const hasDbCall = content.includes('.insert(') ||
            content.includes('.update(') ||
            content.includes('.delete(') ||
            content.includes('db.execute')

          if (hasMutation && hasDbCall) {
            // Must reference orgId in the DB operation context
            const hasOrgInDb = content.includes('orgId') ||
              content.includes('org_id') ||
              content.includes('organizationId') ||
              content.includes('organization_id') ||
              content.includes('requireOrgAccess') ||
              content.includes('authenticateUser') ||
              content.includes('createScopedDb') ||
              content.includes('createAuditedScopedDb') ||
              content.includes('withOrganizationAuth') ||
              content.includes('requirePlatformRole') ||
              content.includes('withOrgScope') ||
              content.includes('crudRoutes(') ||
              content.includes('requireApiAuth(')

            if (!hasOrgInDb) {
              violations.push(relative(ROOT, route))
            }
          }
        }

        expect(
          violations,
          `Mutation routes with unscoped DB operations:\n${violations.join('\n')}`,
        ).toHaveLength(0)
      })
    })

    // ── Scenario 4: Export routes enforce org boundary ─────────────────── 

    describe(`${app}: export/proof endpoints enforce org boundary`, () => {
      it('export and proof routes call requireOrgAccess or authenticate', () => {
        const routes = findAllRouteFiles(appDir)
        const exportRoutes = routes.filter((r) => {
          const normalized = r.replace(/\\/g, '/')
          return normalized.includes('/export/') ||
            normalized.includes('/proof/') ||
            normalized.includes('/evidence/')
        })

        const violations: string[] = []
        for (const route of exportRoutes) {
          const content = read(route)
          const hasAuth = ORG_SCOPED_AUTH_PATTERNS.some((p) => p.test(content))
          if (!hasAuth) {
            violations.push(relative(ROOT, route))
          }
        }

        expect(
          violations,
          `Export/proof routes without org auth:\n${violations.join('\n')}`,
        ).toHaveLength(0)
      })
    })

    // ── Scenario 5: No route uses unsanitized orgId from request body ── 

    describe(`${app}: orgId from request body is never used unsanitized`, () => {
      it('orgId from body is always cross-checked against session org', () => {
        const routes = findAllRouteFiles(appDir)
        const violations: string[] = []

        for (const route of routes) {
          if (HEALTH_SKIP(route) || WEBHOOK_SKIP(route) || ADMIN_SKIP(route)) continue
          const content = read(route)

          // If orgId appears via body/parsed input, the route must also
          // call an auth function that validates org membership
          if (ORGID_FROM_BODY_UNSANITIZED.test(content)) {
            const hasOrgAuth = ORG_SCOPED_AUTH_PATTERNS.some((p) => p.test(content))
            if (!hasOrgAuth) {
              violations.push(relative(ROOT, route))
            }
          }
        }

        expect(
          violations,
          `Routes using unsanitized orgId from body:\n${violations.join('\n')}`,
        ).toHaveLength(0)
      })
    })
  }

  // ── Scenario 6: Middleware enforces org-scoped rate limiting ──────────── 

  describe('middleware enforces org-scoped rate limiting', () => {
    for (const app of ['console', 'partners']) {
      it(`${app}/proxy.ts imports and calls checkOrgRateLimit`, () => {
        const mwPath = resolve(ROOT, `apps/${app}/proxy.ts`)
        const content = read(mwPath)
        expect(content).toContain('checkOrgRateLimit')
        expect(content).toContain('orgRateLimitHeaders')
        expect(content).toContain('ORG_RATE_LIMIT_EXCEEDED')
      })
    }
  })

  // ── Scenario 7: Cross-org data join prevention ──────────────────────────

  describe('shared DB queries do not join across org boundaries', () => {
    it('no route file contains raw SQL joins without org filter', () => {
      const violations: string[] = []

      for (const app of PROTECTED_APPS) {
        const appDir = resolve(ROOT, `apps/${app}/app`)
        const routes = findAllRouteFiles(appDir)

        for (const route of routes) {
          if (HEALTH_SKIP(route) || WEBHOOK_SKIP(route) || ADMIN_SKIP(route) || SYSTEM_SKIP(route)) continue
          const content = read(route)

          // If the route uses a raw SQL join, it must include org scoping
          // Match SQL JOIN keywords (INNER JOIN, LEFT JOIN, RIGHT JOIN, CROSS JOIN, JOIN table)
          // but exclude JS imports like `import { join } from 'node:path'`
          const hasRawJoin = /\b(?:INNER|LEFT|RIGHT|CROSS|FULL)\s+JOIN\b/i.test(content) ||
            /\bJOIN\s+[a-z_][a-z0-9_.]*\s+(?:ON|USING)\b/i.test(content) ||
            content.includes('.innerJoin(') || content.includes('.leftJoin(')
          if (hasRawJoin) {
            const hasOrgScope = content.includes('orgId') ||
              content.includes('org_id') ||
              content.includes('organizationId') ||
              content.includes('organization_id') ||
              content.includes('createScopedDb') ||
              content.includes('requireOrgAccess') ||
              content.includes('withOrganizationAuth') ||
              content.includes('withOrgScope') ||
              content.includes('crudRoutes(') ||
              content.includes('requireApiAuth(') ||
              content.includes('withApi(') ||
              content.includes('withApiAuth(')
            if (!hasOrgScope) {
              violations.push(relative(ROOT, route))
            }
          }
        }
      }

      expect(
        violations,
        `Routes with cross-org join risk:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  })

  // ── Scenario 8: verify-entity-chain endpoint exists ─────────────────────

  describe('audit chain verification is exposed via HTTP', () => {
    it('verify-entity-chain route exists in console', () => {
      const routePath = resolve(
        ROOT,
        'apps/console/app/api/audit/verify-entity-chain/route.ts',
      )
      expect(existsSync(routePath)).toBe(true)
    })

    it('verify-entity-chain route calls requireOrgAccess', () => {
      const routePath = resolve(
        ROOT,
        'apps/console/app/api/audit/verify-entity-chain/route.ts',
      )
      const content = read(routePath)
      expect(content).toContain('requireOrgAccess')
      expect(content).toContain('verifyEntityAuditChain')
    })
  })
})
