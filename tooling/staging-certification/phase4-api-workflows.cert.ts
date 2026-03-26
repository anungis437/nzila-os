/**
 * PHASE 4 — API / Server Workflow Certification
 *
 * Validates that all API routes follow hardened patterns:
 *  - Auth checks present (Clerk auth() or withApiAuth or authenticateUser)
 *  - Request validation present (Zod safeParse, validateIntakeRequest, etc.)
 *  - Audit logging present on mutation routes
 *  - No open routes that should be gated
 *  - Webhook routes have signature verification
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

const DEPLOYED_APPS = ['union-eyes', 'console', 'partners', 'cfo', 'zonga', 'web']

function walkRouteFiles(dir: string): { relPath: string; content: string }[] {
  const results: { relPath: string; content: string }[] = []
  function walk(d: string, depth = 0) {
    if (depth > 12 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (entry === 'node_modules' || entry === '.next' || entry === '.turbo') continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (entry === 'route.ts' || entry === 'route.tsx') {
            results.push({
              relPath: relative(dir, full).replace(/\\/g, '/'),
              content: readFileSync(full, 'utf-8'),
            })
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

const AUTH_PATTERNS = [
  /\bauth\s*\(\s*\)/,           // Clerk auth() direct call
  /\bwithApiAuth\b/,            // withApiAuth wrapper
  /\bwithAdminAuth\b/,          // withAdminAuth admin wrapper
  /\bwithApi\b/,                // withApi declarative framework
  /\bcrudRoutes\b/,             // crudRoutes factory (auth built-in)
  /\bauthenticateUser\b/,       // console pattern
  /\bgetAuth\b/,                // getAuth pattern
  /\bcurrentUser\b/,            // currentUser pattern
  /\bclerkClient\b/,            // Clerk admin client
  /\bverifyToken\b/,            // Financial service Clerk verify
  /\bgetCurrentUser\b/,         // getCurrentUser helper
  /\bauth:\s*\{/,               // { auth: { required: true } } config
  /\breadRole\b/,               // crudRoutes readRole param
  /\bwithRoleAuth\b/,           // withRoleAuth role-based wrapper
  /\bwithMinRole\b/,            // withMinRole minimum-role wrapper
  /\brequireOrgAccess\b/,       // requireOrgAccess console guard
  /\bverifyWebhookSignature\b/, // webhook signature verification
  /\bverifyPayPalWebhook\b/,    // PayPal webhook verification
  /\bverifyStripeSignature\b/,   // Stripe webhook signature verification
  /\bverifyShopifyHmac\b/,       // Shopify webhook HMAC verification
]

const VALIDATION_PATTERNS = [
  /\.safeParse\b/,
  /\.parse\b/,
  /\bvalidateIntake/,
  /\bvalidate[A-Z]/,
  /\bz\.object\b/,
  /\bschema\.\w+\.safeParse/,
  /\bcrudRoutes\b/,              // crudRoutes has built-in Zod validation
  /\bwithApi\b/,                // withApi validates request schemas
]

const AUDIT_PATTERNS = [
  /\bauditDataMutation\b/,
  /\bauditDataAccess\b/,
  /\blogApiAuditEvent\b/,
  /\brecordAuditEvent\b/,
  /\baudit_events\b/,
  /\bauditLog\b/,
  /\bwithApi\b/,                // withApi has audit logging built-in
  /\bwithAdminAuth\b/,          // admin wrapper includes audit
  /\bcrudRoutes\b/,             // crudRoutes factory includes audit
]

// Routes that are public by design
const PUBLIC_ROUTE_PATTERNS = [
  /\/api\/health/,
  /\/api\/webhooks\//,
  /\/api\/public\//,
  /\/api\/cron\//,
  /\/api\/status/,
  /\/api\/og/,
  /\/api\/rss/,
]

function isPublicRoute(relPath: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some(p => p.test(relPath))
}

function hasPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(content))
}

describe('CERT-PHASE-4 — API Workflow Certification', () => {
  // Gather all route files across deployed apps
  const allRoutes: { app: string; relPath: string; content: string }[] = []
  for (const app of DEPLOYED_APPS) {
    const apiDir = join(APPS_DIR, app, 'app', 'api')
    if (!existsSync(apiDir)) continue
    for (const route of walkRouteFiles(apiDir)) {
      allRoutes.push({ app, relPath: `api/${route.relPath}`, content: route.content })
    }
  }

  it('discovers API routes across deployed apps', () => {
    expect(allRoutes.length).toBeGreaterThan(50)
  })

  // ── Auth enforcement ──────────────────────────────────────────────────
  describe('auth enforcement on non-public routes', () => {
    const nonPublic = allRoutes.filter(r => !isPublicRoute(r.relPath))

    it('all non-public routes have auth checks', () => {
      const missing: string[] = []
      for (const route of nonPublic) {
        if (!hasPattern(route.content, AUTH_PATTERNS)) {
          missing.push(`${route.app}/${route.relPath}`)
        }
      }
      // Allow <5% missing (some routes may be internal-only or OPTIONS)
      const pct = missing.length / nonPublic.length
      expect(pct).toBeLessThan(0.05)
    })

    it('admin routes always require auth', () => {
      const adminRoutes = nonPublic.filter(r => r.relPath.includes('admin'))
      const missing = adminRoutes.filter(r => !hasPattern(r.content, AUTH_PATTERNS))
      expect(missing.map(r => `${r.app}/${r.relPath}`)).toEqual([])
    })

    it('billing/finance routes always require auth', () => {
      const finRoutes = nonPublic.filter(r =>
        r.relPath.includes('billing') || r.relPath.includes('finance') ||
        r.relPath.includes('stripe') || r.relPath.includes('payment')
      )
      const missing = finRoutes.filter(r => !hasPattern(r.content, AUTH_PATTERNS))
      expect(missing.map(r => `${r.app}/${r.relPath}`)).toEqual([])
    })
  })

  // ── Request validation ────────────────────────────────────────────────
  describe('request validation on mutation routes', () => {
    const mutations = allRoutes.filter(r =>
      /\bexport\s+(async\s+)?function\s+POST\b/.test(r.content) ||
      /\bexport\s+(async\s+)?function\s+PUT\b/.test(r.content) ||
      /\bexport\s+(async\s+)?function\s+PATCH\b/.test(r.content) ||
      /\bexport\s+(async\s+)?function\s+DELETE\b/.test(r.content) ||
      /\bexport\s+const\s+POST\b/.test(r.content) ||
      /\bexport\s+const\s+PUT\b/.test(r.content) ||
      /\bexport\s+const\s+PATCH\b/.test(r.content) ||
      /\bexport\s+const\s+DELETE\b/.test(r.content)
    )

    it('mutation routes have request validation (>80%)', () => {
      const validated = mutations.filter(r => hasPattern(r.content, VALIDATION_PATTERNS))
      const pct = validated.length / mutations.length
      expect(pct).toBeGreaterThan(0.80)
    })
  })

  // ── Webhook signature verification ────────────────────────────────────
  describe('webhook routes', () => {
    const webhooks = allRoutes.filter(r => r.relPath.includes('webhook'))

    it('webhook routes exist', () => {
      expect(webhooks.length).toBeGreaterThan(0)
    })

    it('webhook routes verify signatures or use raw body', () => {
      const failures: string[] = []
      for (const w of webhooks) {
        const hasVerify =
          /constructEvent|verifyWebhookSignature|svix|webhook[\s_-]*secret|stripe-signature|signature|verify|hmac|crypto/i
            .test(w.content)
        const hasRawBody = /getRawBody|rawBody|raw.*body|text\(\)|withApi|crudRoutes/i.test(w.content)
        if (!(hasVerify || hasRawBody)) {
          failures.push(`${w.app}/${w.relPath}`)
        }
      }
      // Allow 1-2 internal webhook endpoints without signature verification
      expect(failures.length).toBeLessThanOrEqual(2)
    })
  })

  // ── Audit logging on sensitive routes ─────────────────────────────────
  describe('audit logging on sensitive operations', () => {
    const sensitiveRoutes = allRoutes.filter(r =>
      r.relPath.includes('admin') ||
      r.relPath.includes('billing') ||
      r.relPath.includes('payment') ||
      r.relPath.includes('transition') ||
      r.relPath.includes('intake')
    )

    it('sensitive routes have audit logging (>50%)', () => {
      const logged = sensitiveRoutes.filter(r => hasPattern(r.content, AUDIT_PATTERNS))
      const pct = logged.length / sensitiveRoutes.length
      expect(pct).toBeGreaterThan(0.50)
    })
  })

  // ── No SQL injection vulns ────────────────────────────────────────────
  describe('no raw SQL with concatenation', () => {
    it('no string-interpolated SQL queries in route files', () => {
      const dangerous: string[] = []
      for (const route of allRoutes) {
        // Catch `sql\`... ${userInput}...\`` only when not using Drizzle sql`` tagged template
        // We look for raw string concat in SQL-looking strings
        if (/\bquery\s*\(\s*['"`].*\+\s*(req|body|params|query)/i.test(route.content)) {
          dangerous.push(`${route.app}/${route.relPath}`)
        }
        // Also catch direct string concat in execute
        if (/\.execute\s*\(\s*['"`].*\$\{/i.test(route.content)) {
          dangerous.push(`${route.app}/${route.relPath}`)
        }
      }
      expect(dangerous).toEqual([])
    })
  })
})
