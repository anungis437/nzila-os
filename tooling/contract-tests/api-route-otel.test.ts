/**
 * Contract Test — API Route OTel Instrumentation (STUDIO-OTEL-01)
 *
 * Verifies:
 *   1. Every business API route file (beyond /api/health) uses withSpan
 *   2. Every business API route file uses withRequestContext or createRequestContext
 *   3. Every business API route file calls authenticateUser() for auth gating
 *   4. API route count per app is tracked (maturity metric)
 *
 * This ensures all API routes carry distributed tracing spans and
 * request context propagation for log correlation.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * Apps expected to have API routes beyond /api/health.
 * Each has server actions + API routes with OTel tracing.
 */
const INSTRUMENTED_APPS = [
  'cfo',
  'nacp-exams',
  'zonga',
  'partners',
  'web',
] as const

/**
 * Apps that only have /api/health — no business API routes yet.
 * These are tracked but not enforced for route instrumentation.
 */
const EARLY_STAGE_APPS = ['abr'] as const

/**
 * Recursively find all route.ts files under a directory.
 */
function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next') continue
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      results.push(full)
    }
  }
  return results
}

function read(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
}

/**
 * Routes that use alternative auth mechanisms (webhook signatures, token-gating)
 * and may not follow the standard OTel pattern.
 */
const OTEL_EXEMPT_ROUTE_PATTERNS = [
  '/api/quote/[token]/',       // Token-gated public quote response
  '/api/shopify/webhook/',     // Shopify webhook (HMAC-verified)
  '/api/zoho/webhook/',        // Zoho webhook (token-verified)
  '/api/webhooks/stripe/',     // Stripe webhook (signature-verified)
]

function isOtelExempt(routePath: string): boolean {
  const normalised = routePath.replace(/\\/g, '/')
  return OTEL_EXEMPT_ROUTE_PATTERNS.some((p) => normalised.includes(p))
}

describe('API Route OTel Instrumentation — STUDIO-OTEL-01 contract', () => {
  for (const app of INSTRUMENTED_APPS) {
    const apiDir = resolve(ROOT, 'apps', app, 'app', 'api')
    const routeFiles = findRouteFiles(apiDir)
    // Exclude /api/health — it's a liveness probe, not a business route
    const businessRoutes = routeFiles.filter(
      (f) => !f.replace(/\\/g, '/').includes('/api/health/'),
    )

    describe(`apps/${app}`, () => {
      it('has at least one business API route (beyond /api/health)', () => {
        expect(
          businessRoutes.length,
          `apps/${app}/app/api/ should have business routes`,
        ).toBeGreaterThan(0)
      })

      for (const routeFile of businessRoutes) {
        const relPath = routeFile
          .replace(/\\/g, '/')
          .replace(/^.*apps\//, 'apps/')

        if (isOtelExempt(routeFile)) continue

        describe(relPath, () => {
          const content = read(routeFile)

          it('uses withSpan for OTel tracing', () => {
            expect(
              content.includes('withSpan'),
              `${relPath} must use withSpan() for distributed tracing`,
            ).toBe(true)
          })

          it('uses withRequestContext for log correlation', () => {
            expect(
              content.includes('withRequestContext') ||
                content.includes('createRequestContext'),
              `${relPath} must use withRequestContext() for log correlation`,
            ).toBe(true)
          })

          it('calls authenticateUser for auth gating', () => {
            expect(
              content.includes('authenticateUser'),
              `${relPath} must call authenticateUser() for auth`,
            ).toBe(true)
          })
        })
      }
    })
  }

  // Maturity tracking: report route counts
  describe('Route count tracking', () => {
    for (const app of [...INSTRUMENTED_APPS, ...EARLY_STAGE_APPS]) {
      it(`apps/${app} has tracked API route count`, () => {
        const apiDir = resolve(ROOT, 'apps', app, 'app', 'api')
        const routeFiles = findRouteFiles(apiDir)
        // This test always passes — it's for visibility
        expect(routeFiles.length).toBeGreaterThanOrEqual(0)
      })
    }
  })
})
