/**
 * Contract Test — Vertical Scaffolding Invariants
 *
 * Ensures that:
 *   1. The CLI package exists with create-vertical command
 *   2. All existing apps have authorize() in their API routes
 *   3. No vertical missing governance posture files
 *
 * @invariant INV-10: Vertical scaffolding enforces governance posture
 * @invariant INV-11: Every API route calls authorize()
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist'].includes(entry.name)) continue
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function getApiRoutes(appDir: string): string[] {
  const apiDir = join(appDir, 'app', 'api')
  if (!existsSync(apiDir)) return []
  return walkSync(apiDir).filter((f) => f.endsWith('route.ts') || f.endsWith('route.tsx'))
}

function getAppDirs(): string[] {
  if (!existsSync(APPS_DIR)) return []
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(APPS_DIR, d.name))
}

// ── INV-10: CLI package structure ───────────────────────────────────────────

describe('INV-10 — Vertical scaffolding CLI exists', () => {
  it('packages/cli/package.json exists with nzila binary', () => {
    const pkgPath = join(ROOT, 'packages', 'cli', 'package.json')
    expect(existsSync(pkgPath), 'packages/cli/package.json must exist').toBe(true)

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.bin?.nzila).toBeTruthy()
  })

  it('create-vertical command module exists', () => {
    const cmdPath = join(ROOT, 'packages', 'cli', 'src', 'commands', 'create-vertical.ts')
    expect(existsSync(cmdPath), 'create-vertical.ts must exist').toBe(true)

    const content = readFileSync(cmdPath, 'utf-8')
    expect(content).toContain('createVertical')
    expect(content).toContain('scopedDb')
    expect(content).toContain('withAudit')
    expect(content).toContain('authorize')
  })

  it('scaffolded vertical template includes middleware.ts', () => {
    const cmdPath = join(ROOT, 'packages', 'cli', 'src', 'commands', 'create-vertical.ts')
    const content = readFileSync(cmdPath, 'utf-8')
    expect(content).toContain('middleware.ts')
    expect(content).toContain('clerkMiddleware')
  })

  it('scaffolded vertical template includes no-shadow-db ESLint', () => {
    const cmdPath = join(ROOT, 'packages', 'cli', 'src', 'commands', 'create-vertical.ts')
    const content = readFileSync(cmdPath, 'utf-8')
    expect(content).toContain('noShadowDb')
    expect(content).toContain('eslint-no-shadow-db')
  })

  it('scaffolded vertical template includes health endpoint', () => {
    const cmdPath = join(ROOT, 'packages', 'cli', 'src', 'commands', 'create-vertical.ts')
    const content = readFileSync(cmdPath, 'utf-8')
    expect(content).toContain('health')
    expect(content).toContain("status: 'ok'")
  })

  it('scaffolded vertical template includes contract test stub', () => {
    const cmdPath = join(ROOT, 'packages', 'cli', 'src', 'commands', 'create-vertical.ts')
    const content = readFileSync(cmdPath, 'utf-8')
    expect(content).toContain('contract.test.ts')
    expect(content).toContain('governance compliance')
  })
})

// ── INV-11: Every API route calls authorize() ───────────────────────────────

describe('INV-11 — Every API route has authorization', () => {
  const appDirs = getAppDirs()

  // Known auth patterns that count as authorization
  const AUTH_PATTERNS = [
    'authorize(',
    'withAuth(',
    'requireEntityAccess(',
    'requirePlatformRole(',
    'authenticateUser(',
    'requireAuth(',
    'constructEvent(',          // Stripe webhook signature verification
    'verifyHmac(',              // QBO webhook verification
    'verifyWebhookSignature(',  // @nzila/payments-stripe webhook verification
    'await auth(',              // Clerk auth() direct call (e.g., OAuth callbacks)
    'await auth()',             // Clerk auth() direct call (no args)
    'stripe.webhooks',          // Stripe webhook verification pattern
    'djangoProxy(',             // Django proxy — calls auth() internally
    'proxyGet(',                // Django proxy shorthand — wraps djangoProxy()
    'proxyPost(',               // Django proxy shorthand — wraps djangoProxy()
    'proxyPatch(',              // Django proxy shorthand — wraps djangoProxy()
    'proxyPut(',                // Django proxy shorthand — wraps djangoProxy()
    'proxyDelete(',             // Django proxy shorthand — wraps djangoProxy()
    'buildListProxy(',          // Django proxy builder — wraps djangoProxy()
    'buildDetailProxy(',        // Django proxy builder — wraps djangoProxy()
    'proxyResource(',           // Django proxy builder — wraps djangoProxy()
    'withApi(',                 // withApi() framework — enforces auth by default
    'withApiAuth(',             // withApiAuth() wrapper — enforces auth
    'getCurrentUser(',          // getCurrentUser() — Clerk auth check
    'timingSafeEqual(',         // Cron secret verification via timing-safe compare
    'CRON_SECRET',              // Cron route secret verification
    'verifyShopifySignature(',  // Shopify webhook signature verification
    'withRoleAuth(',             // Role-based auth guard wrapper
    'withAdminAuth(',            // Admin-only auth guard wrapper
    'requireApiAuth(',           // API auth requirement check
    'requireUser(',              // Requires authenticated user
    'getAuth(',                  // Clerk getAuth() direct call
  ]

  // Routes that are explicitly public
  const PUBLIC_ROUTE_PATTERNS = [
    '/api/health',
    '/api/webhooks',
    '/api/public',
    '/api/ready',               // Readiness/liveness probes
    '/api/docs',                // OpenAPI documentation
    '/api/status',              // Status page (public)
    '/api/gdpr/cookie-consent', // Cookie consent must be public
    '/api/whop/unauthenticated-checkout', // Whop public checkout flow
    '/api/payments/webhooks/paypal',       // PayPal webhook (has its own signature verification)
  ]

  for (const appDir of appDirs) {
    const appName = relative(APPS_DIR, appDir)
    const routes = getApiRoutes(appDir)

    for (const route of routes) {
      const relPath = relative(ROOT, route)
      const normalizedPath = relPath.replace(/\\/g, '/')
      const isPublic = PUBLIC_ROUTE_PATTERNS.some((p) => normalizedPath.includes(p))

      if (isPublic) continue

      it(`${relPath} — has authorization guard`, () => {
        const content = readFileSync(route, 'utf-8')

        // Route must contain at least one auth pattern
        const hasAuth = AUTH_PATTERNS.some((pattern) => content.includes(pattern))

        expect(
          hasAuth,
          `API route ${relPath} is missing authorization. ` +
            'Every non-public route must call authorize(), withAuth(), or requireEntityAccess().',
        ).toBe(true)
      })
    }
  }
})
