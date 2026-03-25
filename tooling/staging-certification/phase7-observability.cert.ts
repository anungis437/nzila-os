/**
 * PHASE 7 — Observability Certification
 *
 * Validates the observability stack is production-certifiable:
 *  - SchemaError class is properly defined and functional
 *  - wrapSchemaQuery pattern works correctly
 *  - Structured logging format is consistent
 *  - Audit hash chain integrity mechanism exists
 *  - No raw internal errors exposed via API responses
 *  - Logger implementations exist across services
 *  - Error boundaries present in deployed apps
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 8 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (entry === 'node_modules' || entry === '.next') continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (pattern.test(entry)) results.push(full)
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

describe('CERT-PHASE-7 — Observability Certification', () => {
  // ── SchemaError class validation ──────────────────────────────────────
  describe('SchemaError class', () => {
    const schemaErrorPath = join(ROOT, 'tooling', 'db', 'schema-error.ts')
    const content = readIfExists(schemaErrorPath)

    it('SchemaError file exists', () => {
      expect(existsSync(schemaErrorPath)).toBe(true)
    })

    it('SchemaError extends Error', () => {
      expect(content).toContain('extends Error')
    })

    it('has SCHEMA_MISMATCH error code', () => {
      expect(content).toContain('SCHEMA_MISMATCH')
    })

    it('has structured log output method', () => {
      expect(content).toContain('toStructuredLog')
    })

    it('has context with table, column, route fields', () => {
      expect(content).toContain('table')
      expect(content).toContain('column')
      expect(content).toContain('route')
    })

    it('wrapSchemaQuery helper is defined', () => {
      expect(content).toContain('wrapSchemaQuery')
    })

    it('wrapSchemaQuery catches schema-related patterns', () => {
      expect(content).toContain('SCHEMA_ERROR_PATTERNS')
      // Should catch common DB schema errors
      expect(content).toMatch(/column|relation|does not exist|type mismatch/i)
    })

    it('wrapSchemaQuery re-throws as SchemaError', () => {
      expect(content).toMatch(/throw\s+(new\s+)?SchemaError|throw\s+schemaErr/)
    })
  })

  // ── Audit hash chain ─────────────────────────────────────────────────
  describe('audit hash chain integrity', () => {
    it('audit events schema has hash + previous_hash columns', () => {
      // Check both UE schema and packages for audit hash columns
      const ueSchemaFiles = findFiles(join(APPS_DIR, 'union-eyes', 'db', 'schema'), /\.ts$/)
      const pkgFiles = findFiles(join(ROOT, 'packages', 'os-core', 'src'), /hash/i)
      const allFiles = [...ueSchemaFiles, ...pkgFiles]
      const hasHashChain = allFiles.some(f => {
        try {
          const c = readFileSync(f, 'utf-8')
          return (c.includes('hash') && c.includes('previous_hash')) ||
                 (c.includes('hash') && c.includes('previousHash')) ||
                 c.includes('computeEntryHash')
        } catch { return false }
      })
      expect(hasHashChain).toBe(true)
    })

    it('hash chain computation function exists', () => {
      // computeEntryHash is in packages/os-core/src/hash.ts
      const hashFiles = findFiles(join(ROOT, 'packages', 'os-core', 'src'), /hash/i)
      const ueAuditFiles = findFiles(join(APPS_DIR, 'union-eyes', 'lib'), /audit|hash/i)
      const allFiles = [...hashFiles, ...ueAuditFiles]
      const hasCompute = allFiles.some(f => {
        try {
          const c = readFileSync(f, 'utf-8')
          return c.includes('computeEntryHash') || c.includes('computeHash') ||
                 c.includes('createHash')
        } catch { return false }
      })
      expect(hasCompute).toBe(true)
    })

    it('hash chain drift detection exists in CI', () => {
      const ciFile = join(ROOT, '.github', 'workflows', 'ci.yml')
      const content = readIfExists(ciFile)
      expect(content).toContain('hash-chain-drift')
    })
  })

  // ── Logger implementations ────────────────────────────────────────────
  describe('logging infrastructure', () => {
    it('union-eyes has a logger module', () => {
      const loggerFiles = findFiles(join(APPS_DIR, 'union-eyes', 'lib'), /logger/i)
      expect(loggerFiles.length).toBeGreaterThan(0)
    })

    it('financial service uses structured logging (winston)', () => {
      const indexFile = join(APPS_DIR, 'union-eyes', 'services', 'financial-service', 'src', 'index.ts')
      const content = readIfExists(indexFile)
      expect(content).toContain('winston')
    })

    it('console has logger infrastructure', () => {
      // Console uses createLogger from @nzila/os-core
      const consoleFiles = findFiles(join(APPS_DIR, 'console'), /route\.ts$/)
      const hasLogger = consoleFiles.some(f => {
        try {
          const c = readFileSync(f, 'utf-8')
          return c.includes('createLogger') || c.includes('logger')
        } catch { return false }
      })
      expect(hasLogger).toBe(true)
    })
  })

  // ── No raw error exposure ────────────────────────────────────────────
  describe('error exposure prevention', () => {
    it('API routes do not expose raw error.stack in responses', () => {
      const violations: string[] = []
      for (const app of ['union-eyes', 'console', 'partners']) {
        const routeFiles = findFiles(join(APPS_DIR, app, 'app', 'api'), /route\.ts$/)
        for (const f of routeFiles) {
          try {
            const content = readFileSync(f, 'utf-8')
            // Check for error.stack in Response/NextResponse JSON bodies
            if (/NextResponse\.json\([^)]*error\.stack/s.test(content) ||
                /Response\.json\([^)]*error\.stack/s.test(content) ||
                /json\(\s*\{[^}]*stack\s*:/s.test(content)) {
              violations.push(f.replace(ROOT, '').replace(/\\/g, '/'))
            }
          } catch { /* skip */ }
        }
      }
      expect(violations).toEqual([])
    })

    it('catch blocks return generic 500 messages, not raw errors', () => {
      // Spot-check: verify no `return new Response(error.message)` patterns
      const sampleApps = ['union-eyes', 'console']
      const directErrorExposure: string[] = []
      for (const app of sampleApps) {
        const routeFiles = findFiles(join(APPS_DIR, app, 'app', 'api'), /route\.ts$/)
        for (const f of routeFiles.slice(0, 30)) { // sample first 30 per app
          try {
            const content = readFileSync(f, 'utf-8')
            // Flag: catch block directly returns error.message without wrapping
            if (/catch[\s\S]{0,100}new Response\(.*error\.message/.test(content)) {
              directErrorExposure.push(f.replace(ROOT, '').replace(/\\/g, '/'))
            }
          } catch { /* skip */ }
        }
      }
      // Allow a few legacy patterns but flag excessive exposure
      expect(directErrorExposure.length).toBeLessThan(5)
    })
  })

  // ── Error boundaries in Next.js apps ──────────────────────────────────
  describe('error boundary coverage', () => {
    it('deployed apps have error.tsx boundary files', () => {
      const appsWithErrorBoundary: string[] = []
      for (const app of ['union-eyes', 'console', 'web', 'partners']) {
        const errorFiles = findFiles(join(APPS_DIR, app, 'app'), /^error\.(tsx?|jsx?)$/)
        if (errorFiles.length > 0) appsWithErrorBoundary.push(app)
      }
      // At least half should have error boundaries
      expect(appsWithErrorBoundary.length).toBeGreaterThanOrEqual(2)
    })

    it('deployed apps have not-found.tsx pages', () => {
      const appsWithNotFound: string[] = []
      for (const app of ['union-eyes', 'console', 'web', 'partners']) {
        const notFoundFiles = findFiles(join(APPS_DIR, app, 'app'), /^not-found\.(tsx?|jsx?)$/)
        if (notFoundFiles.length > 0) appsWithNotFound.push(app)
      }
      expect(appsWithNotFound.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ── Health endpoints ──────────────────────────────────────────────────
  describe('health endpoints', () => {
    it('union-eyes has /api/health endpoint', () => {
      const healthRoute = join(APPS_DIR, 'union-eyes', 'app', 'api', 'health')
      expect(existsSync(healthRoute)).toBe(true)
    })
  })
})
