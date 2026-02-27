/**
 * NO_RAW_DB_IN_ACTIONS_001 — "Server actions must not bypass org-scoped DB access"
 *
 * Enforces that server action files across all apps do not import
 * raw / unscoped database clients. Actions must use org-scoped patterns:
 *   - platformDb            from @nzila/db/platform
 *   - createScopedDb        from @nzila/db/scoped
 *   - createAuditedScopedDb from @nzila/db/scoped
 *   - withRLSContext         (union-eyes)
 *   - DAL query layers       (@/db/queries/*)
 *
 * This test closes a bypass vector that db-boundary.test.ts (INV-06)
 * allows through its EXEMPT_PATHS for whole apps. Actions are the
 * primary mutation surface and must always use org-scoped access.
 *
 * @invariant NO_RAW_DB_IN_ACTIONS_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  relPath,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * Directories containing server action files across the monorepo.
 * Each entry maps an app to its action directory.
 */
const ACTION_ROOTS: Array<{ app: string; dir: string }> = [
  { app: 'nacp-exams', dir: join(ROOT, 'apps', 'nacp-exams', 'lib', 'actions') },
  { app: 'zonga', dir: join(ROOT, 'apps', 'zonga', 'lib', 'actions') },
  { app: 'cfo', dir: join(ROOT, 'apps', 'cfo', 'lib', 'actions') },
  { app: 'partners', dir: join(ROOT, 'apps', 'partners', 'lib', 'actions') },
  { app: 'union-eyes', dir: join(ROOT, 'apps', 'union-eyes', 'actions') },
  { app: 'shop-quoter', dir: join(ROOT, 'apps', 'shop-quoter', 'lib') },
  { app: 'abr', dir: join(ROOT, 'apps', 'abr', 'lib', 'actions') },
]

/** Collect all *-actions.ts files under a directory (non-recursive). */
function listActionFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('-actions.ts'))
    .map((f) => join(dir, f))
}

// ── Dangerous patterns ──────────────────────────────────────────────────────

/**
 * Patterns that indicate raw / unscoped DB access in an action file.
 *
 * We intentionally do NOT flag:
 *   - Schema-only imports like `import { users } from '@nzila/db'`
 *     (the regex requires `\bdb\b` as a named import, not a table)
 *   - `@nzila/db/platform` (platformDb) — governed platform access
 *   - `@nzila/db/scoped` — createScopedDb / createAuditedScopedDb
 *   - `@nzila/db/schema` — schema-only re-exports
 *   - `@/db/queries/*` — DAL query layers
 *   - `withRLSContext` callers — already RLS-guarded
 */
const RAW_DB_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Unscoped db singleton from @nzila/db barrel
  {
    pattern: /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@nzila\/db['"]/,
    label: 'Unscoped db import from @nzila/db barrel — use platformDb or createScopedDb',
  },
  // Raw DB client
  {
    pattern: /from\s*['"]@nzila\/db\/raw['"]/,
    label: '@nzila/db/raw forbidden — use @nzila/db/platform or @nzila/db/scoped',
  },
  // Direct client module
  {
    pattern: /from\s*['"]@nzila\/db\/client['"]/,
    label: '@nzila/db/client forbidden — use @nzila/db/platform or @nzila/db/scoped',
  },
  // rawDb identifier alongside @nzila/db
  {
    pattern: /\brawDb\b/,
    label: 'rawDb access forbidden — use createScopedDb(entityId)',
  },
  // Direct drizzle() instantiation
  {
    pattern: /import\s+.*\bdrizzle\b.*from\s+['"]drizzle-orm\/(postgres-js|node-postgres|neon-http)['"]/,
    label: 'Direct drizzle() instantiation forbidden in action files',
  },
  // Raw postgres/pg driver
  {
    pattern: /import\s+.*from\s+['"](postgres|pg|@neondatabase\/serverless)['"]/,
    label: 'Raw database driver import forbidden in action files',
  },
  // Local unscoped db singleton (e.g. union-eyes @/db or @/db/db)
  // Only flag if the file does NOT use withRLSContext — that wrapper makes it safe
  {
    pattern: /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@\/db(?:\/db)?['"]/,
    label: 'Local @/db singleton bypasses org scoping — use withRLSContext or platformDb',
  },
]

/**
 * If a file imports withRLSContext (or its variants), local @/db access
 * is considered guarded. We skip the local-db-singleton check for those.
 */
const RLS_GUARD = /withRLSContext|withExplicitUserContext|withSystemContext/

// ── Tests ───────────────────────────────────────────────────────────────────

describe('NO_RAW_DB_IN_ACTIONS_001 — No raw DB access in server action files', () => {
  const allActionFiles = ACTION_ROOTS.flatMap(({ dir }) => listActionFiles(dir))

  it('discovers action files to scan', () => {
    expect(
      allActionFiles.length,
      'Expected to find server action files across apps',
    ).toBeGreaterThan(0)
  })

  it('no action file imports raw or unscoped DB clients', () => {
    const violations: Violation[] = []
    const exceptions = loadExceptions(
      'governance/exceptions/no-raw-db-in-actions.json',
    )

    for (const file of allActionFiles) {
      const rel = relPath(file)
      if (isExcepted(rel, exceptions.entries)) continue

      const content = readFileSync(file, 'utf-8')
      const hasRLSGuard = RLS_GUARD.test(content)

      for (const { pattern, label } of RAW_DB_PATTERNS) {
        // If the file uses withRLSContext, skip the local @/db singleton check
        if (hasRLSGuard && label.includes('Local @/db')) continue

        if (pattern.test(content)) {
          violations.push({
            ruleId: 'NO_RAW_DB_IN_ACTIONS_001',
            filePath: rel,
            offendingValue: label,
            remediation:
              'Migrate to platformDb (@nzila/db/platform), createScopedDb (@nzila/db/scoped), ' +
              'or withRLSContext. If migration is in progress, add an exception to ' +
              'governance/exceptions/no-raw-db-in-actions.json.',
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('no expired exceptions for NO_RAW_DB_IN_ACTIONS_001', () => {
    const exceptions = loadExceptions(
      'governance/exceptions/no-raw-db-in-actions.json',
    )
    expect(
      exceptions.expiredEntries,
      `${exceptions.expiredEntries.length} expired exception(s) — ` +
        'migrate the file or extend the deadline',
    ).toHaveLength(0)
  })
})
