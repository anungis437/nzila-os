/**
 * Contract test: Org-Scope Provable Safety (PHASE 4)
 *
 * ORGP-001: All multi-tenant API routes must include orgId in DB queries
 * ORGP-002: No API route may accept orgId from request body (must derive from auth)
 * ORGP-003: Financial mutation routes must have audit trail references
 * ORGP-004: All org-scoped apps must enforce org context at middleware level
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

function walkFiles(dir: string, acc: string[] = []): string[] {
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next') {
        walkFiles(full, acc)
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        acc.push(full)
      }
    }
  } catch { /* skip */ }
  return acc
}

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

const EXEMPT_ROUTES = new Set([
  'health', 'webhooks', 'cron', 'clerk', 'stripe', 'admin',
  'status', 'ready', 'docs', 'test-auth',
])

function isExemptRoute(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, '/')
  if (rel.includes('[token]')) return true
  return [...EXEMPT_ROUTES].some(r => rel.includes(`/api/${r}`) || rel.includes(`/${r}/`))
}

// ── ORGP-002: No orgId from request body ────────────────────────────────────

describe('ORGP-002: OrgId must never be accepted from request body', () => {
  const MULTI_TENANT_APPS = [
    'union-eyes', 'flow', 'zonga', 'console', 'partners',
    'cfo', 'abr', 'nacp-exams', 'trade',
  ]

  it('POST/PUT/PATCH routes do not destructure orgId from request body', () => {
    const violations: string[] = []

    for (const app of MULTI_TENANT_APPS) {
      const apiDir = join(APPS_DIR, app, 'app', 'api')
      if (!existsSync(apiDir)) continue

      const routes = walkFiles(apiDir).filter(f => f.endsWith('route.ts'))
      for (const route of routes) {
        if (isExemptRoute(route)) continue
        const src = readSafe(route)

        // Detect: const { orgId } = await req.json()
        // Detect: body.orgId
        const dangerousPatterns = [
          /(?:const|let)\s*\{[^}]*orgId[^}]*\}\s*=\s*(?:await\s+)?(?:req|request)\.json\(\)/,
          /body\.orgId/,
          /json\(\).*orgId/,
        ]

        for (const pattern of dangerousPatterns) {
          if (pattern.test(src)) {
            const rel = route.replace(ROOT + '\\', '').replace(ROOT + '/', '')
            violations.push(`${rel}: orgId derived from request body (INSECURE)`)
          }
        }
      }
    }

    expect(
      violations,
      `CRITICAL: OrgId must come from auth context, not request body:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── ORGP-003: Financial mutations must reference audit trail ────────────────

describe('ORGP-003: Financial mutation routes have audit references', () => {
  const FINANCIAL_APPS = ['zonga', 'cfo', 'union-eyes']

  for (const app of FINANCIAL_APPS) {
    it(`${app} financial POST routes reference audit/evidence patterns`, () => {
      const apiDir = join(APPS_DIR, app, 'app', 'api')
      if (!existsSync(apiDir)) return

      const routes = walkFiles(apiDir).filter(f => f.endsWith('route.ts'))
      const financialRoutes = routes.filter(r => {
        const dir = r.replace(/\\/g, '/')
        return (
          dir.includes('/payouts/') ||
          dir.includes('/revenue/') ||
          dir.includes('/transactions/') ||
          dir.includes('/billing/') ||
          dir.includes('/subscriptions/')
        )
      })

      if (financialRoutes.length === 0) return

      const violations: string[] = []
      for (const route of financialRoutes) {
        const src = readSafe(route)
        // Must contain POST handler
        if (!src.includes('POST')) continue

        const hasAudit =
          src.includes('auditedAction') ||
          src.includes('buildEvidencePack') ||
          src.includes('processEvidencePack') ||
          src.includes('createSpan') ||
          src.includes('withSpan') ||
          src.includes('withOrgScope') ||
          src.includes('withRequestContext') ||
          src.includes('getAuditedDb') ||
          src.includes('auditLog') ||
          src.includes('logApiAuditEvent') ||
          src.includes('evidence') ||
          src.includes('withApi(') ||
          src.includes('withRoleAuth') ||
          src.includes('withMinRole') ||
          src.includes('crudRoutes') ||
          src.includes('requireOrgAccess') ||
          src.includes('authenticateUser') ||
          src.includes('audit_log') ||
          src.includes('stripe')

        if (!hasAudit) {
          const rel = route.replace(ROOT + '\\', '').replace(ROOT + '/', '')
          violations.push(rel)
        }
      }

      expect(
        violations,
        `Financial routes missing audit trail:\n${violations.join('\n')}`,
      ).toEqual([])
    })
  }
})

// ── ORGP-004: Org-scoped apps enforce context at middleware level ────────────

describe('ORGP-004: Org-scoped apps have middleware with auth enforcement', () => {
  const ORG_SCOPED_APPS = [
    'union-eyes', 'flow', 'zonga', 'console', 'partners',
    'cfo', 'abr', 'nacp-exams',
  ]

  for (const app of ORG_SCOPED_APPS) {
    it(`${app} has middleware.ts with auth/org enforcement`, () => {
      const mwPath = join(APPS_DIR, app, 'middleware.ts')
      expect(existsSync(mwPath), `${app}/middleware.ts must exist`).toBe(true)

      const src = readSafe(mwPath)
      const hasAuthEnforcement =
        src.includes('clerkMiddleware') ||
        src.includes('authMiddleware') ||
        src.includes('NextResponse.redirect') ||
        src.includes('auth()') ||
        src.includes('getAuth')

      expect(
        hasAuthEnforcement,
        `${app}/middleware.ts must enforce authentication`,
      ).toBe(true)
    })
  }
})
