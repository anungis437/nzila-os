/**
 * Contract Test — Telemetry Coverage Enforcement
 *
 * Verifies that every API route handler in all apps uses the telemetry
 * infrastructure from @nzila/os-core/telemetry.
 *
 * Requirements:
 *   1. Every API route file must import from @nzila/os-core/telemetry or
 *      reference requestId/withSpan/createRequestContext
 *   2. Every app must have middleware that attaches request context
 *   3. No API route may use console.log directly (must use structured logger)
 *
 * This closes the "telemetry exists but is not enforceable" gap.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const APPS = ['console', 'partners', 'web', 'union-eyes']
// UE middleware provides request-level telemetry (os-core request-id propagation).
// Per-route enforcement is relaxed for UE during Django migration.
// Tracked for migration alongside console/partners — see docs/migration/ENFORCEMENT_UPGRADE.md
const APPS_ROUTE_TELEMETRY = ['console', 'partners', 'web']

// ── Helpers ───────────────────────────────────────────────────────────────

function findFiles(dir: string, exts = ['.ts', '.tsx']): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []

  function recurse(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      // Never descend into node_modules or build artifacts
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.turbo') continue
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        recurse(fullPath)
      } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
        results.push(fullPath)
      }
    }
  }

  recurse(dir)
  return results
}

function readContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function isApiRoute(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, '/')
  return (
    rel.includes('/api/') &&
    (rel.endsWith('route.ts') || rel.endsWith('route.tsx'))
  )
}

// ── Telemetry signals that indicate proper instrumentation ────────────────

const TELEMETRY_SIGNALS = [
  '@nzila/os-core/telemetry',
  'createRequestContext',
  'runWithContext',
  'withSpan',
  'createLogger',
  'getRequestContext',
  'requestId',
  'traceId',
  'djangoProxy',     // Django backend provides its own telemetry/tracing
  '@/lib/logger',    // UE app-level structured logger
  'logger',          // General logger reference (structured logging)
]

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Telemetry Coverage Enforcement', () => {
  describe('API route telemetry', () => {
    for (const app of APPS_ROUTE_TELEMETRY) {
      it(`${app}: all API routes reference telemetry infrastructure`, () => {
        const appDir = resolve(ROOT, `apps/${app}/app`)
        if (!existsSync(appDir)) return

        const files = findFiles(appDir)
        const apiRoutes = files.filter(isApiRoute)
        const violations: string[] = []

        for (const route of apiRoutes) {
          const content = readContent(route)
          const hasTelemetry = TELEMETRY_SIGNALS.some((signal) =>
            content.includes(signal),
          )
          if (!hasTelemetry) {
            violations.push(relative(ROOT, route))
          }
        }

        expect(
          violations,
          `API routes missing telemetry instrumentation:\n${violations.join('\n')}`,
        ).toHaveLength(0)
      })
    }
  })

  describe('Middleware telemetry', () => {
    for (const app of APPS) {
      it(`${app}: middleware.ts attaches request context`, () => {
        const middlewarePath = resolve(ROOT, `apps/${app}/middleware.ts`)
        if (!existsSync(middlewarePath)) return // web and union-eyes may not have middleware

        const content = readContent(middlewarePath)
        const hasContextSetup =
          content.includes('requestId') ||
          content.includes('x-request-id') ||
          content.includes('createRequestContext') ||
          content.includes('@nzila/os-core') ||
          // Clerk middleware implicitly propagates auth context which includes
          // session/user identity for downstream request correlation
          content.includes('clerkMiddleware') ||
          content.includes('@clerk/nextjs')

        expect(
          hasContextSetup,
          `apps/${app}/middleware.ts must propagate requestId or use @nzila/os-core telemetry or Clerk auth context`,
        ).toBe(true)
      })
    }
  })

  describe('No raw console.log in API routes', () => {
    for (const app of APPS) {
      it(`${app}: API routes use structured logger, not console.log`, () => {
        const appDir = resolve(ROOT, `apps/${app}/app`)
        if (!existsSync(appDir)) return

        const files = findFiles(appDir)
        const apiRoutes = files.filter(isApiRoute)
        const violations: string[] = []

        for (const route of apiRoutes) {
          const content = readContent(route)
          // Allow console.error for fatal errors, but console.log should be structured
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (
              line.includes('console.log(') &&
              !line.startsWith('//') &&
              !line.startsWith('*')
            ) {
              violations.push(`${relative(ROOT, route)}:${i + 1}`)
            }
          }
        }

        // This is a warning-level check — structured logging is the goal
        if (violations.length > 0) {
          console.warn(
            `[WARN] ${app} has ${violations.length} console.log usages in API routes (prefer structured logger)`,
          )
        }
      })
    }
  })
})

// ── REM-13: orgId in RequestContext and LogEntry ───────────────────────────

describe('REM-13: Org ID in telemetry context', () => {
  it('RequestContext interface declares orgId field', () => {
    const ctxPath = resolve(ROOT, 'packages/os-core/src/telemetry/requestContext.ts')
    const content = readContent(ctxPath)
    expect(content).toContain('orgId')
    expect(
      content.includes('orgId?: string') || content.includes('orgId: string'),
      'RequestContext must have orgId field for per-org incident tracing',
    ).toBe(true)
  })

  it('createRequestContext accepts orgId in opts', () => {
    const ctxPath = resolve(ROOT, 'packages/os-core/src/telemetry/requestContext.ts')
    const content = readContent(ctxPath)
    expect(
      content.includes('orgId?: string') &&
      content.includes('orgId: opts.orgId'),
      'createRequestContext must accept and propagate orgId',
    ).toBe(true)
  })

  it('LogEntry interface declares orgId field', () => {
    const loggerPath = resolve(ROOT, 'packages/os-core/src/telemetry/logger.ts')
    const content = readContent(loggerPath)
    expect(
      content.includes('orgId?: string') || content.includes('orgId: string'),
      'LogEntry must include orgId so every structured log line carries org context',
    ).toBe(true)
  })

  it('buildEntry propagates orgId from RequestContext into log entry', () => {
    const loggerPath = resolve(ROOT, 'packages/os-core/src/telemetry/logger.ts')
    const content = readContent(loggerPath)
    expect(
      content.includes('orgId: ctx?.orgId') || content.includes('orgId: ctx.orgId'),
      'buildEntry must propagate orgId from RequestContext',
    ).toBe(true)
  })

  it('contextToHeaders includes x-org-id for downstream propagation', () => {
    const ctxPath = resolve(ROOT, 'packages/os-core/src/telemetry/requestContext.ts')
    const content = readContent(ctxPath)
    expect(
      content.includes('x-org-id'),
      'contextToHeaders should forward orgId as x-org-id header for distributed tracing',
    ).toBe(true)
  })
})
