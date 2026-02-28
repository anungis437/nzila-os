/**
 * Contract Test — ABR Org Isolation & Auth Parity
 *
 * ABR must enforce org-scoped data access and platform-parity auth patterns.
 *
 * @invariant ABR_ORG_CONTEXT_001: Every ABR API route resolves org context
 * @invariant ABR_AUTH_REQUIRED_002: Every non-public ABR route calls auth
 * @invariant ABR_NO_UNSCOPD_BODY_003: entityId/orgId never taken from raw request body
 * @invariant ABR_ISOLATION_PROOF_004: ABR exposes an isolation-proof endpoint
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const ABR_ROOT = join(ROOT, 'apps', 'abr')

function walkSync(
  dir: string,
  extensions: string[] = ['.ts', '.tsx'],
): string[] {
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

function findRouteFiles(appDir: string): string[] {
  if (!existsSync(appDir)) return []
  const found: string[] = []
  const stack = [appDir]
  while (stack.length > 0) {
    const dir = stack.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.turbo'].includes(entry.name)) continue
        stack.push(fullPath)
      } else if (entry.isFile() && entry.name === 'route.ts') {
        found.push(fullPath)
      }
    }
  }
  return found
}

function isPublicRoute(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, '/')
  return (
    normalized.includes('/api/health/') ||
    normalized.endsWith('/api/health/route.ts')
  )
}

const AUTH_PATTERNS = [
  /authenticateUser\s*\(/,
  /withRequestContext\s*\(/,
  /requireEntityAccess\s*\(/,
  /requirePlatformRole\s*\(/,
  /auth\s*\(\)/,
  /verifyWebhookSignature\s*\(/,
]

// ── ABR_AUTH_REQUIRED_002 ──────────────────────────────────────────────────

describe('ABR_AUTH_REQUIRED_002 — Every ABR route calls auth', () => {
  it('all ABR route.ts files call an auth function (except health)', () => {
    const routes = findRouteFiles(join(ABR_ROOT, 'app'))
    const violations: string[] = []

    for (const route of routes) {
      if (isPublicRoute(route)) continue
      const content = readContent(route)
      const hasAuth = AUTH_PATTERNS.some((p) => p.test(content))
      if (!hasAuth) {
        violations.push(relPath(route))
      }
    }

    expect(
      violations,
      `ABR routes missing auth call:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── ABR_NO_UNSCOPD_BODY_003 ────────────────────────────────────────────────

describe('ABR_NO_UNSCOPD_BODY_003 — orgId/entityId never from request body', () => {
  const BODY_ORG_PATTERN =
    /(?:req|request)\.(?:body|json\(\))\s*\.\s*(?:entityId|orgId)|body\s*\.\s*(?:entityId|orgId)(?!\s*===\s*auth)/

  it('no ABR route takes orgId/entityId directly from request body', () => {
    const routes = findRouteFiles(join(ABR_ROOT, 'app'))
    const violations: string[] = []

    for (const route of routes) {
      const content = readContent(route)
      if (BODY_ORG_PATTERN.test(content)) {
        violations.push(relPath(route))
      }
    }

    expect(
      violations,
      `ABR routes take org identifier from request body (security risk):\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── ABR_ORG_CONTEXT_001 ────────────────────────────────────────────────────

describe('ABR_ORG_CONTEXT_001 — ABR lib/api-guards.ts enforces auth context', () => {
  it('ABR api-guards.ts exists and exports authenticateUser', () => {
    const guardsPath = join(ABR_ROOT, 'lib', 'api-guards.ts')
    expect(existsSync(guardsPath), 'ABR must have lib/api-guards.ts').toBe(true)

    const content = readContent(guardsPath)
    expect(content).toContain('authenticateUser')
  })

  it('ABR api.ts uses auth token interceptor', () => {
    const apiPath = join(ABR_ROOT, 'lib', 'api.ts')
    if (!existsSync(apiPath)) return

    const content = readContent(apiPath)
    expect(
      content.includes('Authorization') || content.includes('Bearer'),
      'ABR API client must attach auth tokens',
    ).toBe(true)
  })
})

// ── ABR_ISOLATION_PROOF_004 ────────────────────────────────────────────────

describe('ABR_ISOLATION_PROOF_004 — ABR exposes isolation proof endpoint', () => {
  it('ABR has an isolation-proof API route', () => {
    const proofRoute = join(ABR_ROOT, 'app', 'api', 'isolation-proof', 'route.ts')
    expect(
      existsSync(proofRoute),
      'ABR must expose /api/isolation-proof endpoint for platform verification',
    ).toBe(true)
  })

  it('isolation-proof route requires platform-level auth', () => {
    const proofRoute = join(ABR_ROOT, 'app', 'api', 'isolation-proof', 'route.ts')
    if (!existsSync(proofRoute)) return

    const content = readContent(proofRoute)
    const hasAuth = AUTH_PATTERNS.some((p) => p.test(content))
    expect(hasAuth, 'isolation-proof endpoint must require auth').toBe(true)
  })
})
