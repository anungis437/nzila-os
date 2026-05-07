/**
 * Contract Test — TrustCore TrustOps Org Isolation & Auth Parity
 *
 * The trustcore-trustops app must enforce per-org data scoping at every
 * API route and every server-rendered page that reads tenant data, and
 * its data-access layer (mandates-store) must require an orgId on every
 * read/write that touches tenant rows.
 *
 * @invariant TRUSTOPS_AUTH_REQUIRED_001: Every non-public route.ts calls auth
 * @invariant TRUSTOPS_ORG_SCOPE_002: Every non-public route.ts resolves an org context
 * @invariant TRUSTOPS_PAGE_ORG_SCOPE_003: Every server page that lists/reads tenant data resolves orgId
 * @invariant TRUSTOPS_NO_BODY_ORG_004: orgId is never read from a request body / form
 * @invariant TRUSTOPS_STORE_ORG_PARAM_005: Tenant-scoped store fns require an orgId parameter
 * @invariant TRUSTOPS_STORE_ORG_FILTER_006: Tenant-scoped Drizzle queries filter on trustopsMandates.orgId
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APP_ROOT = join(ROOT, 'apps', 'trustcore-trustops')

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
    normalized.includes('/api/ready/') ||
    normalized.includes('/api/version/') ||
    normalized.includes('/api/auth/')
  )
}

const AUTH_PATTERNS = [
  /authenticateUser\s*\(/,
  /withRequestContext\s*\(/,
  /withOrgScope\s*\(/,
  /requireOrgAccess\s*\(/,
  /requirePlatformRole\s*\(/,
  /\bauth\s*\(\s*\)/,
  /verifyWebhookSignature\s*\(/,
]

const ORG_PATTERNS = [
  /withOrgScope\s*\(/,
  /getOrganizationIdForUser\s*\(/,
  /requireOrgAccess\s*\(/,
]

// ── TRUSTOPS_AUTH_REQUIRED_001 ─────────────────────────────────────────────

describe('TRUSTOPS_AUTH_REQUIRED_001 — Every TrustOps route calls auth', () => {
  it('all route.ts files in apps/trustcore-trustops/app call an auth function', () => {
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

// ── TRUSTOPS_ORG_SCOPE_002 ─────────────────────────────────────────────────

describe('TRUSTOPS_ORG_SCOPE_002 — Every TrustOps route resolves org scope', () => {
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

// ── TRUSTOPS_PAGE_ORG_SCOPE_003 ────────────────────────────────────────────

describe('TRUSTOPS_PAGE_ORG_SCOPE_003 — Tenant pages resolve orgId before reading store', () => {
  it('every page.tsx that imports the mandates-store resolves orgId', () => {
    const pages = walkSync(join(APP_ROOT, 'app'), 'page.tsx')
    const violations: string[] = []
    for (const page of pages) {
      const content = readContent(page)
      const usesStore = /from\s+['"][^'"]*mandates-store['"]/.test(content)
      if (!usesStore) continue
      const resolvesOrg = /getOrganizationIdForUser\s*\(/.test(content)
      if (!resolvesOrg) violations.push(relPath(page))
    }
    expect(violations, `Pages reading tenant data without org resolution:\n${violations.join('\n')}`).toEqual([])
  })
})

// ── TRUSTOPS_NO_BODY_ORG_004 ───────────────────────────────────────────────

describe('TRUSTOPS_NO_BODY_ORG_004 — orgId never sourced from request body', () => {
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

// ── TRUSTOPS_STORE_ORG_PARAM_005 ───────────────────────────────────────────

describe('TRUSTOPS_STORE_ORG_PARAM_005 — Store fns require orgId parameter', () => {
  it('listMandates / getMandate / getCreditors / getClaims / transitionStage all accept orgId', () => {
    const storePath = join(APP_ROOT, 'lib', 'mandates-store.ts')
    expect(existsSync(storePath), `Expected store file at ${relPath(storePath)}`).toBe(true)
    const content = readContent(storePath)

    const fnSignatures: Array<{ name: string; pattern: RegExp }> = [
      { name: 'listMandates', pattern: /export\s+async\s+function\s+listMandates\s*\([^)]*orgId[^)]*\)/ },
      { name: 'getMandate', pattern: /export\s+async\s+function\s+getMandate\s*\([^)]*orgId[^)]*\)/ },
      { name: 'getCreditors', pattern: /export\s+async\s+function\s+getCreditors\s*\([^)]*orgId[^)]*\)/ },
      { name: 'getClaims', pattern: /export\s+async\s+function\s+getClaims\s*\([^)]*orgId[^)]*\)/ },
      { name: 'transitionStage', pattern: /export\s+async\s+function\s+transitionStage\s*\([^)]*orgId[^)]*\)/ },
    ]

    const missing = fnSignatures.filter((f) => !f.pattern.test(content)).map((f) => f.name)
    expect(missing, `Store fns missing orgId parameter: ${missing.join(', ')}`).toEqual([])
  })
})

// ── TRUSTOPS_STORE_ORG_FILTER_006 ──────────────────────────────────────────

describe('TRUSTOPS_STORE_ORG_FILTER_006 — Store filters tenant queries on orgId', () => {
  it('mandates-store.ts uses eq(trustopsMandates.orgId, orgId) for tenant scoping', () => {
    const storePath = join(APP_ROOT, 'lib', 'mandates-store.ts')
    const content = readContent(storePath)
    const orgFilterCount = (content.match(/\.orgId\s*,\s*orgId\b/g) ?? []).length
    expect(
      orgFilterCount,
      'Expected at least 3 orgId equality filters across listMandates/getMandate/getCreditors/getClaims/transitionStage',
    ).toBeGreaterThanOrEqual(3)
  })
})
