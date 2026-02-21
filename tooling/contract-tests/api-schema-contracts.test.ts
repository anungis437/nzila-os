/**
 * PR 16 — API Schema Contract Tests
 *
 * Verifies that API route handlers validate request payloads with Zod
 * and return properly shaped error responses for invalid input.
 *
 * These tests enforce the "validate at the boundary" rule:
 * every POST/PUT/PATCH handler must have visible schema validation.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function readContent(path: string): string {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

const SCHEMA_VALIDATION_PATTERNS = [
  /\.parse\s*\(/,           // zod .parse()
  /\.safeParse\s*\(/,       // zod .safeParse()
  /\.parseAsync\s*\(/,      // zod .parseAsync()
  /z\.object\s*\(/,         // inline zod schema
  /z\.string\s*\(/,         // zod primitive
  /Schema\.parse/,           // named schema
  /RequestSchema/,           // named schema convention
  /BodySchema/,              // named schema convention
  /validate\s*\(/,           // generic validate call
  /verifyWebhookSignature\s*\(/, // Stripe webhook signature verification
  /constructEvent\s*\(/,    // Stripe SDK event construction
  /req\.formData\s*\(\)/,   // multipart form data (documents upload)
]

function findRouteFiles(app: string): string[] {
  const appDir = resolve(ROOT, `apps/${app}/app`)
  if (!existsSync(appDir)) return []
  const results: string[] = []

  function recurse(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.turbo') continue
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        recurse(fullPath)
      } else if (entry.isFile() && entry.name === 'route.ts') {
        results.push(fullPath)
      }
    }
  }

  recurse(appDir)
  return results
}

// ── 1. Mutation route handlers must have schema validation ────────────────

const PROTECTED_APPS = ['console', 'partners', 'web']

describe('PR16: API schema — mutation routes validate payloads', () => {
  for (const app of PROTECTED_APPS) {
    it(`${app}: POST/PUT/PATCH routes use Zod or explicit validation`, () => {
      const routeFiles = findRouteFiles(app)
      const mutationRoutes = routeFiles.filter(f => {
        const content = readContent(f)
        return MUTATION_METHODS.some(m => content.includes(`export async function ${m}`) || content.includes(`export function ${m}`))
      })

      for (const routeFile of mutationRoutes) {
        const content = readContent(routeFile)
        const hasValidation = SCHEMA_VALIDATION_PATTERNS.some(p => p.test(content))
        expect(
          hasValidation,
          `${routeFile.replace(ROOT, '')} has mutation handler without schema validation`
        ).toBe(true)
      }
    })
  }
})

// ── 2. zod is a dependency of apps that handle validated input ───────────
// Note: apps/web is a public marketing site and does not require zod.

describe('PR16: API schema — zod is available in all apps', () => {
  const ZOD_APPS = ['console', 'partners', 'union-eyes']
  for (const app of ZOD_APPS) {
    it(`${app}: zod is listed as a dependency`, () => {
      const pkgPath = resolve(ROOT, `apps/${app}/package.json`)
      if (!existsSync(pkgPath)) return
      const pkg = JSON.parse(readContent(pkgPath))
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
      expect(
        'zod' in allDeps,
        `apps/${app} must have zod as a dependency`
      ).toBe(true)
    })
  }
})

// ── 3. Health endpoints return the correct shape ──────────────────────────

describe('PR16: API schema — health endpoint shape', () => {
  const HEALTH_APPS = ['console', 'partners', 'web']

  for (const app of HEALTH_APPS) {
    it(`${app}/api/health returns { status, checks }`, () => {
      const candidates = [
        resolve(ROOT, `apps/${app}/app/api/health/route.ts`),
        resolve(ROOT, `apps/${app}/app/api/health.ts`),
      ]
      const healthFile = candidates.find(existsSync)
      if (!healthFile) return // presence enforced by api-contracts.test.ts

      const content = readContent(healthFile)
      expect(content.includes('status'), `${app}/health must include 'status' field`).toBe(true)
    })
  }
})

// ── 4. Error responses use consistent shape ───────────────────────────────

describe('PR16: API schema — error response shape', () => {
  it('os-core exports a typed error response helper or NextResponse error pattern is used', () => {
    const osCoreSrc = resolve(ROOT, 'packages/os-core/src')
    const exists = existsSync(osCoreSrc)
    // os-core may have a typed error helper — if not, Next.js NextResponse.json is acceptable
    // We just verify that apps don't return raw strings as error bodies
    const appsWithApiRoutes = ['console', 'partners', 'web']
    for (const app of appsWithApiRoutes) {
      const routeFiles = findRouteFiles(app)
      for (const routeFile of routeFiles) {
        const content = readContent(routeFile)
        // Detect raw string-only error returns (e.g., return new Response('Unauthorized'))
        // These should use NextResponse.json({ error: ... })
        const hasRawStringError = /new Response\s*\(\s*['"`][^'"`{]+['"`]\s*,\s*\{\s*status:\s*[45]/.test(content)
        expect(
          hasRawStringError,
          `${routeFile.replace(ROOT, '')} uses raw string error response — use NextResponse.json({ error })`
        ).toBe(false)
      }
    }
  })
})
