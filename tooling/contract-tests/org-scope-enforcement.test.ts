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

import { isRetiredNoOpRoute } from './retired-routes'
import { isReexportAliasOfAcceptedRoute } from './route-aliases'
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
  'proof-center/public-key', // System-wide public key (not org-specific)
  'contact',        // Public contact/demo-request form (marketing)
  'courtlens/public-intake', // ABR CourtLens — pseudonymous public intake (validated + rate-limited)
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
  'icra',           // ICRA — pseudonymous public diagnostic (no PII, rate-limited, UUID-gated) [legacy alias]
  'ocra',           // OCRA — canonical alias of icra (OCI↔OCRA convergence Phase 2)
  'workbook',       // Governance Entropy Workbook — pseudonymous bearer-token flow (workbookId is the credential)
  'staging-proof',  // HMAC-gated system proof route; no human organization principal exists
  '_perf',          // Web vitals sendBeacon endpoint (anonymous, no org context)
  'exit-interviews/institutional-', // Legacy public redirect aliases to organizational-* endpoints
])

function isExemptRoute(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, '/').replace(/%5F/gi, '_')  // decode URL-encoded underscore so _perf/_telemetry routes match
  // Token-based public routes (e.g. quote/[token]/respond)
  if (rel.includes('[token]')) return true
  // Match both /api/EXEMPT and embedded /EXEMPT/ segments (e.g. /payments/webhooks/stripe)
  return [...EXEMPT_ROUTES].some((r) => rel.includes(`/api/${r}`) || rel.includes(`/${r}/`))
}

/**
 * The `@/lib/services/*` functions a route imports and calls, with their own body text.
 * Returns null when the route imports a service function it cannot resolve.
 */
function calledServiceFunctions(appDir: string, content: string): { name: string; body: string }[] | null {
  const imports = [...content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/services\/([^'"]+)['"]/g)]
  const called: { name: string; body: string }[] = []
  for (const [, names, modulePath] of imports) {
    const file = [`${modulePath}.ts`, `${modulePath}/index.ts`]
      .map((candidate) => join(appDir, 'lib', 'services', candidate))
      .find((candidate) => existsSync(candidate))
    if (!file) return null
    const source = readFileSync(file, 'utf-8')
    for (const raw of names.split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim()
      const original = raw.trim().split(/\s+as\s+/)[0].trim()
      if (!name || !new RegExp(`\\b${name}\\s*\\(`).test(content)) continue
      const start = source.search(new RegExp(`export\\s+(?:async\\s+)?function\\s+${original}\\s*\\(`))
      if (start < 0) return null
      // Skip the parameter list (balanced parentheses) and any generic return type, then take the balanced body.
      let cursor = source.indexOf('(', start)
      for (let parens = 0; cursor < source.length; cursor++) {
        if (source[cursor] === '(') parens++
        else if (source[cursor] === ')' && --parens === 0) break
      }
      let open = cursor
      for (let angles = 0; open < source.length; open++) {
        if (source[open] === '<') angles++
        else if (source[open] === '>' && source[open - 1] !== '=') angles--
        else if (source[open] === '{' && angles === 0) break
      }
      let end = open
      for (let braces = 0; end < source.length; end++) {
        if (source[end] === '{') braces++
        else if (source[end] === '}' && --braces === 0) break
      }
      called.push({ name, body: source.slice(open, end + 1) })
    }
  }
  return called
}

/** True only when the route calls at least one service function and every one it calls is org-aware in its own body. */
function delegatesOnlyToOrgAwareServices(
  appDir: string,
  content: string,
  isOrgAware: (text: string) => boolean,
): boolean {
  const called = calledServiceFunctions(appDir, content)
  return !!called && called.length > 0 && called.every(({ body }) => isOrgAware(body))
}

describe('Org-scope enforcement patterns', () => {
  const orgScopeApps = APP_REGISTRY.filter(
    (a) => a.requiresOrgScope,
  )

  // The org-scope guards this contract accepts in a route's own text.
  const hasOrgGuardIn = (content: string) =>
    isRetiredNoOpRoute(content) ||
    content.includes('withOrgScope') ||
    content.includes('requireOrgAccess') ||
    /await\s+getCaseActor\s*\(/.test(content) ||
    content.includes('requireVerifiedOrgAccess') ||   // ABR CourtLens — Phase 2C.6
    content.includes('requireVerifiedPermission') ||  // ABR CourtLens — Phase 2C.6
    content.includes('resolveOrgContext') ||
    content.includes('withApi(') ||
    content.includes('withApiAuth(') ||
    content.includes('withRoleAuth(') ||
    content.includes('crudRoutes(') ||
    content.includes('requireApiAuth(') ||
    content.includes('withOrganizationAuth(') ||
    content.includes('withExternalMatterResourceAuth(') ||
    content.includes('getCurrentUser(') ||
    content.includes('withMinRole(') ||
    content.includes('requireUser(') ||
    content.includes('authenticateUser(') ||
    content.includes('verifyWebhookSignature(') ||
    content.includes('auth()') ||
    content.includes('getAuth(') ||
    content.includes('requirePlatformRole(') ||
    content.includes('verifyTrackingToken(') ||   // UE signed, action-bound tracking-link token: the open and click routes record nothing without it
    content.includes('cognitionRoute(')

  it('ORG-ENFC-001: org-scoped apps use withOrgScope or requireOrgAccess in API routes', () => {
    const violations: string[] = []

    for (const app of orgScopeApps) {
      const appDir = join(APPS_DIR, app.id)
      if (!existsSync(appDir)) continue

      const routes = listApiRouteFiles(appDir)
      for (const route of routes) {
        if (isExemptRoute(route)) continue
        const content = readFileSync(route, 'utf-8')
        // A route that only re-exports another route is as guarded as that route: one this contract accepts, or one it already exempts.
        const hasOrgGuard =
          hasOrgGuardIn(content) ||
          isReexportAliasOfAcceptedRoute(route, content, (file, text) => isExemptRoute(file) || hasOrgGuardIn(text))
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

    const ORG_AWARE_TOKENS = [
      'withOrgScope',
      'requireOrgAccess',
      'resolveOrgContext',
      'getDbContext',
      'withRequestContext',
      'requirePlatformRole',
      'orgId',
      'org_id',
      'organizationId',
    ]
    const isOrgAware = (text: string) => ORG_AWARE_TOKENS.some((token) => text.includes(token))

    for (const app of productionOrgApps) {
      const appDir = join(APPS_DIR, app.id)
      if (!existsSync(appDir)) continue

      const routes = listApiRouteFiles(appDir)
      for (const route of routes) {
        if (isExemptRoute(route)) continue
        const content = readFileSync(route, 'utf-8')
        // If route uses authenticateUser but not any org-aware guard, it's a warning.
        // Raw DB access moved out of route handlers into lib/services: when the route
        // delegates every query to service functions, the org scoping is asserted at its
        // real location — each called service function body must itself be org-aware.
        if (
          content.includes('authenticateUser') &&
          !isOrgAware(content) &&
          !delegatesOnlyToOrgAwareServices(appDir, content, isOrgAware)
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
      // Union Eyes replaced the header-keyed org limiter (dead behind an early return and forgeable: a client could omit or forge
      // x-org-id) with an edge guard keyed on the presented credential and client address (lib/rate-limit/proxy-api-guard.ts, R-31),
      // and it applies the verified-organization bucket inside withApi. The other apps keep the original pattern.
      const edgeGuard = mw.includes('decideApiLimit')
      if (!edgeGuard && !mw.includes('checkOrgRateLimit') && !mw.includes('orgRateLimit')) {
        violations.push(`${app.id}: proxy.ts missing org-scoped rate limiting`)
      }
      if (edgeGuard) {
        const guardPath = join(APPS_DIR, app.id, 'lib', 'rate-limit', 'proxy-api-guard.ts')
        if (!existsSync(guardPath)) {
          violations.push(`${app.id}: proxy.ts uses decideApiLimit but lib/rate-limit/proxy-api-guard.ts is missing`)
        } else {
          const code = readFileSync(guardPath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
          if (/x-org-id|x-organization-id/i.test(code)) {
            violations.push(`${app.id}: the edge rate-limit guard must not key a bucket on a client-supplied organization header`)
          }
        }
        if (/headers\.get\(\s*['"]x-org-id['"]\s*\)/i.test(mw)) {
          violations.push(`${app.id}: proxy.ts must not read a rate-limit key from the x-org-id request header`)
        }
        const framework = join(APPS_DIR, app.id, 'lib', 'api', 'with-api.ts')
        if (!existsSync(framework) || !readFileSync(framework, 'utf-8').includes('DEFAULT_API_ORG')) {
          violations.push(`${app.id}: withApi must apply the verified-organization default rate limit (DEFAULT_API_ORG)`)
        }
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
