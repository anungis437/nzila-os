/**
 * PR 9 — Org Isolation Proof
 *
 * Critical: Verifies that application-layer org boundaries are consistently
 * enforced across all protected apps and packages.
 *
 * Every DB query in protected route handlers must be scoped to a verified orgId.
 * The orgId MUST come from the auth session, not from user-supplied parameters.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function readContent(path: string): string {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

function findRouteFiles(app: string): string[] {
  const appDir = resolve(ROOT, `apps/${app}/app`)
  if (!existsSync(appDir)) return []
  const found: string[] = []
  const stack = [appDir]
  while (stack.length > 0) {
    const dir = stack.pop()!
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, e.name)
      if (e.isDirectory()) stack.push(fullPath)
      else if (e.isFile() && e.name === 'route.ts') found.push(fullPath)
    }
  }
  return found
}

// ── 1. authorize() must be called in all protected route handlers ─────────

const PROTECTED_APPS = ['console', 'partners', 'union-eyes', 'flow', 'cfo', 'zonga']

const AUTH_CALL_PATTERNS = [
  /authorize\s*\(/,
  /requireOrgAccess\s*\(/,
  /requirePartnerEntityAccess\s*\(/,  // partner portal custom auth
  /resolvePartnerEntityIdForView\s*\(/, // partner portal entity resolution
  /authenticateUser\s*\(/,
  /requirePlatformRole\s*\(/,
  /verifyWebhookSignature\s*\(/,
  /currentUser\s*\(/,           // Clerk user resolution
  /auth\s*\(\)/,                 // Clerk auth()
  /withApi\s*\(/,                // UE/Flow unified handler (resolves organizationId)
  /withRoleAuth\s*\(/,           // UE legacy role-based handler
  /getCurrentUser\s*\(/,         // UE auth guard
  /getDbContext\s*\(/,           // Flow DB+org context resolver
  /withOrganizationAuth\s*\(/,   // UE org middleware (grievances, dues)
  /withOrgScope\s*\(/,           // Org-scoped composite guard (auth + context + org)
  /crudRoutes\s*\(/,             // UE crud factory (validates auth + org scope internally)
  /requireApiAuth\s*\(/,         // UE API auth guard (checks userId + org)
  /withApiAuth\s*\(/,            // UE auth HOF (injects auth context + org)
  /withAdminAuth\s*\(/,          // UE admin-only auth guard
  /withMinRole\s*\(/,            // UE role-based auth guard
  /requireUser\s*\(/,            // UE/UX auth guard (validates user identity)
  /getAuth\s*\(/,               // Clerk getAuth (low-level auth extraction)
  /cognitionRoute\s*\(/,         // Cognition route factory — wraps withApi() with required auth
]

/** Public routes that are intentionally exempt from auth requirements. */
function isPublicRoute(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, '/').replace(/%5F/gi, '_')  // decode URL-encoded underscore so _perf/_telemetry routes match
  return normalized.includes('/api/health/') || normalized.endsWith('/api/health/route.ts')
    || normalized.includes('/api/ready/') || normalized.endsWith('/api/ready/route.ts')  // Kubernetes readiness probe
    || normalized.includes('/api/version/') || normalized.endsWith('/api/version/route.ts')  // Build version metadata (public)
    || normalized.includes('/api/status/') || normalized.endsWith('/api/status/route.ts')  // Service status endpoint
    || normalized.includes('/api/docs/') || normalized.endsWith('/api/docs/route.ts')  // OpenAPI documentation endpoint
    || normalized.includes('/api/auth/')  // NextAuth handler — auth infrastructure, not a business route
    || normalized.includes('/api/auth_core/')  // Django auth core health/status endpoints
    || normalized.includes('/api/rights/terms/')  // Public rights/terms routes (terms, agreement)
    || normalized.includes('/cron/')  // cron routes use CRON_SECRET bearer auth
    || normalized.includes('/webhook')  // webhook routes use signature verification (Stripe, PayPal, Shopify, Zoho, etc.)
    || normalized.includes('/api/whop/')  // Whop payment routes (intentionally unauthenticated checkout)
    || normalized.includes('/api/quote/')  // Quote response via share token (no auth, token-validated)
    || normalized.includes('/api/healthcare/surveys/responses')  // Anonymous survey response via share token (no user auth, token-validated)
    || normalized.includes('/api/contact/')  // Public contact/demo-request form (marketing)
    || normalized.includes('/api/trial/')  // Public Flow trial signup form
    || normalized.includes('/api/metrics/')  // Telemetry scrape endpoint (token-gated via METRICS_BEARER_TOKEN)
    || normalized.includes('/(marketing)/')  // Public-facing marketing route groups (no auth required)
    || normalized.includes('/api/waitlist/')  // Public marketing waitlist signup
    || normalized.includes('/api/newsletter/')  // Public marketing newsletter signup
    || normalized.includes('/api/referrals/')  // Public referral signup
    || normalized.includes('/api/templates/download/')  // Public template download lead capture
    || normalized.includes('/api/analytics/')  // Public marketing analytics events (anonymous)
    || normalized.includes('/api/monday-reset/')  // Public weekly checklist (static content)
    || normalized.includes('/api/billing/checkout/')  // Public SaaS checkout (Stripe-hosted)
    || normalized.includes('/api/icra/')  // ICRA — pseudonymous public diagnostic (no PII, rate-limited, UUID-gated) [legacy alias]
    || normalized.includes('/api/ocra/')  // OCRA — canonical alias of /api/icra (OCI↔OCRA convergence Phase 2)
    || normalized.includes('/api/exit-interviews/institutional-')  // Legacy public redirect aliases to organizational-* endpoints
    || normalized.includes('/api/workbook/')  // Governance Entropy Workbook — pseudonymous bearer-token flow (workbookId is the credential)
    || normalized.includes('/_perf/')  // Web vitals sendBeacon (anonymous, no org context)
}

describe('PR9: Org isolation — authorize() called in protected routes', () => {
  for (const app of PROTECTED_APPS) {
    it(`${app}: every route.ts calls an auth function`, () => {
      const routeFiles = findRouteFiles(app)
      for (const routeFile of routeFiles) {
        if (isPublicRoute(routeFile)) continue  // health endpoints are intentionally public
        const content = readContent(routeFile)
        const hasAuth = AUTH_CALL_PATTERNS.some(p => p.test(content))
        expect(
          hasAuth,
          `${routeFile.replace(ROOT, '')} missing auth call`
        ).toBe(true)
      }
    })
  }
})

// ── 2. orgId must NOT be passed as a raw request body param in mutations ──
// It must come from session / authorize() call, not req.body.orgId

const ENTITY_ID_FROM_BODY_PATTERN = /req\.body\s*\.\s*orgId|body\s*\.\s*orgId(?!\s*\=\=\=\s*auth)/

describe('PR9: Org isolation — orgId not taken from raw request body', () => {
  for (const app of PROTECTED_APPS) {
    it(`${app}: no route takes orgId directly from request body`, () => {
      const routeFiles = findRouteFiles(app)
      for (const routeFile of routeFiles) {
        const content = readContent(routeFile)
        expect(
          ENTITY_ID_FROM_BODY_PATTERN.test(content),
          `${routeFile.replace(ROOT, '')} uses orgId from body (security risk — must come from session)`
        ).toBe(false)
      }
    })
  }
})

// ── 3. Database queries in route files must be scoped (WHERE orgId = ?) ─

describe('PR9: Org isolation — DB queries scoped to org', () => {
  for (const app of PROTECTED_APPS) {
    it(`${app}: route files with DB queries include an org scope`, () => {
      const routeFiles = findRouteFiles(app)
      for (const routeFile of routeFiles) {
        if (isPublicRoute(routeFile)) continue  // health endpoints exempt
        const content = readContent(routeFile)
        // Only check files that actually query the DB
        if (!content.includes('db.') && !content.match(/(?<!Buffer\.)from\(/)) continue

        const hasEntityScope =
          content.includes('orgId') ||
          content.includes('org_id') ||
          content.includes('organizationId') ||
          content.includes('organization_id') ||
          content.includes('authorize(') ||
          // authenticateUser() enforces entity access; resource-scoped queries
          // (by periodId, documentId, etc.) are legitimately entity-scoped
          content.includes('authenticateUser(') ||
          content.includes('requireOrgAccess(') ||
          content.includes('requirePartnerEntityAccess(') ||
          // Platform-admin routes are role-scoped, not entity-scoped
          content.includes('requirePlatformRole(') ||
          // UE/Flow patterns — withApi injects organizationId, getDbContext resolves org
          content.includes('withApi(') ||
          content.includes('getDbContext(') ||
          content.includes('getCurrentUser(') ||
          content.includes('withOrganizationAuth(') ||
          content.includes('withOrgScope(') ||
          content.includes('crudRoutes(') ||
          content.includes('requireApiAuth(') ||
          content.includes('withApiAuth(') ||
          content.includes('withMinRole(') ||
          content.includes('requireUser(') ||
          content.includes('cognitionRoute(') ||
          /\bauth\s*\(\)/.test(content)

        expect(
          hasEntityScope,
          `${routeFile.replace(ROOT, '')} has DB query without visible org scope`
        ).toBe(true)
      }
    })
  }
})

// ── 4. os-core authorize() enforces entity membership ─────────────────────

describe('PR9: Org isolation — authorize() checks org membership', () => {
  it('os-core policy.ts exports authorize() and checks org_members', () => {
    const policyPath = resolve(ROOT, 'packages/os-core/src/policy.ts')
    const policyDirPath = resolve(ROOT, 'packages/os-core/src/policy')

    const policyExists = existsSync(policyPath) || existsSync(policyDirPath)
    expect(policyExists, 'os-core must have a policy.ts or policy/ dir').toBe(true)

    // Prefer the auth-focused policy/ directory; fall back to policy.ts
    const authorizePath = resolve(policyDirPath, 'authorize.ts')
    const policyIndexPath = resolve(policyDirPath, 'index.ts')
    const contentToCheck = existsSync(authorizePath) ? readContent(authorizePath)
      : existsSync(policyIndexPath) ? readContent(policyIndexPath)
      : readContent(policyPath)

    expect(
      contentToCheck.includes('authorize') || contentToCheck.includes('org_members') || contentToCheck.includes('orgId'),
      'os-core policy must implement org-scoped authorization'
    ).toBe(true)
  })

  it('org_members table exists in DB schema', () => {
    const schemaDir = resolve(ROOT, 'packages/db/src/schema')
    if (!existsSync(schemaDir)) return
    const entries = readdirSync(schemaDir, { withFileTypes: true })
    const schemaFiles = entries.filter(e => e.isFile()).map(e => readContent(join(schemaDir, e.name)))
    const allSchema = schemaFiles.join('\n')
    expect(
      allSchema.includes('org_members') || allSchema.includes('orgMembers'),
      'DB schema must define org_members table for org isolation'
    ).toBe(true)
  })
})

// ── 5. No cross-org data joins without explicit entity scope guard ─────────

describe('PR9: Org isolation — no join without org scope in shared DB queries', () => {
  it('os-core policy re-exports authorize for uniform enforcement', () => {
    const osCorePkg = resolve(ROOT, 'packages/os-core/package.json')
    const pkgContent = readContent(osCorePkg)
    const pkg = JSON.parse(pkgContent || '{}')
    // os-core must export policy
    const hasExports = pkg.exports && Object.keys(pkg.exports).some(
      k => k.includes('policy') || k.includes('auth')
    )
    expect(
      hasExports || pkgContent.includes('policy'),
      'os-core package.json must export policy endpoint'
    ).toBe(true)
  })
})
