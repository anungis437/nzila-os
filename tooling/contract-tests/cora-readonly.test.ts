/**
 * Contract Test — Cora Read-Only Enforcement
 *
 * Cora is a cooperative intelligence dashboard. It MUST be strictly read-only
 * with respect to operational/transactional data stores.
 *
 * Three invariants enforced:
 *
 * CORA_NO_ACTIONS_FOLDER_001 — No server actions directory may exist in Cora
 * CORA_NO_MUTATION_IMPORTS_002 — No write-capable repo/service imports from operational DB packages
 * CORA_NO_SQL_MUTATIONS_003 — No SQL mutation keywords (INSERT, UPDATE, DELETE) in app code
 *
 * @invariant CORA_NO_ACTIONS_FOLDER_001
 * @invariant CORA_NO_MUTATION_IMPORTS_002
 * @invariant CORA_NO_SQL_MUTATIONS_003
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const CORA_ROOT = join(ROOT, 'apps', 'cora')

// ── Helpers ────────────────────────────────────────────────────────────────

function walkSync(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx'],
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

// ── Allowlist: read-only imports permitted from operational packages ────────
//
// ONLY these import paths are permitted in Cora source code.
// All of these expose SELECT-only query functions or type definitions.
//
// Allowlist rationale:
//   - @nzila/agri-db/readonly — read-only repository wrappers (no tx, no mutations)
//   - @nzila/agri-db types — AgriReadContext, PaginationOpts, PaginatedResult
//   - @nzila/agri-intelligence — read-only intelligence aggregation queries
//   - @nzila/agri-traceability — read-only traceability queries
//   - @nzila/agri-adapters — external data adapters (fetch/pull only)
//   - @nzila/evidence — evidence verification (read/verify only, not create)
//   - @nzila/os-core — platform utilities (auth, telemetry, context)
//   - @nzila/db — only if importing types; direct db.insert/update/delete forbidden
//   - @nzila/agri-core — domain types only
//   - @nzila/ui — UI components
//
const ALLOWED_IMPORT_PATTERNS: RegExp[] = [
  // Readonly repo layer
  /from\s+['"]@nzila\/agri-db\/readonly['"]/,
  /from\s+['"]@nzila\/agri-db\/src\/readonly/,

  // Type-only imports from agri-db (AgriReadContext etc.)
  /import\s+type\s+\{[^}]*\}\s+from\s+['"]@nzila\/agri-db['"]/,

  // Intelligence (read-only analytics)
  /from\s+['"]@nzila\/agri-intelligence/,

  // Traceability (read-only)
  /from\s+['"]@nzila\/agri-traceability/,

  // Adapters (external data pull)
  /from\s+['"]@nzila\/agri-adapters/,

  // Evidence (verify/read only)
  /from\s+['"]@nzila\/evidence/,

  // OS Core (platform utilities)
  /from\s+['"]@nzila\/os-core/,

  // Agri core (domain types)
  /from\s+['"]@nzila\/agri-core/,

  // DB (type imports only — checked separately for mutation usage)
  /import\s+type\s+\{[^}]*\}\s+from\s+['"]@nzila\/db['"]/,

  // UI components
  /from\s+['"]@nzila\/ui/,
]

// These are write-capable imports that MUST NOT appear in Cora.
const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  // Direct mutable repo imports from agri-db (non-readonly barrel)
  /from\s+['"]@nzila\/agri-db['"](?!\/readonly)/,

  // Direct sub-path into mutable repositories
  /from\s+['"]@nzila\/agri-db\/src\/repositories\//,

  // Commerce DB (operational — Cora has no business importing commerce writes)
  /from\s+['"]@nzila\/commerce-db['"]/,

  // Trade DB
  /from\s+['"]@nzila\/trade-db['"]/,

  // Integrations DB (write-capable)
  /from\s+['"]@nzila\/integrations-db['"]/,
]

// ── CORA_NO_ACTIONS_FOLDER_001 ─────────────────────────────────────────────

describe('CORA_NO_ACTIONS_FOLDER_001 — No server actions folder in Cora', () => {
  it('apps/cora/lib/actions/ must NOT exist', () => {
    const actionsDir = join(CORA_ROOT, 'lib', 'actions')
    expect(
      existsSync(actionsDir),
      'Cora MUST be read-only. The directory apps/cora/lib/actions/ must not exist. ' +
        'Server actions imply mutations, which violate Cora\'s read-only contract.',
    ).toBe(false)
  })

  it('apps/cora/app/**/actions/ directories must NOT exist', () => {
    const appDir = join(CORA_ROOT, 'app')
    if (!existsSync(appDir)) return
    const allDirs: string[] = []
    const stack = [appDir]
    while (stack.length > 0) {
      const dir = stack.pop()!
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', '.next', '.turbo'].includes(entry.name)) continue
          if (entry.name === 'actions') allDirs.push(fullPath)
          stack.push(fullPath)
        }
      }
    }
    expect(
      allDirs.length,
      `Found action directories in Cora app: ${allDirs.map(relPath).join(', ')}`,
    ).toBe(0)
  })
})

// ── CORA_NO_MUTATION_IMPORTS_002 ───────────────────────────────────────────

describe('CORA_NO_MUTATION_IMPORTS_002 — No write-capable imports in Cora', () => {
  it('Cora source files must not import from write-capable repositories/services', () => {
    const sourceFiles = walkSync(CORA_ROOT)
    const violations: string[] = []

    for (const file of sourceFiles) {
      // Skip test files and fixture files
      const rel = relPath(file)
      if (rel.includes('__tests__') || rel.includes('.test.') || rel.includes('/fixtures/')) {
        continue
      }

      const content = readContent(file)
      if (!content) continue

      // Check type-only imports from agri-db are genuinely type-only
      const hasTypeOnlyAgriDb = /import\s+type\s+\{[^}]*\}\s+from\s+['"]@nzila\/agri-db['"]/.test(content)
      const hasValueAgriDb = /(?<!import\s+type\s+\{[^}]*\}\s+)from\s+['"]@nzila\/agri-db['"]/.test(content)

      // If the file has a value (non-type) import from agri-db barrel, that's forbidden
      if (hasValueAgriDb && !hasTypeOnlyAgriDb) {
        violations.push(
          `${rel}: imports value exports from @nzila/agri-db (use @nzila/agri-db/readonly instead)`,
        )
      }

      // Check all forbidden patterns
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          // But allow type-only imports from agri-db
          if (
            pattern.source.includes('agri-db') &&
            hasTypeOnlyAgriDb &&
            !hasValueAgriDb
          ) {
            continue
          }
          violations.push(`${rel}: matches forbidden import pattern ${pattern.source}`)
        }
      }
    }

    expect(
      violations,
      `Cora has write-capable import violations:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('documents the allowlist of permitted import paths', () => {
    // This test ensures the allowlist is maintained and non-empty.
    // If you need to add a new read-only import to Cora, add it to
    // ALLOWED_IMPORT_PATTERNS above and document the rationale.
    expect(ALLOWED_IMPORT_PATTERNS.length).toBeGreaterThan(0)
    expect(FORBIDDEN_IMPORT_PATTERNS.length).toBeGreaterThan(0)
  })
})

// ── CORA_NO_SQL_MUTATIONS_003 ──────────────────────────────────────────────

describe('CORA_NO_SQL_MUTATIONS_003 — No SQL mutation strings in Cora', () => {
  // Matches SQL DML mutation keywords (case-insensitive) in string literals,
  // template literals, or raw SQL-like content.
  const SQL_MUTATION_PATTERN =
    /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i

  it('no INSERT/UPDATE/DELETE SQL strings in Cora source (excluding tests/fixtures)', () => {
    const sourceFiles = walkSync(CORA_ROOT)
    const violations: string[] = []

    for (const file of sourceFiles) {
      const rel = relPath(file)
      // Exclude test files and fixtures
      if (
        rel.includes('__tests__') ||
        rel.includes('.test.') ||
        rel.includes('/fixtures/') ||
        rel.includes('/test/')
      ) {
        continue
      }

      const content = readContent(file)
      if (!content) continue

      // Check line by line for better error messages
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (SQL_MUTATION_PATTERN.test(line)) {
          // Exclude comments
          const trimmed = line.trim()
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue
          }
          violations.push(`${rel}:${i + 1}: ${trimmed.substring(0, 120)}`)
        }
      }
    }

    expect(
      violations,
      `Cora source contains SQL mutation keywords:\n${violations.join('\n')}\n\n` +
        'Cora is a read-only intelligence surface. All data mutations must happen ' +
        'in other apps/services, not in Cora.',
    ).toEqual([])
  })

  it('no "use server" directives in Cora (no server actions)', () => {
    const sourceFiles = walkSync(CORA_ROOT)
    const violations: string[] = []

    for (const file of sourceFiles) {
      const rel = relPath(file)
      if (rel.includes('__tests__') || rel.includes('.test.') || rel.includes('/fixtures/')) {
        continue
      }

      const content = readContent(file)
      if (content.includes("'use server'") || content.includes('"use server"')) {
        violations.push(rel)
      }
    }

    expect(
      violations,
      `Cora source files contain "use server" directives:\n${violations.join('\n')}\n\n` +
        'Server actions are mutation entry points. Cora must remain read-only.',
    ).toEqual([])
  })
})
