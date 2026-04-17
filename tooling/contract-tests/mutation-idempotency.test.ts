/**
 * Contract tests - Mutation Idempotency Required
 *
 * Enforces that every mutation API route handler under apps/{app}/app/api
 * is covered by idempotency enforcement - either via:
 *   a) The app's middleware.ts (intercepts all requests before routing), or
 *   b) The route file itself (direct guard call), or
 *   c) An explicit governance exception.
 *
 * Mutation routes = route.ts files exporting POST, PUT, PATCH, or DELETE.
 *
 * @invariant MUTATION_IDEMPOTENCY_REQUIRED_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { minimatch } from 'minimatch'

const ROOT = join(__dirname, '..', '..')

// -- Helpers ------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'build',
  'coverage',
  '.git',
  '__fixtures__',
])

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function readContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch (_err) {
    return ''
  }
}

function relPath(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, '/')
}

/** Known app directories */
function getAppDirs(): string[] {
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) return []
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name))
    .map((d) => d.name)
}

/** Check if a route file exports a mutation handler */
function exportsMutationHandler(content: string): boolean {
  return (
    /export\s+(async\s+)?function\s+POST\b/.test(content) ||
    /export\s+(async\s+)?function\s+PUT\b/.test(content) ||
    /export\s+(async\s+)?function\s+PATCH\b/.test(content) ||
    /export\s+(async\s+)?function\s+DELETE\b/.test(content) ||
    /export\s+const\s+POST\b/.test(content) ||
    /export\s+const\s+PUT\b/.test(content) ||
    /export\s+const\s+PATCH\b/.test(content) ||
    /export\s+const\s+DELETE\b/.test(content)
  )
}

/** Which mutation methods does a route export? */
function exportedMutationMethods(content: string): string[] {
  const methods: string[] = []
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const pattern = new RegExp(
      `export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`,
    )
    if (pattern.test(content)) methods.push(m)
  }
  return methods
}

/**
 * Check if a file contains genuine idempotency enforcement.
 *
 * We require one of:
 *   1. An actual function call — `checkIdempotency(`, `requireIdempotencyKey(`,
 *      or `resolveIdempotentReplay(`.
 *   2. An import statement pulling from `@nzila/os-core/idempotency`.
 *   3. Inline enforcement that emits the `IDEMPOTENCY_KEY_REQUIRED` error code
 *      as a string literal (used by middleware / Fastify hooks).
 *
 * Loose substring checks (e.g. `content.includes('idempotency')`) are
 * explicitly rejected — a code comment could satisfy those.
 */
const IDEMPOTENCY_CALL_PATTERNS = [
  /checkIdempotency\s*\(/,
  /requireIdempotencyKey\s*\(/,
  /resolveIdempotentReplay\s*\(/,
  /isMutationApiRoute\s*\(/,
]

const IDEMPOTENCY_IMPORT_PATTERN =
  /(?:import|require)\s*\(?.*['"]@nzila\/os-core\/idempotency['"]/

/** Inline enforcement emits this error code as a string literal */
const IDEMPOTENCY_INLINE_PATTERN = /['"]IDEMPOTENCY_KEY_REQUIRED['"]/

function hasIdempotencyEnforcement(content: string): boolean {
  if (IDEMPOTENCY_IMPORT_PATTERN.test(content)) return true
  if (IDEMPOTENCY_CALL_PATTERNS.some((p) => p.test(content))) return true
  if (IDEMPOTENCY_INLINE_PATTERN.test(content)) return true
  return false
}

// -- Exclusions ---------------------------------------------------------------

/** Routes that are legitimately exempt from idempotency enforcement */
const EXEMPT_PATTERNS = [
  // Webhook receivers use their own dedup (provider-level idempotency)
  '**/api/webhooks/**',
  // Health / status endpoints are GET-only by convention
  '**/api/health/**',
  // Cron endpoints are idempotent by definition (system-triggered)
  '**/api/cron/**',
]

function isExempt(routeRelPath: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => minimatch(routeRelPath, pattern))
}

/** Load governance exception globs (if any) */
function loadIdempotencyExceptions(): string[] {
  const exPath = join(ROOT, 'governance', 'exceptions', 'mutation-idempotency.json')
  if (!existsSync(exPath)) return []
  try {
    const data = JSON.parse(readFileSync(exPath, 'utf-8'))
    if (Array.isArray(data)) {
      return data
        .filter((e: { expiresOn?: string }) => !e.expiresOn || new Date(e.expiresOn) > new Date())
        .map((e: { path: string }) => e.path)
    }
  } catch { /* empty */ }
  return []
}

function isGovernanceExcepted(routeRelPath: string, exceptions: string[]): boolean {
  return exceptions.some((pattern) => minimatch(routeRelPath, pattern))
}

// -- Tests --------------------------------------------------------------------

describe('MUTATION_IDEMPOTENCY_REQUIRED_001 - Universal Idempotency Enforcement', () => {
  // 1. The idempotency module must exist
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: @nzila/os-core exports idempotency module', () => {
    const idempotencyModule = readContent('packages/os-core/src/idempotency.ts')
    expect(idempotencyModule).toBeTruthy()

    expect(
      idempotencyModule.includes('checkIdempotency'),
      'idempotency.ts must export checkIdempotency function',
    ).toBe(true)

    expect(
      idempotencyModule.includes('IdempotencyCache'),
      'idempotency.ts must export IdempotencyCache interface',
    ).toBe(true)

    expect(
      idempotencyModule.includes('InMemoryIdempotencyCache'),
      'idempotency.ts must export InMemoryIdempotencyCache implementation',
    ).toBe(true)
  })

  // 2. The package.json must expose the idempotency subpath
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: os-core package.json exports ./idempotency', () => {
    const pkg = readContent('packages/os-core/package.json')
    expect(pkg).toBeTruthy()

    const parsed = JSON.parse(pkg)
    expect(parsed.exports?.['./idempotency']).toBeDefined()
  })

  // 3. Every mutation route file must be covered — either by middleware or route-level guard.
  //    This test walks every route.ts under apps/*/app/api, finds mutation exports,
  //    and verifies that the app's middleware.ts or the route file itself has idempotency.
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: every mutation route is covered by idempotency enforcement', { timeout: 60_000 }, () => {
    const apps = getAppDirs()
    expect(apps.length).toBeGreaterThan(0)

    const exceptions = loadIdempotencyExceptions()

    interface Violation {
      route: string
      methods: string[]
      reason: string
    }
    const violations: Violation[] = []

    for (const app of apps) {
      const apiDir = join(ROOT, 'apps', app, 'app', 'api')
      if (!existsSync(apiDir)) continue

      // Check proxy at the app level (proxy.ts replaces middleware.ts)
      const middlewarePath = join(ROOT, 'apps', app, 'proxy.ts')
      const middlewareContent = existsSync(middlewarePath)
        ? readFileSync(middlewarePath, 'utf-8')
        : ''
      const middlewareCovers = hasIdempotencyEnforcement(middlewareContent)

      // Walk every route.ts
      const routeFiles = walkSync(apiDir).filter((f) => f.endsWith('route.ts'))

      for (const routeFile of routeFiles) {
        const content = readContent(routeFile)
        const methods = exportedMutationMethods(content)
        if (methods.length === 0) continue

        const rel = relPath(routeFile)

        // Check exemption patterns
        if (isExempt(rel)) continue
        if (isGovernanceExcepted(rel, exceptions)) continue

        // Route is covered if middleware has idempotency OR the route itself does
        if (middlewareCovers) continue
        if (hasIdempotencyEnforcement(content)) continue

        violations.push({
          route: rel,
          methods,
          reason: `No idempotency enforcement found in proxy.ts or route file`,
        })
      }
    }

    expect(
      violations,
      `Mutation routes missing idempotency enforcement:\n\n` +
        violations
          .map((v) => `  ${v.route} [${v.methods.join(', ')}]\n    → ${v.reason}`)
          .join('\n') +
        `\n\nFix: Add idempotency enforcement in the app's proxy.ts or the route handler.\n` +
        `Exempt: Add to governance/exceptions/mutation-idempotency.json if legitimately exempt.`,
    ).toEqual([])
  })

  // 3b. Orchestrator-API (Fastify) must enforce idempotency in its server hooks
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: orchestrator-api enforces idempotency', () => {
    const serverFile = readContent(join(ROOT, 'apps', 'orchestrator-api', 'src', 'index.ts'))
    expect(serverFile).toBeTruthy()

    expect(
      hasIdempotencyEnforcement(serverFile),
      'orchestrator-api server must enforce Idempotency-Key for mutation requests',
    ).toBe(true)
  })

  // 4. Idempotency enforcement must be org-scoped
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: idempotency uses org-scoped cache keys', () => {
    const idempotencyModule = readContent('packages/os-core/src/idempotency.ts')
    expect(idempotencyModule).toBeTruthy()

    expect(
      idempotencyModule.includes('orgId'),
      'idempotency module must key by orgId for org-scoped isolation',
    ).toBe(true)

    expect(
      idempotencyModule.includes('buildCacheKey'),
      'idempotency module must export buildCacheKey with org scoping',
    ).toBe(true)
  })

  // 5. Strict mode (fail-closed) detection
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: idempotency module supports strict mode for prod', () => {
    const idempotencyModule = readContent('packages/os-core/src/idempotency.ts')
    expect(idempotencyModule).toBeTruthy()

    expect(
      idempotencyModule.includes('isStrictEnvironment') || idempotencyModule.includes('strict'),
      'idempotency module must support strict/fail-closed enforcement for pilot/prod',
    ).toBe(true)
  })

  // 6. Barrel export wires idempotency
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: os-core barrel exports idempotency', () => {
    const index = readContent(join(ROOT, 'packages', 'os-core', 'src', 'index.ts'))
    expect(index).toBeTruthy()

    expect(
      index.includes('idempotency'),
      'os-core index.ts must re-export from idempotency module',
    ).toBe(true)
  })

  // 7. High-level helpers exist (requireIdempotencyKey, recordIdempotentResponse, resolveIdempotentReplay)
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: idempotency exports high-level helpers', () => {
    const mod = readContent(join(ROOT, 'packages', 'os-core', 'src', 'idempotency.ts'))
    expect(mod).toBeTruthy()

    for (const fn of ['requireIdempotencyKey', 'recordIdempotentResponse', 'resolveIdempotentReplay']) {
      expect(
        mod.includes(fn),
        `idempotency.ts must export ${fn}`,
      ).toBe(true)
    }
  })

  // 8. Prod-ready cache adapter (DB-backed) must exist for multi-instance deploys
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: PostgresIdempotencyCache adapter exists', () => {
    const mod = readContent(join(ROOT, 'packages', 'os-core', 'src', 'idempotency.ts'))
    expect(mod).toBeTruthy()

    expect(
      mod.includes('PostgresIdempotencyCache'),
      'idempotency.ts must export PostgresIdempotencyCache for multi-instance production use',
    ).toBe(true)
  })

  // 9. DB schema for idempotency cache table must exist
  it('MUTATION_IDEMPOTENCY_REQUIRED_001: idempotency cache table in platform schema', () => {
    const schema = readContent(join(ROOT, 'packages', 'db', 'src', 'schema', 'platform.ts'))
    expect(schema).toBeTruthy()

    expect(
      schema.includes('idempotency_cache'),
      'platform schema must define idempotency_cache table',
    ).toBe(true)
  })

  // 10. Release attestation must use step-level outcome detection
  it('RELEASE_ATTESTATION_CORRECTNESS_001: deploy workflows use step-id based outcome detection', () => {
    const workflowDir = join(ROOT, '.github', 'workflows')
    if (!existsSync(workflowDir)) {
      expect.fail('.github/workflows directory must exist')
    }

    const deployWorkflows = readdirSync(workflowDir)
      .filter((f) => f.startsWith('deploy-') && f.endsWith('.yml'))

    expect(deployWorkflows.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const wf of deployWorkflows) {
      const content = readContent(`.github/workflows/${wf}`)

      // Must have step IDs for contract_tests and slo_gate
      if (!content.includes('id: contract_tests')) {
        violations.push(`${wf}: missing step id "contract_tests"`)
      }
      if (!content.includes('id: slo_gate')) {
        violations.push(`${wf}: missing step id "slo_gate"`)
      }

      // Must NOT use broken steps.*.outcome pattern
      if (content.includes('steps.*.outcome')) {
        violations.push(`${wf}: uses broken steps.*.outcome glob (must use explicit step refs)`)
      }
    }

    expect(
      violations,
      `Deploy workflow attestation issues:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})
