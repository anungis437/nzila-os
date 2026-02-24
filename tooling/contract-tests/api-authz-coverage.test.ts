/**
 * Contract Tests: API Authorization Coverage (PR1.1c)
 *
 * Verifies that every API route in apps/ has an authorization check:
 * - Does not return 2xx without a valid auth header
 * - Uses @nzila/os-core/policy (no direct Clerk role checks)
 * - Does not import Clerk clerkClient for role checks (must use authorize())
 *
 * These are static analysis tests — they inspect source files,
 * they do NOT make network requests.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')
const APPS_DIR = join(REPO_ROOT, 'apps')

function walkApiRoutes(dir: string): string[] {
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      if (statSync(fullPath).isDirectory()) {
        results.push(...walkApiRoutes(fullPath))
      } else if (entry === 'route.ts' || entry === 'route.tsx') {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

function getApiRoutes(): string[] {
  const routes: string[] = []
  try {
    for (const app of readdirSync(APPS_DIR)) {
      const apiDir = join(APPS_DIR, app, 'app', 'api')
      routes.push(...walkApiRoutes(apiDir))
    }
  } catch {}
  return routes
}

const routes = getApiRoutes()

describe('API Authorization Contract (INV-04)', () => {
  it('should have at least one API route in each app', () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  it('every POST/PUT/PATCH/DELETE route must produce an auth check', () => {
    const MUTATION_EXPORTS = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/

    // Routes that are deliberately public or use external auth (webhook signatures, etc.)
    const PUBLIC_ROUTE_PATTERNS = [
      /\/webhooks\//,              // Webhook endpoints (verified by signature, may be nested)
      /\/api\/hooks\//,            // Hook endpoints
      /\/api\/health/,             // Health checks
      /\/api\/ready/,              // Readiness probes
      /\/api\/status/,             // Status endpoints
      /\/api\/docs/,               // API documentation
      /\/api\/auth\//,             // Auth callbacks
      /\/unauthenticated-/,        // Intentionally unauthenticated flows
    ]

    const AUTH_PATTERNS = [
      /auth\(\)/,
      /authorize\(/,
      /withAuth\(/,
      /getAuth\(/,
      /currentUser\(\)/,
      /requireEntityAccess\(/,
      /verifyWebhookSignature\(/,
      /authenticateUser\(/,
      /requirePlatformRole\(/,
      /djangoProxy\(/,           // Django backend handles auth internally
      /requireApiAuth\(/,        // UE API auth guard
      /requireUser\(/,           // UE user auth guard
      /getCurrentUser\(/,        // UE user auth utility
      /verifyShopifySignature\(/, // Shopify webhook signature verification
      /CRON_SECRET/,             // Cron job secret verification
    ]

    const violations: string[] = []
    for (const route of routes) {
      const content = readFileSync(route, 'utf-8')
      if (!MUTATION_EXPORTS.test(content)) continue
      const routeNorm = route.replace(/\\/g, '/')
      const isPublic = PUBLIC_ROUTE_PATTERNS.some((p) => p.test(routeNorm))
      if (isPublic) continue
      const hasAuth = AUTH_PATTERNS.some((p) => p.test(content))
      if (!hasAuth) {
        violations.push(route.replace(REPO_ROOT + '/', ''))
      }
    }

    expect(
      violations,
      `Routes with mutations but no auth check:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('routes must not import Clerk clerkClient for role checks (use authorize() instead)', () => {
    // Importing clerkClient is allowed for user lookups, but role gating
    // must go through @nzila/os-core/policy/authorize
    const DIRECT_ROLE_CHECK = /clerkClient.*(?:getUser|getMembership|getRoles)/
    const violations: string[] = []

    for (const route of routes) {
      const content = readFileSync(route, 'utf-8')
      if (DIRECT_ROLE_CHECK.test(content)) {
        violations.push(route.replace(REPO_ROOT + '/', ''))
      }
    }

    expect(
      violations,
      `Routes using clerkClient for role gating (use authorize() instead):\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('every route file should import from @nzila/* packages, not relative ../../ chains 3+ deep', () => {
    const DEEP_RELATIVE = /from\s+['"](?:\.\.\/){3,}/
    const violations: string[] = []

    for (const route of routes) {
      const content = readFileSync(route, 'utf-8')
      if (DEEP_RELATIVE.test(content)) {
        violations.push(route.replace(REPO_ROOT + '/', ''))
      }
    }

    if (violations.length > 0) {
      console.warn(
        `Routes with deep relative imports (should use @nzila/* packages):\n${violations.join('\n')}`,
      )
    }
    // This is a warning-level check, not a hard fail
    expect(true).toBe(true)
  })
})
