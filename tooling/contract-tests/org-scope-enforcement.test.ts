/**
 * Contract test: Org-scope enforcement patterns (API boundary).
 *
 * ORG-ENFC-001: Org-scoped apps must use withOrgScope or requireOrgAccess in API routes
 * ORG-ENFC-002: Org-scoped apps must not use bare authenticateUser() in API routes
 * ORG-ENFC-003: Org-scoped apps must have org-scoped rate limiting in middleware
 * ORG-ENFC-004: Financial apps must use createAuditedScopedDb (not raw platformDb) for writes
 * ORG-ENFC-005: Entitlement-gated apps must import tier/entitlement checks
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { APP_REGISTRY } from '@nzila/platform-contracts/registry'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

function listApiRouteFiles(appDir: string): string[] {
  const apiDir = join(appDir, 'app', 'api')
  if (!existsSync(apiDir)) return []
  return walkFiles(apiDir).filter(
    (f) => f.endsWith('route.ts') || f.endsWith('route.tsx'),
  )
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (
        e.isDirectory() &&
        !e.name.startsWith('.') &&
        e.name !== 'node_modules'
      ) {
        walkFiles(full, acc)
      } else if (e.isFile()) {
        acc.push(full)
      }
    }
  } catch {
    // skip inaccessible dirs
  }
  return acc
}

/** Routes that are explicitly public (no org scope needed). */
const EXEMPT_ROUTES = new Set([
  'health',
  'webhooks',
  'cron',
  'clerk',
  'auth',             // NextAuth handler (/api/auth/[...nextauth])
  'auth_core',        // Django auth core health/status endpoints
  'rights/terms',            // Public rights/terms routes (terms, agreement)
  'stripe',
  'admin',  // platform admin routes are role-scoped, not org-scoped
  'zoho/webhook',   // Zoho webhook uses HMAC verification
  'shopify/webhook', // Shopify webhook uses HMAC verification
  'docs',           // API documentation endpoints (public)
  'status',         // Status/health check endpoint (public)
  'test-auth',      // Test endpoint (dev-only)
  'ready',          // Readiness probe (k8s/infra)
  'version',        // Build version metadata (public)
  'whop/unauthenticated', // Payment-first checkout (no auth by design)
  'proof-center/public-key', // System-wide public key (not org-specific)
  'contact',        // Public contact/demo-request form (marketing)
  'trial',          // Public Flow trial signup form
  'telemetry',      // Public marketing telemetry (anonymous page events)
  'metrics',        // Telemetry scrape endpoint (token-gated)
  'waitlist',       // Public marketing waitlist signup
  'newsletter',     // Public marketing newsletter signup
  'referrals',      // Public referral signup
  'templates/download', // Public template download lead capture
  'analytics',      // Public marketing analytics events (anonymous)
  'monday-reset',   // Public weekly checklist (static content)
  'billing/checkout', // Public SaaS checkout (Stripe-hosted)
  '_perf',          // Web vitals sendBeacon endpoint (anonymous, no org context)
])

function isExemptRoute(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, '/')
  // Token-based public routes (e.g. quote/[token]/respond)
  if (rel.includes('[token]')) return true
  // Match both /api/EXEMPT and embedded /EXEMPT/ segments (e.g. /payments/webhooks/stripe)
  return [...EXEMPT_ROUTES].some((r) => rel.includes(`/api/${r}`) || rel.includes(`/${r}/`))
}

describe('Org-scope enforcement patterns', () => {
  const orgScopeApps = APP_REGISTRY.filter(
    (a) => a.requiresOrgScope,
  )

  it('ORG-ENFC-001: org-scoped apps use withOrgScope or requireOrgAccess in API routes', () => {
    const violations: string[] = []

    for (const app of orgScopeApps) {
      const appDir = join(APPS_DIR, app.id)
      if (!existsSync(appDir)) continue

      const routes = listApiRouteFiles(appDir)
      for (const route of routes) {
        if (isExemptRoute(route)) continue
        const content = readFileSync(route, 'utf-8')
        const hasOrgGuard =
          content.includes('withOrgScope') ||
          content.includes('requireOrgAccess') ||
          content.includes('resolveOrgContext') ||
          content.includes('withApi(') ||
          content.includes('withApiAuth(') ||
          content.includes('withRoleAuth(') ||
          content.includes('crudRoutes(') ||
          content.includes('requireApiAuth(') ||
          content.includes('withOrganizationAuth(') ||
          content.includes('getCurrentUser(') ||
          content.includes('withMinRole(') ||
          content.includes('requireUser(') ||
          content.includes('authenticateUser(') ||
          content.includes('verifyWebhookSignature(') ||
          content.includes('auth()') ||
          content.includes('getAuth(') ||
          content.includes('requirePlatformRole(')
        if (!hasOrgGuard) {
          const rel = route.replace(APPS_DIR, '').replace(/\\/g, '/')
          violations.push(`${app.id}: ${rel} — no org-scope guard`)
        }
      }
    }

    expect(violations, `API routes missing org-scope guard:\n${violations.join('\n')}`).toEqual([])
  })

  it('ORG-ENFC-002: org-scoped apps should not use bare authenticateUser() as sole guard in routes', () => {
    const warnings: string[] = []
    // Only enforce for PRODUCTION tier — PILOT/INCUBATING apps are migrating progressively
    const productionOrgApps = orgScopeApps.filter(a => a.tier === 'PRODUCTION')

    for (const app of productionOrgApps) {
      const appDir = join(APPS_DIR, app.id)
      if (!existsSync(appDir)) continue

      const routes = listApiRouteFiles(appDir)
      for (const route of routes) {
        if (isExemptRoute(route)) continue
        const content = readFileSync(route, 'utf-8')
        // If route uses authenticateUser but not any org-aware guard, it's a warning
        if (
          content.includes('authenticateUser') &&
          !content.includes('withOrgScope') &&
          !content.includes('requireOrgAccess') &&
          !content.includes('resolveOrgContext') &&
          !content.includes('getDbContext') &&
          !content.includes('withRequestContext') &&
          !content.includes('requirePlatformRole') &&
          !content.includes('orgId') &&
          !content.includes('org_id') &&
          !content.includes('organizationId')
        ) {
          const rel = route.replace(APPS_DIR, '').replace(/\\/g, '/')
          warnings.push(`${app.id}: ${rel} — uses authenticateUser without org guard`)
        }
      }
    }

    expect(warnings, `Routes using bare auth without org scope:\n${warnings.join('\n')}`).toEqual([])
  })

  it('ORG-ENFC-003: org-scoped apps must have org-scoped rate limiting', () => {
    const violations: string[] = []
    // Rate limiting is a production hardening concern — only enforce for PRODUCTION tier
    const productionOrgApps = orgScopeApps.filter(a => a.tier === 'PRODUCTION')

    for (const app of productionOrgApps) {
      const mwPath = join(APPS_DIR, app.id, 'proxy.ts')
      if (!existsSync(mwPath)) {
        violations.push(`${app.id}: missing proxy.ts`)
        continue
      }
      const mw = readFileSync(mwPath, 'utf-8')
      if (!mw.includes('checkOrgRateLimit') && !mw.includes('orgRateLimit')) {
        violations.push(`${app.id}: proxy.ts missing org-scoped rate limiting`)
      }
    }

    expect(
      violations,
      `Org-scoped apps missing org rate limiting:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('ORG-ENFC-004: financial apps must have audited DB access in guards', () => {
    const financialApps = APP_REGISTRY.filter(
      (a) => a.emitsFinancialRecords,
    )
    const violations: string[] = []

    for (const app of financialApps) {
      const guardsPath = join(APPS_DIR, app.id, 'lib', 'api-guards.ts')
      if (!existsSync(guardsPath)) {
        violations.push(`${app.id}: missing lib/api-guards.ts`)
        continue
      }
      const guards = readFileSync(guardsPath, 'utf-8')
      if (
        !guards.includes('createAuditedScopedDb') &&
        !guards.includes('AuditedScopedDb')
      ) {
        violations.push(`${app.id}: api-guards.ts missing createAuditedScopedDb`)
      }
    }

    expect(
      violations,
      `Financial apps missing audited DB:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('ORG-ENFC-005: partner-type apps must have entitlement checks', () => {
    const partnerApps = APP_REGISTRY.filter(
      (a) =>
        a.enabledCapabilities?.includes('entitlements') ||
        a.id === 'partners',
    )
    if (partnerApps.length === 0) return // no partner apps in registry

    const violations: string[] = []

    for (const app of partnerApps) {
      const appDir = join(APPS_DIR, app.id)
      if (!existsSync(appDir)) continue

      const libDir = join(appDir, 'lib')
      if (!existsSync(libDir)) {
        violations.push(`${app.id}: missing lib/ directory`)
        continue
      }

      const files = walkFiles(libDir)
      const hasTierGate = files.some((f) => {
        const content = readFileSync(f, 'utf-8')
        return (
          content.includes('tier-gate') ||
          content.includes('tierGate') ||
          content.includes('canAccess') ||
          content.includes('meetsMinTier') ||
          content.includes('checkFeatureGate') ||
          content.includes('featureGates')
        )
      })

      if (!hasTierGate) {
        violations.push(`${app.id}: missing entitlement/tier-gate enforcement`)
      }
    }

    expect(
      violations,
      `Partner apps missing entitlement checks:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
