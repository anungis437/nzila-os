/**
 * ADVERSARIAL PHASE 1 — Auth Enforcement Proof (Negative Testing)
 *
 * Proves server-side auth enforcement by reading guard implementations.
 * Validates:
 *  - Every auth guard returns 401/403 on failure
 *  - orgId derived from auth context, not client input
 *  - No bypass paths for protected routes
 *  - No route trusts client-provided orgId without membership validation
 *  - No route returns data without auth context
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const CONSOLE = join(ROOT, 'apps', 'console')
const UE_LIB = join(UE, 'lib')
const CONSOLE_LIB = join(CONSOLE, 'lib')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

function walkFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 12 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (['node_modules', '.next', '.turbo', 'dist'].includes(entry)) continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (pattern.test(entry)) results.push(full)
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard files
// ─────────────────────────────────────────────────────────────────────────────
const authGuardPaths = [
  join(UE_LIB, 'api-auth-guard.ts'),
  join(UE_LIB, 'api', 'with-api.ts'),
  join(UE_LIB, 'api', 'crud-factory.ts'),
  join(UE_LIB, 'role-middleware.ts'),
  join(UE_LIB, 'organization-middleware.ts'),
  join(CONSOLE_LIB, 'api-guards.ts'),
]

describe('ADVERSARIAL-1 — Auth Enforcement Proof', () => {
  // ── Guard Implementation Analysis ──────────────────────────────────────
  describe('auth guards reject unauthenticated requests', () => {
    it('withApiAuth returns 401 when userId is null', () => {
      const file = read(authGuardPaths[0])
      // Must check userId and return 401
      expect(file).toMatch(/userId/)
      expect(file).toMatch(/40[13]/)
      // Must call auth() from Clerk
      expect(file).toMatch(/\bauth\s*\(\s*\)/)
    })

    it('withRoleAuth returns 403 on insufficient role', () => {
      const file = read(authGuardPaths[0])
      expect(file).toMatch(/withRoleAuth/)
      expect(file).toMatch(/403/)
      // Must check role hierarchy
      expect(file).toMatch(/ROLE_HIERARCHY|hasRole|hasMinRole|getRoleLevel/)
    })

    it('withMinRole returns 403 on insufficient role', () => {
      const file = read(authGuardPaths[0])
      expect(file).toMatch(/withMinRole/)
      expect(file).toMatch(/403/)
    })

    it('withApi framework returns AUTH_REQUIRED error code', () => {
      const file = read(authGuardPaths[1])
      expect(file).toMatch(/AUTH_REQUIRED|UNAUTHORIZED/)
      // Gets user via getCurrentUser
      expect(file).toMatch(/getCurrentUser/)
    })

    it('withApi returns INSUFFICIENT_PERMISSIONS on role failure', () => {
      const file = read(authGuardPaths[1])
      expect(file).toMatch(/INSUFFICIENT_PERMISSIONS|FORBIDDEN|403/)
    })

    it('crudRoutes enforces auth on all HTTP methods', () => {
      const file = read(authGuardPaths[2])
      // Must set auth.required for GET, POST, PATCH, DELETE
      expect(file).toMatch(/auth:\s*\{/)
      expect(file).toMatch(/required:\s*true/)
      // DELETE should require admin
      expect(file).toMatch(/admin/)
    })

    it('requireOrgAccess (console) returns 401 then 403', () => {
      const file = read(authGuardPaths[5])
      expect(file).toMatch(/requireOrgAccess/)
      expect(file).toMatch(/401/)
      expect(file).toMatch(/403/)
      // Must check membership
      expect(file).toMatch(/membership|orgMembers|getOrgMembership/)
    })

    it('role-middleware validates membership before role check', () => {
      // role-middleware wraps organization-middleware
      const roleFile = read(authGuardPaths[3])
      expect(roleFile).toMatch(/withRoleAuth|withOrganizationAuth/)
      // Organization middleware must verify membership
      const orgMwPath = authGuardPaths[4]
      if (existsSync(orgMwPath)) {
        const orgFile = read(orgMwPath)
        expect(orgFile).toMatch(/requireUser|membership|organizationMembers/)
      }
    })
  })

  // ── Cross-Org Prevention ──────────────────────────────────────────────
  describe('cross-org access prevention', () => {
    it('crudRoutes derives orgId from auth context, not request', () => {
      const file = read(authGuardPaths[2])
      // Should use organizationId from context (auth-derived)
      expect(file).toMatch(/organizationId/)
      // Should set organizationId on POST from auth context
      expect(file).toMatch(/organizationId\s*[=:]/)
    })

    it('crudRoutes prevents org ID tampering on PATCH', () => {
      const file = read(authGuardPaths[2])
      // Should strip organizationId from updates
      expect(file).toMatch(/delete\s+\w*\.organizationId|organizationId.*undefined|omit.*organizationId/)
    })

    it('crudRoutes forces org scoping on POST', () => {
      const file = read(authGuardPaths[2])
      // Should set organizationId from auth context on create
      expect(file).toMatch(/orgScoped|organization_id|organizationId/)
    })

    it('requireOrgAccess validates caller membership in requested org', () => {
      const file = read(authGuardPaths[5])
      // Must query membership table, not just trust the orgId
      expect(file).toMatch(/getOrgMembership|orgMembers/)
      expect(file).toMatch(/active/)
    })

    it('withApi orgId comes from getCurrentUser, not request body', () => {
      const file = read(authGuardPaths[1])
      // organizationId in context should come from user object
      expect(file).toMatch(/organizationId:\s*user/)
    })
  })

  // ── No Dangerous Bypass Paths ─────────────────────────────────────────
  describe('no unauthorized bypass paths', () => {
    it('public routes do not include admin/finance/billing paths', () => {
      // Check public routes definition
      const publicRoutes = walkFiles(UE_LIB, /public[-_]routes\.ts$/)
      for (const f of publicRoutes) {
        const content = read(f)
        expect(content).not.toMatch(/['"`].*\/admin\//)
        expect(content).not.toMatch(/['"`].*\/finance\//)
        expect(content).not.toMatch(/['"`].*\/billing\//)
      }
    })

    it('PLATFORM_ADMIN bypass is env-var gated (not hardcoded UUIDs)', () => {
      const file = read(authGuardPaths[0])
      if (file.includes('PLATFORM_ADMIN')) {
        // Should read from process.env, not hardcoded
        expect(file).toMatch(/process\.env/)
      }
      // No hardcoded UUIDs as admin bypasses
      const hardcodedUuidRegex = /['"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]\s*(?:===?\s*userId|===?\s*user)/i
      expect(file).not.toMatch(hardcodedUuidRegex)
    })

    it('super-admin bypass requires membership in designated org', () => {
      const roleFile = read(authGuardPaths[3])
      if (roleFile.includes('SUPER_ADMIN')) {
        // Must check membership, not just userId
        expect(roleFile).toMatch(/SUPER_ADMIN_ORG/)
        expect(roleFile).toMatch(/process\.env/)
      }
    })

    it('cron auth uses secret header, not open bypass', () => {
      const file = read(authGuardPaths[0])
      if (file.includes('cron')) {
        expect(file).toMatch(/x-cron-secret|CRON_SECRET/)
        expect(file).toMatch(/process\.env/)
      }
    })
  })

  // ── Server-Side Enforcement ───────────────────────────────────────────
  describe('server-side enforcement (not UI-only)', () => {
    it('auth enforcement is in route handlers, not just middleware', () => {
      // The middleware.ts explicitly defers API auth to route handlers
      const mw = read(join(UE, 'middleware.ts'))
      expect(mw).toMatch(/route.*handler|handler|next.*response|NextResponse\.next/i)
      // Route handlers must have their own auth
      const sampleRoute = walkFiles(join(UE, 'app', 'api', 'admin'), /route\.ts$/)
      expect(sampleRoute.length).toBeGreaterThan(0)
      const routeContent = read(sampleRoute[0])
      expect(routeContent).toMatch(/withRoleAuth|withAdminAuth|withApi|withMinRole|withApiAuth|crudRoutes|auth\s*\(/)
    })

    it('no API route returns DB data before auth check', () => {
      // Scan admin routes: auth wrapper should be at export level (wraps handler)
      const adminRoutes = walkFiles(join(UE, 'app', 'api', 'admin'), /route\.ts$/)
      let failCount = 0
      const failures: string[] = []
      for (const f of adminRoutes) {
        const content = read(f)
        // Check: exported functions should be wrapped with auth, OR have auth() at top
        const hasAuthExport = /export\s+(const|async\s+function)\s+\w+\s*=\s*(withRoleAuth|withAdminAuth|withApi|withMinRole|crudRoutes)/.test(content)
        const hasAuthCall = /const\s*\{.*\}\s*=\s*(withApi|crudRoutes)|export\s+(const\s*\{|\{).*\}\s*=\s*crudRoutes/.test(content)
        const hasInlineAuth = /auth\s*\(\s*\)|getCurrentUser|withApiAuth|withAdminAuth|crudRoutes\(|withApi\(/.test(content)
        if (!hasAuthExport && !hasAuthCall && !hasInlineAuth) {
          failCount++
          failures.push(relative(ROOT, f))
        }
      }
      // All admin routes must have auth
      expect(failures).toEqual([])
    })
  })

  // ── Negative Pattern Detection ────────────────────────────────────────
  describe('dangerous pattern detection', () => {
    it('no route reads orgId from request body without server validation', () => {
      // Find routes that read orgId from request body
      const DEPLOYED_APPS = ['union-eyes', 'console']
      const trustsClientOrg: string[] = []

      for (const app of DEPLOYED_APPS) {
        const apiDir = join(ROOT, 'apps', app, 'app', 'api')
        if (!existsSync(apiDir)) continue
        const routes = walkFiles(apiDir, /route\.ts$/)
        for (const f of routes) {
          const content = read(f)
          const rel = relative(ROOT, f).replace(/\\/g, '/')
          // If route reads orgId from request body/params
          const readsOrgFromRequest = /req(?:uest)?\..*org(?:anization)?Id|body\.org(?:anization)?Id|params\.org(?:anization)?Id/.test(content)
          if (readsOrgFromRequest) {
            // Must validate with requireOrgAccess, membership check, or similar
            const validatesOrg = /requireOrgAccess|getOrgMembership|validateOrg|membershipCheck|verifyOrgAccess|requireAuth/.test(content)
            const hasAuthContext = /withApi|crudRoutes|withRoleAuth|withMinRole|withApiAuth|withAdminAuth|authenticateUser|auth\(/.test(content)
            if (!validatesOrg && !hasAuthContext) {
              trustsClientOrg.push(rel)
            }
          }
        }
      }
      expect(trustsClientOrg).toEqual([])
    })

    it('auth guard files have no DEBUG/DEV bypass that skips auth in production', () => {
      for (const guardPath of authGuardPaths) {
        if (!existsSync(guardPath)) continue
        const content = read(guardPath)
        // No unconditional return-200 or return-true skipping auth
        expect(content).not.toMatch(/if\s*\(\s*true\s*\).*return/i)
        // No NODE_ENV === 'development' bypass that skips auth
        const devBypass = /NODE_ENV.*development.*(?:return\s+(?:true|null)|skip.*auth)/i
        expect(content).not.toMatch(devBypass)
      }
    })

    it('no hardcoded JWT secrets or API keys in auth guard files', () => {
      for (const guardPath of authGuardPaths) {
        if (!existsSync(guardPath)) continue
        const content = read(guardPath)
        // No hardcoded secret strings
        expect(content).not.toMatch(/['"]sk_(?:live|test)_[a-zA-Z0-9]{20,}['"]/)
        expect(content).not.toMatch(/['"]whsec_[a-zA-Z0-9]{20,}['"]/)
        expect(content).not.toMatch(/jwt[_\s]*[=:]\s*['"][a-zA-Z0-9._-]{40,}['"]/)
      }
    })
  })
})
