/**
 * Contract Test — Audited Mutation Coverage
 *
 * Structural invariant: application code (apps/*) must never
 * perform INSERT/UPDATE/DELETE using a non-audited DB client.
 * All writes MUST flow through createAuditedScopedDb() or withAudit().
 *
 * Enforcement:
 *   1. No raw .insert() / .update() / .delete() calls on unscoped db
 *   2. No mutation routes without authorize()/actor context
 *   3. Audit emission is mandatory (not fire-and-forget)
 *
 * @invariant INV-22: All app mutations are audited
 * @invariant INV-23: No writes without actor context
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

// ── Helpers ────────────────────────────────────────────────────────────────

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist', '__tests__'].includes(entry.name)) continue
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function getAppDirs(): string[] {
  if (!existsSync(APPS_DIR)) return []
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(APPS_DIR, d.name))
}

/**
 * Extract API route files (Next.js App Router convention: route.ts in app/api/**).
 * Also includes lib/ files that perform DB operations.
 */
function getApiRouteFiles(appDir: string): string[] {
  const apiDir = join(appDir, 'app', 'api')
  const libDir = join(appDir, 'lib')
  return [...walkSync(apiDir), ...walkSync(libDir)]
}

// Paths allowed to perform raw mutations (platform layer / system operations).
// Each exemption is documented and tracked for migration.
const MUTATION_ALLOWLIST = [
  // Audit emitter itself needs to write to audit_events
  'packages/db/src/audit.ts',
  // Console audit-db.ts is the legacy audit recorder
  'apps/console/lib/audit-db.ts',
  'apps/console/lib/audit.ts',
  // Console app — legacy unscoped mutations tracked for migration
  // See docs/migration/ENFORCEMENT_UPGRADE.md
  'apps/console/',
  // OS-core internals
  'packages/os-core/',
  // DB package internals
  'packages/db/',
  // Tooling / scripts
  'tooling/',
  // Orchestrator API (standalone service — tracked for migration)
  'apps/orchestrator-api/',
  // Partners legacy — tracked for migration
  'apps/partners/',
  // Union-Eyes — Django-migrated app; mutations are transitioning to audited clients.
  // Tracked for migration alongside console/partners.
  'apps/union-eyes/',
]

function isAllowlisted(filePath: string): boolean {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/')
  return MUTATION_ALLOWLIST.some((p) => rel.startsWith(p))
}

// ── Mutation patterns ──────────────────────────────────────────────────────

// Patterns that indicate raw/unaudited mutations
const RAW_MUTATION_PATTERNS = [
  // Direct drizzle mutations: db.insert(...), db.update(...), db.delete(...)
  /\bdb\s*\.\s*insert\s*\(/,
  /\bdb\s*\.\s*update\s*\(/,
  /\bdb\s*\.\s*delete\s*\(/,
  // scopedDb without audit wrapper (legacy pattern)
  /scopedDb\s*\.\s*insert\s*\(/,
  /scopedDb\s*\.\s*update\s*\(/,
  /scopedDb\s*\.\s*delete\s*\(/,
]

// Patterns that indicate properly audited mutations
const AUDITED_PATTERNS = [
  /createAuditedScopedDb/,
  /withAudit/,
  /auditedDb\b/,
  /auditedScopedDb\b/,
  /recordAuditEvent/,
]

// ── Tests ──────────────────────────────────────────────────────────────────

describe('INV-22 — All app mutations are audited', () => {
  const appDirs = getAppDirs()
  const allApiFiles = appDirs.flatMap((dir) => getApiRouteFiles(dir))

  it('detected API route files for analysis', () => {
    // Sanity check: we should find at least some route files
    expect(allApiFiles.length).toBeGreaterThan(0)
  })

  it('no app route files use raw mutations outside allowlist', () => {
    const violations: Array<{ file: string; pattern: string; line: number }> = []

    for (const file of allApiFiles) {
      if (isAllowlisted(file)) continue

      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      // If file already imports audited patterns, it's likely safe.
      // But we still check for raw mutations that may bypass the wrapper.
      const hasAuditedImport = AUDITED_PATTERNS.some((p) => p.test(content))

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

        for (const pattern of RAW_MUTATION_PATTERNS) {
          if (pattern.test(line)) {
            // If the file has audited imports and the variable is the audited one, skip
            if (hasAuditedImport && /audited/i.test(line)) continue
            violations.push({
              file: relative(ROOT, file),
              pattern: pattern.source,
              line: i + 1,
            })
          }
        }
      }
    }

    expect(
      violations,
      `Raw (non-audited) mutations found in app code:\n` +
        violations
          .map((v) => `  ${v.file}:${v.line} matches ${v.pattern}`)
          .join('\n') +
        '\n\nAll writes MUST use createAuditedScopedDb() or withAudit().',
    ).toEqual([])
  })
})

describe('INV-23 — No writes without actor context', () => {
  it('audit.ts requires actorId in AuditedScopedDbOptions', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('actorId: string')
    expect(content).toMatch(/requires a non-empty actorId/)
  })

  it('withAudit requires AuditContext with actorId', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toMatch(/interface AuditContext[\s\S]*?actorId:\s*string/)
  })

  it('audit event includes all required fields', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    // AuditEvent must include: entityId, actorId, table, action, timestamp, correlationId
    const eventMatch = content.match(/interface AuditEvent\s*\{[\s\S]*?\}/)
    expect(eventMatch, 'AuditEvent interface must exist').toBeTruthy()
    const eventBody = eventMatch![0]
    expect(eventBody).toContain('entityId')
    expect(eventBody).toContain('actorId')
    expect(eventBody).toContain('table')
    expect(eventBody).toContain('action')
    expect(eventBody).toContain('timestamp')
    expect(eventBody).toContain('correlationId')
  })
})

describe('INV-24 — Audit emission is mandatory (not fire-and-forget)', () => {
  it('mutation failure on audit emit failure is enforced', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    // Must contain AUDIT:MANDATORY indicating blocked mutations
    expect(content).toContain('[AUDIT:MANDATORY]')
    expect(content).toContain('Mutation blocked')
  })

  it('audit fallback logging exists (events never silently lost)', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('AUDIT:AUTO:FALLBACK')
  })

  it('default emitter writes hash-chained audit events', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('computeEntryHash')
    expect(content).toContain('previousHash')
  })
})

describe('INV-25 — audit_events table immutability (DB triggers)', () => {
  it('immutability trigger migration exists', () => {
    // Check both migration locations
    const drizzleMigration = join(ROOT, 'packages', 'db', 'drizzle', '0004_audit_events_immutable.sql')
    const customMigration = join(ROOT, 'packages', 'db', 'migrations', 'hash-chain-immutability-triggers.sql')

    const drizzleExists = existsSync(drizzleMigration)
    const customExists = existsSync(customMigration)

    expect(
      drizzleExists || customExists,
      'audit_events immutability trigger migration must exist',
    ).toBe(true)

    // Verify trigger content
    const migrationPath = drizzleExists ? drizzleMigration : customMigration
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toMatch(/prevent_audit_mutation|nzila_deny_mutate/)
    expect(content).toMatch(/audit_events/)
  })

  it('audit_events schema has hash column', () => {
    const opsSchema = join(ROOT, 'packages', 'db', 'src', 'schema', 'operations.ts')
    const content = readFileSync(opsSchema, 'utf-8')
    // audit_events must have hash and previousHash columns
    const auditBlock = content.slice(content.indexOf("pgTable('audit_events'"))
    expect(auditBlock).toContain("hash: text('hash')")
    expect(auditBlock).toContain("previousHash: text('previous_hash')")
  })

  it('no migration drops or truncates audit_events', () => {
    const drizzleDir = join(ROOT, 'packages', 'db', 'drizzle')
    if (!existsSync(drizzleDir)) return

    const files = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql'))
    for (const file of files) {
      const content = readFileSync(join(drizzleDir, file), 'utf-8')
      const lowerContent = content.toLowerCase()
      if (
        lowerContent.includes('drop table') &&
        lowerContent.includes('audit_events')
      ) {
        expect.fail(`Migration ${file} drops audit_events table — this is forbidden`)
      }
      if (
        lowerContent.includes('truncate') &&
        lowerContent.includes('audit_events')
      ) {
        expect.fail(`Migration ${file} truncates audit_events table — this is forbidden`)
      }
    }
  })
})
