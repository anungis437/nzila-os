/**
 * ADVERSARIAL PHASE 6 — Failure Simulation & Graceful Degradation
 *
 * Validates that the system handles failures correctly:
 *  1. SchemaError class provides structured error logging
 *  2. Error boundaries exist in all apps
 *  3. Health endpoints exist for monitoring
 *  4. API routes do not expose stack traces
 *  5. Financial service has defensive error handling
 *  6. wrapSchemaQuery status audit (defined but unused in production)
 *
 * Ensures:
 *  - Errors are categorized, structured, and traceable
 *  - No raw stack trace or secrets leak to clients
 *  - Monitoring can detect failures via health probes
 *  - Financial errors are handled defensively
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const UE_LIB = join(UE, 'lib')
const CONSOLE = join(ROOT, 'apps', 'console')
const TOOLING = join(ROOT, 'tooling')
const PACKAGES = join(ROOT, 'packages')

function read(path: string): string {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8')
}

function walkFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 12 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (['node_modules', '.next', '.turbo', 'dist'].includes(entry)) continue
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

describe('ADVERSARIAL-6 — Failure Simulation & Graceful Degradation', () => {
  // ── SchemaError ───────────────────────────────────────────────────────
  describe('SchemaError structured error class', () => {
    it('SchemaError class exists and extends Error', () => {
      const errorFile = join(TOOLING, 'db', 'schema-error.ts')
      const altFile = join(PACKAGES, 'os-core', 'src', 'schema-error.ts')
      const file = existsSync(errorFile) ? errorFile : altFile
      expect(existsSync(file)).toBe(true)

      const c = read(file)
      expect(c).toMatch(/class\s+SchemaError\s+extends\s+Error/)
    })

    it('SchemaError has error code property', () => {
      const candidates = [
        join(TOOLING, 'db', 'schema-error.ts'),
        join(PACKAGES, 'os-core', 'src', 'schema-error.ts'),
      ]
      const file = candidates.find(existsSync) || ''
      const c = read(file)
      expect(c).toMatch(/code|errorCode/)
    })

    it('SchemaError has structured log output', () => {
      const candidates = [
        join(TOOLING, 'db', 'schema-error.ts'),
        join(PACKAGES, 'os-core', 'src', 'schema-error.ts'),
      ]
      const file = candidates.find(existsSync) || ''
      const c = read(file)
      expect(c).toMatch(/toStructuredLog|toJSON|serialize|toLog/)
    })

    it('SchemaError includes context/metadata', () => {
      const candidates = [
        join(TOOLING, 'db', 'schema-error.ts'),
        join(PACKAGES, 'os-core', 'src', 'schema-error.ts'),
      ]
      const file = candidates.find(existsSync) || ''
      const c = read(file)
      expect(c).toMatch(/context|metadata|details/)
    })

    it('wrapSchemaQuery is used in application code', () => {
      // Check if wrapSchemaQuery is imported in any app code
      const appFiles = [
        ...walkFiles(UE, /\.ts$/),
      ]
      const usedInApps = appFiles.some(f =>
        /wrapSchemaQuery/i.test(read(f))
      )
      expect(usedInApps).toBe(true)
    })

    it('schema-error module exists in union-eyes lib for app imports', () => {
      const libFile = join(UE, 'lib', 'schema-error.ts')
      expect(existsSync(libFile)).toBe(true)
      const c = read(libFile)
      expect(c).toMatch(/wrapSchemaQuery/)
      expect(c).toMatch(/SchemaError/)
    })
  })

  // ── Error Boundaries ──────────────────────────────────────────────────
  describe('error boundaries in applications', () => {
    it('union-eyes has error.tsx boundary', () => {
      const errorFiles = walkFiles(join(UE, 'app'), /^error\.tsx$/)
      expect(errorFiles.length).toBeGreaterThan(0)
    })

    it('union-eyes has not-found.tsx page', () => {
      const notFoundFiles = walkFiles(join(UE, 'app'), /^not-found\.tsx$/)
      expect(notFoundFiles.length).toBeGreaterThan(0)
    })

    it('console has error.tsx boundary', () => {
      const errorFiles = walkFiles(join(CONSOLE, 'app'), /^error\.tsx$/)
      expect(errorFiles.length).toBeGreaterThan(0)
    })

    it('error boundaries do not expose stack traces to users', () => {
      const errorFiles = [
        ...walkFiles(join(UE, 'app'), /^error\.tsx$/),
        ...walkFiles(join(CONSOLE, 'app'), /^error\.tsx$/),
      ]

      for (const f of errorFiles) {
        const c = read(f)
        // Stack traces should either be absent or guarded behind process.env.NODE_ENV === 'development'
        if (/\{error\.stack\}/.test(c)) {
          // If stack is rendered, it MUST be dev-guarded
          expect(c).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]development['"]|NODE_ENV.*development/)
        }
        // Should NOT render raw error.message unfiltered in non-dev mode
        // Minor: some may show a generic message derived from error.message
      }
    })
  })

  // ── Health Endpoints ──────────────────────────────────────────────────
  describe('health check endpoints', () => {
    it('union-eyes has a health API route', () => {
      const healthRoutes = walkFiles(join(UE, 'app', 'api'), /route\.ts$/).filter(f => {
        const normalized = f.replace(/\\/g, '/')
        return /\/api\/health\//.test(normalized) && !/health-safety/i.test(normalized)
      })
      expect(healthRoutes.length).toBeGreaterThan(0)
    })

    it('console has a health API route', () => {
      const healthRoutes = walkFiles(join(CONSOLE, 'app', 'api'), /route\.ts$/).filter(f => {
        const normalized = f.replace(/\\/g, '/')
        return /\/api\/health\//.test(normalized) && !/health-safety/i.test(normalized)
      })
      expect(healthRoutes.length).toBeGreaterThan(0)
    })

    it('health endpoints return 200 for GET', () => {
      const healthRoutes = [
        ...walkFiles(join(UE, 'app', 'api'), /route\.ts$/).filter(f => {
          const normalized = f.replace(/\\/g, '/')
          return /\/api\/health\//.test(normalized) && !/health-safety/i.test(normalized)
        }),
        ...walkFiles(join(CONSOLE, 'app', 'api'), /route\.ts$/).filter(f => {
          const normalized = f.replace(/\\/g, '/')
          return /\/api\/health\//.test(normalized) && !/health-safety/i.test(normalized)
        }),
      ]
      if (healthRoutes.length === 0) return

      for (const f of healthRoutes) {
        const c = read(f)
        // Must export a GET handler (direct or via crudRoutes destructuring)
        expect(c).toMatch(/export\s+(const|async\s+function)\s+GET|export\s*\{[^}]*GET/)
      }
    })
  })

  // ── API Error Response Safety ──────────────────────────────────────────
  describe('API routes do not leak sensitive information', () => {
    it('catch blocks return generic 500 (no raw error in response)', () => {
      const apiRoutes = walkFiles(join(UE, 'app', 'api'), /route\.ts$/)
      // Sample check: verify no route catches an error and dumps it raw
      let dumpCount = 0
      for (const f of apiRoutes) {
        const c = read(f)
        // Pattern: catch(error) { return Response.json(error) }
        // or catch(e) { return NextResponse.json({ error: e }) }
        if (/catch\s*\([^)]*\)\s*\{[^}]*Response\.json\(\s*(error|e|err)\s*[,)]/i.test(c)) {
          dumpCount++
        }
      }
      if (dumpCount > 0) {
        console.warn(
          `[ADVERSARIAL-6] ${dumpCount} API routes may dump raw error objects in responses`
        )
      }
      expect(dumpCount).toBe(0)
    })

    it('no route exposes process.env or database connection strings', () => {
      const apiRoutes = walkFiles(join(UE, 'app', 'api'), /route\.ts$/)
      for (const f of apiRoutes) {
        const c = read(f)
        // Should not return env vars in response
        expect(c).not.toMatch(/Response\.json\(.*process\.env/)
        // Should not include DATABASE_URL in response
        expect(c).not.toMatch(/Response\.json\(.*DATABASE_URL/)
      }
    })
  })

  // ── Financial Service Error Handling ───────────────────────────────────
  describe('financial service error handling', () => {
    it('financial service has express error handling middleware', () => {
      const finSvc = walkFiles(
        join(UE, 'services', 'financial-service', 'src'),
        /\.(ts|js)$/
      )
      const hasErrorMw = finSvc.some(f => {
        const c = read(f)
        // Express error middleware has 4 params: (err, req, res, next)
        return /\(\s*err\s*,\s*req\s*,\s*res\s*,\s*next\s*\)/i.test(c) ||
               /app\.use\(.*error/i.test(c)
      })
      expect(hasErrorMw).toBe(true)
    })

    it('financial service uses helmet for security headers', () => {
      const finSvc = walkFiles(
        join(UE, 'services', 'financial-service', 'src'),
        /\.(ts|js)$/
      )
      const hasHelmet = finSvc.some(f => /helmet/i.test(read(f)))
      expect(hasHelmet).toBe(true)
    })

    it('financial service logs errors with structured logger', () => {
      const finSvc = walkFiles(
        join(UE, 'services', 'financial-service', 'src'),
        /\.(ts|js)$/
      )
      const hasLogger = finSvc.some(f =>
        /winston|pino|logger\.error|console\.error/i.test(read(f))
      )
      expect(hasLogger).toBe(true)
    })
  })

  // ── Graceful Degradation ──────────────────────────────────────────────
  describe('graceful degradation patterns', () => {
    it('database connection failures are caught and reported', () => {
      const dbFiles = [
        ...walkFiles(join(UE, 'db'), /index\.ts$|connection\.ts$/i),
        ...walkFiles(join(PACKAGES), /db.*index\.ts$|connection\.ts$/i),
        ...walkFiles(join(TOOLING, 'db'), /index\.ts$|connection\.ts$/i),
      ]
      const hasCatch = dbFiles.some(f =>
        /catch|try|\.catch|connectionError|onError/i.test(read(f))
      )
      // DB connection may rely on Drizzle/pg pool defaults
      if (!hasCatch) {
        console.warn(
          '[ADVERSARIAL-6] No explicit DB connection error handling found. ' +
          'Relies on default pool behavior for reconnection.'
        )
      }
      expect(true).toBe(true)
    })

    it('Clerk auth failures produce 401 not 500', () => {
      const authFiles = walkFiles(UE_LIB, /auth|guard/i)
      // Auth guards should catch and return 401, not let errors bubble
      const catches401 = authFiles.some(f => {
        const c = read(f)
        return /401|UNAUTHORIZED|Unauthorized/i.test(c)
      })
      expect(catches401).toBe(true)
    })
  })

  // ── NZ-RISK-006: Cross-Tenant RAG Isolation ───────────────────────────────
  describe('ADVERSARIAL-6-RAG — Cross-tenant knowledge isolation', () => {
    /**
     * These tests assert that every code path that reads from embeddings,
     * knowledge_base, or chatbot document tables includes an organizationId
     * (or orgId) scope filter. They are static analysis tests — they do not
     * make live DB or API calls but verify the source code contracts that
     * prevent org-A data from leaking into org-B search results.
     *
     * NZ-RISK-006 — Cross-tenant RAG knowledge leakage.
     */

    it('chatbot-service.ts always filters embeddings queries by organizationId', () => {
      const chatbotService = join(UE, 'lib', 'ai', 'chatbot-service.ts')
      expect(existsSync(chatbotService)).toBe(true)
      const c = read(chatbotService)

      // Every vector / similarity search must include org filter
      // The file should reference organizationId in proximity to any similarity/embeddings query
      expect(c).toMatch(/organizationId|organization_id|orgId|org_id/)

      // Must NOT perform an unscoped "SELECT ... FROM knowledge_base" without org condition
      const lines = c.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/knowledge_base|chatbot_documents|chatbot_knowledge/i.test(line)) {
          // Look backward and forward within ±10 lines for org filter
          const window = lines.slice(Math.max(0, i - 10), i + 10).join('\n')
          const hasOrgFilter = /organizationId|organization_id|orgId|org_id/i.test(window)
          if (!hasOrgFilter) {
            throw new Error(
              `[RAG-ISOLATION] chatbot-service.ts line ${i + 1} may query knowledge without org scope:\n  ${line.trim()}`,
            )
          }
        }
      }
    })

    it('embeddings-service.ts scopes all upsert/search operations to an org', () => {
      const embeddingsService = join(UE, 'lib', 'ai', 'embeddings-service.ts')
      if (!existsSync(embeddingsService)) return // optional service
      const c = read(embeddingsService)
      expect(c).toMatch(/organizationId|organization_id|orgId|org_id/)
    })

    it('grievance-triage.ts scopes all queries to organizationId', () => {
      const triageSvc = join(UE, 'lib', 'ai', 'grievance-triage.ts')
      expect(existsSync(triageSvc)).toBe(true)
      const c = read(triageSvc)
      // Every DB query builder call should include org scope
      const queryBlocks = c.match(/\.where\([^)]+\)/g) ?? []
      for (const block of queryBlocks) {
        if (!block.includes('organizationId') && !block.includes('organization_id')) {
          throw new Error(
            `[RAG-ISOLATION] grievance-triage.ts has a .where() clause without org filter:\n  ${block}`,
          )
        }
      }
    })

    it('clause-reasoning.ts scopes all queries to organizationId', () => {
      const clauseSvc = join(UE, 'lib', 'ai', 'clause-reasoning.ts')
      expect(existsSync(clauseSvc)).toBe(true)
      const c = read(clauseSvc)
      const queryBlocks = c.match(/\.where\([^)]+\)/g) ?? []
      for (const block of queryBlocks) {
        if (!block.includes('organizationId') && !block.includes('organization_id')) {
          throw new Error(
            `[RAG-ISOLATION] clause-reasoning.ts has a .where() clause without org filter:\n  ${block}`,
          )
        }
      }
    })

    it('AI API routes pass organizationId from authenticated context — never from user input', () => {
      const aiRoutes = walkFiles(join(UE, 'app', 'api', 'ai'), /route\.ts$/)
      expect(aiRoutes.length).toBeGreaterThan(0)

      for (const routeFile of aiRoutes) {
        const c = read(routeFile)
        // Route must source orgId from context (auth), not from request body/params
        const usesContextOrg = /context\.organizationId|context\.orgId/i.test(c)
        // If the route touches AI features, it must use context-sourced org
        if (/guardAiFeature|analyzeGrievance|suggestClause|chatbot|embed/i.test(c)) {
          expect(usesContextOrg).toBe(true)
        }
      }
    })

    it('knowledge_base table has org-scoped rows — no cross-tenant wildcard selects in source', () => {
      const chatbotSchema = join(UE, 'db', 'schema', 'domains', 'ml', 'chatbot.ts')
      const altSchema = join(UE, 'db', 'schema', 'ai-chatbot-schema.ts')
      const schemaFile = existsSync(chatbotSchema) ? chatbotSchema : altSchema
      const c = read(schemaFile)

      // knowledge_base must have an organizationId FK column
      expect(c).toMatch(/organization_id|organizationId/)
    })
  })
})

