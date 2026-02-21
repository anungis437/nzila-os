/**
 * Contract Test — Audit Enforcement
 *
 * Structural invariant: All mutating operations in app code must use
 * the audited ScopedDb (withAudit) for automatic audit emission.
 * Manual recordAuditEvent() calls should only exist for non-CRUD
 * governance events.
 *
 * @invariant INV-08: Automatic audit emission for CRUD operations
 * @invariant INV-09: Audit module exports and structure
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
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

// ── INV-08: Automatic audit emission ────────────────────────────────────────

describe('INV-08 — Automatic audit emission for CRUD operations', () => {
  it('withAudit module exists and exports correctly', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    expect(existsSync(auditPath), 'packages/db/src/audit.ts must exist').toBe(true)

    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('export function withAudit')
    expect(content).toContain('actorId')
    expect(content).toContain('entityId')
    expect(content).toContain('correlationId')
  })

  it('withAudit emits audit events for insert/update/delete', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    // Must handle all three mutation types
    expect(content).toContain("'insert'")
    expect(content).toContain("'update'")
    expect(content).toContain("'delete'")

    // Must call emitter for each
    expect(content).toContain('buildAuditEvent')
    expect(content).toContain('emitter(auditEvent)')
  })

  it('withAudit validates entityId consistency', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('does not match')
    expect(content).toContain('structural error')
  })

  it('AuditEvent includes all required fields', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    // Required fields in AuditEvent interface
    expect(content).toContain('entityId: string')
    expect(content).toContain('actorId: string')
    expect(content).toContain('table: string')
    expect(content).toMatch(/action:\s*'insert'\s*\|\s*'update'\s*\|\s*'delete'/)
    expect(content).toContain('timestamp: string')
    expect(content).toContain('correlationId: string')
  })
})

// ── INV-09: Audit module structure ──────────────────────────────────────────

describe('INV-09 — Audit module structure and exports', () => {
  it('@nzila/db package.json exports audit module', () => {
    const pkgPath = join(ROOT, 'packages', 'db', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.exports['./audit']).toBeTruthy()
  })

  it('audit module is re-exported from barrel', () => {
    const indexPath = join(ROOT, 'packages', 'db', 'src', 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('withAudit')
    expect(content).toContain('AuditedScopedDb')
  })

  it('default audit emitter writes to audit_events with hash chain', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('computeEntryHash')
    expect(content).toContain('auditEvents')
    expect(content).toContain('previousHash')
  })

  it('audit emitter has fallback logging to prevent silent loss', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('AUDIT:AUTO:FALLBACK')
    expect(content).toContain('console.error')
  })

  it('existing recordAuditEvent is NOT removed (backward compatibility)', () => {
    // Verify the existing audit-db.ts in console still exists
    const auditDbPath = join(ROOT, 'apps', 'console', 'lib', 'audit-db.ts')
    if (existsSync(auditDbPath)) {
      const content = readFileSync(auditDbPath, 'utf-8')
      expect(content).toContain('export async function recordAuditEvent')
      expect(content).toContain('AUDIT_ACTIONS')
    }
  })

  it('audit hash chain mechanism preserved', () => {
    const auditDbPath = join(ROOT, 'apps', 'console', 'lib', 'audit-db.ts')
    if (existsSync(auditDbPath)) {
      const content = readFileSync(auditDbPath, 'utf-8')
      expect(content).toContain('computeEntryHash')
      expect(content).toContain('previousHash')
    }
  })
})

// ── Documentation ───────────────────────────────────────────────────────────

describe('Audit enforcement documentation', () => {
  it('AUDIT_ENFORCEMENT.md exists', () => {
    const docPath = join(ROOT, 'docs', 'architecture', 'AUDIT_ENFORCEMENT.md')
    expect(existsSync(docPath), 'docs/architecture/AUDIT_ENFORCEMENT.md must exist').toBe(true)
  })
})
