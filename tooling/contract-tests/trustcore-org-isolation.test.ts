/**
 * Contract Test — TrustCore Org Isolation & Auth Parity
 *
 * TrustCore must enforce per-org data scoping at every API route.
 * Every protected route must call an auth function and resolve an org context
 * before accessing tenant data.
 *
 * @invariant TRUSTCORE_AUTH_REQUIRED_001: Every non-public route.ts calls auth
 * @invariant TRUSTCORE_ORG_SCOPE_002: Every non-public route.ts resolves an org context
 * @invariant TRUSTCORE_NO_BODY_ORG_003: orgId is never read from a request body
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APP_ROOT = join(ROOT, 'apps', 'trustcore')

function walkSync(dir: string, fileName?: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist'].includes(entry.name)) continue
      results.push(...walkSync(fullPath, fileName))
    } else if (entry.isFile()) {
      if (fileName) {
        if (entry.name === fileName) results.push(fullPath)
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(fullPath)
      }
    }
  }
  return results
}

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function relPath(fullPath: string): string {
  return fullPath.replace(ROOT, '').replace(/\\/g, '/')
}

function isPublicRoute(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, '/')
  return (
    normalized.includes('/api/health/') ||
    normalized.endsWith('/api/health/route.ts') ||
    normalized.includes('/api/ready/') ||
    normalized.endsWith('/api/ready/route.ts') ||
    normalized.includes('/api/version/') ||
    normalized.endsWith('/api/version/route.ts') ||
    normalized.endsWith('/api/leads/route.ts') || // public lead capture endpoint
    normalized.includes('/api/auth/') ||
    normalized.includes('/api/billing/webhook/') || // Stripe webhook (signature verified, not org-scoped)
    normalized.includes('/webhook')
  )
}

const AUTH_PATTERNS = [
  /authenticateUser\s*\(/,
  /withRequestContext\s*\(/,
  /withOrgScope\s*\(/,
  /withRequiredRole\s*\(/,
  /requireOrgAccess\s*\(/,
  /requirePlatformRole\s*\(/,
  /getAuthContext\s*\(/,
  /\bauth\s*\(\s*\)/,
  /verifyWebhookSignature\s*\(/,
  /verifyStripeSignature\s*\(/,
]

const ORG_PATTERNS = [
  /withOrgScope\s*\(/,
  /withRequiredRole\s*\(/,
  /ctx\.orgId/,
  /organizationId\s*:\s*ctx\.orgId/,
  /getOrganizationIdForUser\s*\(/,
  /requireOrgAccess\s*\(/,
]

// ── TRUSTCORE_AUTH_REQUIRED_001 ────────────────────────────────────────────

describe('TRUSTCORE_AUTH_REQUIRED_001 — Every TrustCore route calls auth', () => {
  it('all route.ts files in apps/trustcore/app call an auth function', () => {
    const routes = walkSync(join(APP_ROOT, 'app'), 'route.ts')
    expect(routes.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const route of routes) {
      if (isPublicRoute(route)) continue
      const content = readContent(route)
      const hasAuth = AUTH_PATTERNS.some((p) => p.test(content))
      if (!hasAuth) violations.push(relPath(route))
    }

    expect(violations, `Routes missing auth call:\n${violations.join('\n')}`).toEqual([])
  })
})

// ── TRUSTCORE_ORG_SCOPE_002 ────────────────────────────────────────────────

describe('TRUSTCORE_ORG_SCOPE_002 — Every TrustCore route resolves org scope', () => {
  it('all route.ts files resolve an org via withOrgScope/getOrganizationIdForUser', () => {
    const routes = walkSync(join(APP_ROOT, 'app'), 'route.ts')
    const violations: string[] = []
    for (const route of routes) {
      if (isPublicRoute(route)) continue
      const content = readContent(route)
      const hasOrg = ORG_PATTERNS.some((p) => p.test(content))
      if (!hasOrg) violations.push(relPath(route))
    }
    expect(violations, `Routes missing org-scope resolution:\n${violations.join('\n')}`).toEqual([])
  })
})

// ── TRUSTCORE_NO_BODY_ORG_003 ──────────────────────────────────────────────

describe('TRUSTCORE_NO_BODY_ORG_003 — orgId never sourced from request body', () => {
  it('no route.ts reads orgId from json/formData/body', () => {
    const routes = walkSync(join(APP_ROOT, 'app'), 'route.ts')
    const violations: { file: string; line: string }[] = []
    // Patterns that would indicate body-sourced orgId
    const bad = [
      /orgId\s*[:=]\s*[^\n]*\bawait\s+req\.json\s*\(/,
      /orgId\s*[:=]\s*[^\n]*\bawait\s+request\.json\s*\(/,
      /orgId\s*[:=]\s*[^\n]*\.formData\s*\(/,
      /\bbody\.orgId\b/,
      /form\.get\s*\(\s*['"]orgId['"]\s*\)/,
    ]
    for (const route of routes) {
      const content = readContent(route)
      for (const pat of bad) {
        const match = content.match(pat)
        if (match) violations.push({ file: relPath(route), line: match[0] })
      }
    }
    expect(
      violations,
      `orgId sourced from request body:\n${violations.map((v) => `${v.file}: ${v.line}`).join('\n')}`,
    ).toEqual([])
  })
})
