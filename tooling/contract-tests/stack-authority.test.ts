/**
 * STACK_AUTHORITY_001 — "Django-authoritative apps must not mutate via Drizzle directly"
 *
 * Enforces the Stack Authority Rules (docs/architecture/STACK_AUTHORITY.md):
 *
 * 1. Django-authoritative apps (union-eyes, abr): TS layer MUST NOT contain
 *    direct Drizzle mutations (db.insert, db.update, db.delete) unless:
 *    - The mutation goes through `withRLSContext` (audited org-scoped)
 *    - The mutation uses a transaction argument (`tx.insert`, `tx.update`, `tx.delete`)
 *    - The file is listed in governance/exceptions/stack-authority.json
 *
 * 2. TS-authoritative apps MUST NOT introduce a Django backend
 *    (no `django-proxy.ts`, no Python `manage.py`, no `backend/` directory)
 *
 * 3. No app may introduce a new Django backend without updating
 *    docs/architecture/STACK_AUTHORITY.md
 *
 * @invariant STACK_AUTHORITY_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  ROOT,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * Apps where Django is the authoritative data layer.
 * The TS layer in these apps MUST NOT perform direct Drizzle mutations.
 */
const DJANGO_AUTHORITATIVE_APPS = ['union-eyes', 'abr']

/**
 * Apps where TS/Drizzle is the authoritative data layer.
 * These apps MUST NOT have a Django backend.
 */
const TS_AUTHORITATIVE_APPS = [
  'console',
  'cfo',
  'cora',
  'partners',
  'pondu',
  'nacp-exams',
  'trade',
  'zonga',
  'shop-quoter',
  'web',
  'orchestrator-api',
]

/**
 * Patterns that indicate a direct Drizzle mutation (not a read).
 * We look for `.insert(`, `.update(`, `.delete(` preceded by `db.` or on
 * a drizzle table chain (e.g. `db.insert(tableName)`).
 */
const DRIZZLE_MUTATION_PATTERNS = [
  /\bdb\s*\.\s*insert\s*\(/,
  /\bdb\s*\.\s*update\s*\(/,
  /\bdb\s*\.\s*delete\s*\(/,
]

/**
 * Patterns that indicate a safe mutation context (transaction param, RLS wrapper).
 * If a line matches a mutation AND also matches a safe context, it's not a violation.
 */
const SAFE_MUTATION_CONTEXTS = [
  'withRLSContext',
  'createAuditedScopedDb',
  'createScopedDb',
]

/** Directories to skip during recursive walk */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  '__pycache__',
  '.venv',
  'backend',
  'coverage',
  '.git',
])

/** File patterns indicating a Django backend presence */
const DJANGO_MARKER_FILES = ['manage.py', 'django-proxy.ts']

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkTsFiles(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      results.push(...walkTsFiles(fullPath))
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Check if a file contains direct Drizzle mutations that are NOT inside
 * a safe context (withRLSContext, createAuditedScopedDb, etc.)
 *
 * Returns array of lines with violations.
 */
function findDirectMutations(
  content: string,
): { line: number; text: string }[] {
  const violations: { line: number; text: string }[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Check if line has a direct db mutation
    const hasMutation = DRIZZLE_MUTATION_PATTERNS.some((p) => p.test(line))
    if (!hasMutation) continue

    // Check surrounding context (50 lines before) for safe wrappers
    // If the function is inside a withRLSContext callback or uses
    // createAuditedScopedDb, it's safe
    const contextWindow = lines.slice(Math.max(0, i - 50), i + 1).join('\n')
    const isSafe = SAFE_MUTATION_CONTEXTS.some((ctx) =>
      contextWindow.includes(ctx),
    )
    if (isSafe) continue

    violations.push({ line: i + 1, text: line.trim().slice(0, 120) })
  }
  return violations
}

// ── STACK_AUTHORITY_001 ─────────────────────────────────────────────────────

describe('STACK_AUTHORITY_001 — Stack authority enforcement', () => {
  const exceptionFile = loadExceptions(
    'governance/exceptions/stack-authority.json',
  )

  it('Django-authoritative apps must not contain direct Drizzle mutations in app-layer TS files', () => {
    const violations: Violation[] = []

    /**
     * Only scan app-layer directories — NOT the DB abstraction layer.
     * The DB layer (lib/db/, db/, queries/) is expected to have mutations.
     * App-layer = actions, API routes, pages, components.
     */
    const APP_LAYER_DIRS = ['actions', 'app']

    for (const app of DJANGO_AUTHORITATIVE_APPS) {
      const appDir = join(ROOT, 'apps', app)
      if (!existsSync(appDir)) continue

      const tsFiles: string[] = []
      for (const layerDir of APP_LAYER_DIRS) {
        const dir = join(appDir, layerDir)
        if (existsSync(dir)) {
          tsFiles.push(...walkTsFiles(dir))
        }
      }

      for (const file of tsFiles) {
        const rel = relative(ROOT, file).split(sep).join('/')

        // Skip excepted files
        if (isExcepted(rel, exceptionFile.entries)) continue

        // Skip test files, type-only files, config
        if (rel.includes('.test.') || rel.includes('.spec.')) continue
        if (rel.endsWith('.d.ts') || rel.endsWith('.config.ts')) continue

        // Skip DB abstraction directories within app/
        if (rel.includes('/db/') || rel.includes('/queries/')) continue

        const content = readFileSync(file, 'utf-8')
        const mutationLines = findDirectMutations(content)

        for (const mut of mutationLines) {
          violations.push({
            ruleId: 'STACK_AUTHORITY_001',
            filePath: rel,
            line: mut.line,
            snippet: mut.text,
            offendingValue:
              'Direct Drizzle mutation in Django-authoritative app',
            remediation:
              'Route mutations through djangoProxy(), withRLSContext(), or createAuditedScopedDb(). ' +
              'If this is a legitimate exception, add to governance/exceptions/stack-authority.json',
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('TS-authoritative apps must not introduce a Django backend', () => {
    const violations: Violation[] = []

    for (const app of TS_AUTHORITATIVE_APPS) {
      const appDir = join(ROOT, 'apps', app)
      if (!existsSync(appDir)) continue

      // Check for Django marker files
      for (const marker of DJANGO_MARKER_FILES) {
        const markerPath = join(appDir, marker)
        if (existsSync(markerPath)) {
          violations.push({
            ruleId: 'STACK_AUTHORITY_001',
            filePath: `apps/${app}/${marker}`,
            offendingValue: `Django marker file "${marker}" found in TS-authoritative app`,
            remediation:
              'TS-authoritative apps must not have a Django backend. ' +
              'If this app needs Django, update docs/architecture/STACK_AUTHORITY.md first.',
          })
        }
      }

      // Check for backend/ directory with manage.py
      const backendDir = join(appDir, 'backend')
      if (existsSync(backendDir)) {
        const backendManage = join(backendDir, 'manage.py')
        if (existsSync(backendManage)) {
          violations.push({
            ruleId: 'STACK_AUTHORITY_001',
            filePath: `apps/${app}/backend/manage.py`,
            offendingValue:
              'Django backend/ directory found in TS-authoritative app',
            remediation:
              'TS-authoritative apps must not have a Django backend. ' +
              'If this app needs Django, update docs/architecture/STACK_AUTHORITY.md first.',
          })
        }
      }

      // Check for lib/django-proxy.ts
      const proxyPath = join(appDir, 'lib', 'django-proxy.ts')
      if (existsSync(proxyPath)) {
        violations.push({
          ruleId: 'STACK_AUTHORITY_001',
          filePath: `apps/${app}/lib/django-proxy.ts`,
          offendingValue:
            'Django proxy file found in TS-authoritative app',
          remediation:
            'TS-authoritative apps must not proxy to Django. ' +
            'If this app needs Django, update docs/architecture/STACK_AUTHORITY.md first.',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('all apps are classified in the Stack Authority matrix', () => {
    const appsDir = join(ROOT, 'apps')
    if (!existsSync(appsDir)) return

    const allApps = readdirSync(appsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    const classified = new Set([
      ...DJANGO_AUTHORITATIVE_APPS,
      ...TS_AUTHORITATIVE_APPS,
    ])

    const unclassified = allApps.filter((app) => !classified.has(app))

    expect(
      unclassified,
      `Unclassified apps found: ${unclassified.join(', ')}. ` +
        'Add them to DJANGO_AUTHORITATIVE_APPS or TS_AUTHORITATIVE_APPS ' +
        'in stack-authority.test.ts and update docs/architecture/STACK_AUTHORITY.md',
    ).toHaveLength(0)
  })

  it('no expired exceptions for STACK_AUTHORITY_001', () => {
    expect(
      exceptionFile.expiredEntries,
      `${exceptionFile.expiredEntries.length} expired exception(s) in stack-authority.json`,
    ).toHaveLength(0)
  })
})
