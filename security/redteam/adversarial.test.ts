/**
 * Nzila OS — Red-Team Adversarial Test Harness
 *
 * Automated adversarial tests that simulate attack vectors against
 * the governance control system. These tests MUST FAIL (i.e., the
 * attack must be blocked). If any attack succeeds, CI fails.
 *
 * Attack vectors tested:
 *   1. Cross-org data access attempt
 *   2. Privilege escalation attempt
 *   3. Write without audit bypass
 *   4. Direct DB import bypass (static analysis)
 *   5. Replay attack simulation
 *   6. Double-submit attempt (fintech-relevant)
 *   7. Evidence pack tampering
 *   8. Hash chain insertion bypass
 *
 * Scheduling: Nightly via GitHub Actions + on-demand via CI
 *
 * @security RED-TEAM-001 through RED-TEAM-008
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash, createHmac, randomUUID } from 'node:crypto'

const ROOT = join(__dirname, '..', '..')

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkSync(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
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

// ── RED-TEAM-001: Cross-Org Data Access ─────────────────────────────────────

describe('RED-TEAM-001 — Cross-org data access must be structurally impossible', () => {
  it('createScopedDb enforces Org isolation — cannot be constructed without orgId', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // Must throw on empty orgId
    expect(content).toContain('non-empty orgId string')
    expect(content).toContain('throw new ScopedDbError')
  })

  it('ScopedDb injects orgId on every SELECT query', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')

    // SELECT must include entityFilter
    expect(content).toContain('eq(entityCol, orgId)')
    expect(content).toContain('select(table, extraWhere)')
  })

  it('ScopedDb injects orgId on every INSERT', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')
    expect(content).toContain('orgId, // force orgId on every row')
  })

  it('no app code bypasses entity scoping via raw DB imports', () => {
    const appsDir = join(ROOT, 'apps')
    const appFiles = walkSync(appsDir)
    const violations: string[] = []

    for (const file of appFiles) {
      const content = readFileSync(file, 'utf-8')
      if (
        content.includes("from '@nzila/db/raw'") ||
        content.includes('from "@nzila/db/raw"') ||
        content.includes("from '@nzila/db/client'") ||
        content.includes('from "@nzila/db/client"')
      ) {
        violations.push(relative(ROOT, file))
      }
    }

    expect(violations).toEqual([])
  })
})

// ── RED-TEAM-002: Privilege Escalation ──────────────────────────────────────

describe('RED-TEAM-002 — Privilege escalation must be blocked', () => {
  it('authorize() function validates role hierarchy', () => {
    const authPath = join(ROOT, 'packages', 'os-core', 'src', 'policy', 'authorize.ts')
    expect(existsSync(authPath)).toBe(true)

    const content = readFileSync(authPath, 'utf-8')
    expect(content).toContain('roleIncludes')
    expect(content).toContain('AuthorizationError')
    expect(content).toContain('requiredRole')
  })

  it('role definitions use strict hierarchy without bypass flags', () => {
    const rolesPath = join(ROOT, 'packages', 'os-core', 'src', 'policy', 'roles.ts')
    expect(existsSync(rolesPath)).toBe(true)

    const content = readFileSync(rolesPath, 'utf-8')
    // Must NOT have any debug/bypass/admin override patterns
    expect(content).not.toMatch(/bypass|override|debug.*admin|skip.*auth/i)
  })

  it('no API route allows unauthenticated access without explicit allowSystem', () => {
    const authPath = join(ROOT, 'packages', 'os-core', 'src', 'policy', 'authorize.ts')
    const content = readFileSync(authPath, 'utf-8')
    expect(content).toContain('Authentication required')
    expect(content).toContain('allowSystem')
  })
})

// ── RED-TEAM-003: Write Without Audit ───────────────────────────────────────

describe('RED-TEAM-003 — Write operations without audit must be blocked', () => {
  it('withAudit wrapper blocks mutations when audit emission fails', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    expect(content).toContain('[AUDIT:MANDATORY]')
    expect(content).toContain('Mutation blocked')
    expect(content).toContain('auditPromise')
  })

  it('audit emitter writes to audit_events table with hash chain', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    expect(content).toContain('computeEntryHash')
    expect(content).toContain('previousHash')
    expect(content).toContain('auditEvents')
  })

  it('default audit emitter never silently drops events', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    // Fallback logging for audit events that fail to persist
    expect(content).toContain('[AUDIT:AUTO:FALLBACK]')
  })
})

// ── RED-TEAM-004: Direct DB Import Bypass (Static Analysis) ─────────────────

describe('RED-TEAM-004 — Direct DB import bypass detection', () => {
  it('no app directory contains raw drizzle instantiation', () => {
    const appsDir = join(ROOT, 'apps')
    const appFiles = walkSync(appsDir)
    const violations: string[] = []

    const drizzlePattern = /import\s+.*\bdrizzle\b.*from\s+['"]drizzle-orm\/(postgres-js|node-postgres|neon-http)['"]/

    for (const file of appFiles) {
      // Skip orchestrator-api (documented exemption)
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      if (rel.startsWith('apps/orchestrator-api/')) continue
      const content = readFileSync(file, 'utf-8')
      if (drizzlePattern.test(content)) {
        violations.push(rel)
      }
    }

    expect(violations).toEqual([])
  })

  it('no app directory imports raw pg/postgres drivers', () => {
    const appsDir = join(ROOT, 'apps')
    const appFiles = walkSync(appsDir)
    const violations: string[] = []

    const driverPattern = /import\s+.*from\s+['"](postgres|pg|@neondatabase\/serverless)['"]/

    for (const file of appFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      if (rel.startsWith('apps/orchestrator-api/')) continue
      const content = readFileSync(file, 'utf-8')
      if (driverPattern.test(content)) {
        violations.push(rel)
      }
    }

    expect(violations).toEqual([])
  })
})

// ── RED-TEAM-005: Replay Attack Simulation ──────────────────────────────────

describe('RED-TEAM-005 — Replay attack resistance', () => {
  it('audit events include unique correlationId', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    expect(content).toContain('correlationId')
    expect(content).toContain('randomUUID')
  })

  it('audit events include timestamp for ordering', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')

    expect(content).toContain('timestamp: new Date().toISOString()')
  })

  it('hash chain makes replay insertion detectable', () => {
    // Simulate: if an attacker replays an old audit entry, the hash chain breaks
    const { computeEntryHash, verifyChain } = require(
      join(ROOT, 'packages', 'os-core', 'src', 'hash.ts'),
    )

    // Build a valid 3-entry chain
    const entry1 = {
      payload: { action: 'insert', table: 'meetings' },
      hash: '',
      previousHash: null as string | null,
    }
    entry1.hash = computeEntryHash(entry1.payload, null)

    const entry2 = {
      payload: { action: 'update', table: 'resolutions' },
      hash: '',
      previousHash: entry1.hash,
    }
    entry2.hash = computeEntryHash(entry2.payload, entry1.hash)

    const entry3 = {
      payload: { action: 'delete', table: 'drafts' },
      hash: '',
      previousHash: entry2.hash,
    }
    entry3.hash = computeEntryHash(entry3.payload, entry2.hash)

    // Valid chain
    const validResult = verifyChain(
      [entry1, entry2, entry3],
      (e: any) => e.payload,
    )
    expect(validResult.valid).toBe(true)

    // Replay attack: insert entry1 again at position 3
    const replay = { ...entry1, previousHash: entry2.hash }
    // The hash won't match because it was computed with previousHash=null
    const replayResult = verifyChain(
      [entry1, entry2, replay],
      (e: any) => e.payload,
    )
    expect(replayResult.valid).toBe(false)
    expect(replayResult.brokenAtIndex).toBe(2)
  })
})

// ── RED-TEAM-006: Double-Submit Attack ──────────────────────────────────────

describe('RED-TEAM-006 — Double-submit prevention', () => {
  it('governance_actions table has unique constraints preventing duplication', () => {
    const opsSchema = join(ROOT, 'packages', 'db', 'src', 'schema', 'operations.ts')
    const content = readFileSync(opsSchema, 'utf-8')

    // Must have primary key (implied unique)
    expect(content).toContain('primaryKey().defaultRandom()')
    // Must track status to prevent re-execution
    expect(content).toContain("status: governanceActionStatusEnum('status')")
  })

  it('automation_commands has unique correlationId', () => {
    const autoSchema = join(ROOT, 'packages', 'db', 'src', 'schema', 'automation.ts')
    const content = readFileSync(autoSchema, 'utf-8')
    expect(content).toContain('correlationId')
    expect(content).toContain('.unique()')
  })
})

// ── RED-TEAM-007: Evidence Pack Tampering ────────────────────────────────────

describe('RED-TEAM-007 — Evidence pack tampering detection', () => {
  it('tampered artifact hash is detected by verifySeal', () => {
    const {
      generateSeal,
      verifySeal,
    } = require(join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'seal.ts'))

    const pack = {
      entityId: 'test-entity',
      artifacts: [
        { sha256: 'a'.repeat(64), name: 'legit.json' },
      ],
    }
    const seal = generateSeal(pack, { sealedAt: '2026-01-01T00:00:00Z' })

    // Tamper with artifact hash
    const tampered = {
      ...pack,
      artifacts: [{ sha256: 'f'.repeat(64), name: 'tampered.json' }],
      seal,
    }

    const result = verifySeal(tampered)
    expect(result.valid).toBe(false)
  })

  it('removed seal is detected', () => {
    const { verifySeal } = require(
      join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'seal.ts'),
    )
    const result = verifySeal({ entityId: 'test', artifacts: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

// ── RED-TEAM-008: Hash Chain Insertion Bypass ────────────────────────────────

describe('RED-TEAM-008 — Hash chain insertion without valid hash is blocked', () => {
  it('trigger SQL prevents null hash insertion', () => {
    const triggerFile = join(
      ROOT,
      'packages',
      'db',
      'migrations',
      'hash-chain-immutability-triggers.sql',
    )
    expect(existsSync(triggerFile)).toBe(true)

    const content = readFileSync(triggerFile, 'utf-8')
    expect(content).toContain('hash must not be null or empty')
    expect(content).toContain('RAISE EXCEPTION')
  })

  it('audit_events schema requires hash NOT NULL', () => {
    const schema = readFileSync(
      join(ROOT, 'packages', 'db', 'src', 'schema', 'operations.ts'),
      'utf-8',
    )
    expect(schema).toMatch(/hash:\s*text\('hash'\)\.notNull\(\)/)
  })
})
