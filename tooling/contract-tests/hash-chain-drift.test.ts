/**
 * Contract Test — Hash Chain Schema Drift Detection
 *
 * Ensures that:
 *   1. All append-only tables have hash + previousHash columns
 *   2. The immutability trigger SQL migration file exists and covers all tables
 *   3. Hash chain code (computeEntryHash, verifyChain) exists and is exported
 *   4. No schema change can silently remove hash chain enforcement
 *
 * @invariant INV-10: Hash chain structural integrity
 * @invariant INV-11: Append-only immutability triggers present
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// Tables that MUST be hash-chained and append-only
const HASH_CHAINED_TABLES = [
  {
    name: 'audit_events',
    schemaFile: 'packages/db/src/schema/operations.ts',
    variableName: 'auditEvents',
  },
  {
    name: 'share_ledger_entries',
    schemaFile: 'packages/db/src/schema/equity.ts',
    variableName: 'shareLedgerEntries',
  },
  {
    name: 'automation_events',
    schemaFile: 'packages/db/src/schema/automation.ts',
    variableName: 'automationEvents',
  },
] as const

// ── INV-10: Hash chain columns exist in schema ──────────────────────────────

describe('INV-10 — Hash chain structural integrity', () => {
  for (const table of HASH_CHAINED_TABLES) {
    describe(`${table.name}`, () => {
      it('schema file exists', () => {
        const schemaPath = join(ROOT, table.schemaFile)
        expect(existsSync(schemaPath), `${table.schemaFile} must exist`).toBe(true)
      })

      it('has hash column defined', () => {
        const content = readFileSync(join(ROOT, table.schemaFile), 'utf-8')
        expect(content).toContain("hash: text('hash')")
      })

      it('has previousHash column defined', () => {
        const content = readFileSync(join(ROOT, table.schemaFile), 'utf-8')
        expect(content).toContain("previousHash: text('previous_hash')")
      })

      it('hash column is NOT NULL', () => {
        const content = readFileSync(join(ROOT, table.schemaFile), 'utf-8')
        // Find the hash column definition and verify notNull()
        const hashColRegex = new RegExp(
          `hash:\\s*text\\('hash'\\)\\.notNull\\(\\)`,
        )
        expect(
          hashColRegex.test(content),
          `${table.name}.hash must be notNull()`,
        ).toBe(true)
      })
    })
  }
})

// ── INV-11: Immutability triggers SQL migration exists ──────────────────────

describe('INV-11 — Append-only immutability triggers present', () => {
  const TRIGGER_FILE = 'packages/db/migrations/hash-chain-immutability-triggers.sql'

  it('trigger migration file exists', () => {
    expect(
      existsSync(join(ROOT, TRIGGER_FILE)),
      `${TRIGGER_FILE} must exist`,
    ).toBe(true)
  })

  it('trigger file defines nzila_deny_mutate() function', () => {
    const content = readFileSync(join(ROOT, TRIGGER_FILE), 'utf-8')
    expect(content).toContain('CREATE OR REPLACE FUNCTION nzila_deny_mutate()')
    expect(content).toContain('RAISE EXCEPTION')
    expect(content).toContain('append-only')
  })

  for (const table of HASH_CHAINED_TABLES) {
    it(`defines UPDATE trigger for ${table.name}`, () => {
      const content = readFileSync(join(ROOT, TRIGGER_FILE), 'utf-8')
      const triggerPattern = new RegExp(
        `CREATE TRIGGER\\s+\\w+.*?BEFORE UPDATE ON ${table.name}`,
        's',
      )
      expect(
        triggerPattern.test(content),
        `BEFORE UPDATE trigger must exist for ${table.name}`,
      ).toBe(true)
    })

    it(`defines DELETE trigger for ${table.name}`, () => {
      const content = readFileSync(join(ROOT, TRIGGER_FILE), 'utf-8')
      const triggerPattern = new RegExp(
        `CREATE TRIGGER\\s+\\w+.*?BEFORE DELETE ON ${table.name}`,
        's',
      )
      expect(
        triggerPattern.test(content),
        `BEFORE DELETE trigger must exist for ${table.name}`,
      ).toBe(true)
    })
  }

  it('defines hash validation trigger for INSERT', () => {
    const content = readFileSync(join(ROOT, TRIGGER_FILE), 'utf-8')
    expect(content).toContain('nzila_validate_hash_chain')
    expect(content).toContain('hash must not be null or empty')
  })
})

// ── Hash chain code exists and is exported ──────────────────────────────────

describe('INV-10 — Hash chain computation code integrity', () => {
  it('computeEntryHash exists in os-core', () => {
    const hashPath = join(ROOT, 'packages', 'os-core', 'src', 'hash.ts')
    expect(existsSync(hashPath)).toBe(true)

    const content = readFileSync(hashPath, 'utf-8')
    expect(content).toContain('export function computeEntryHash')
    expect(content).toContain('sha256')
    expect(content).toContain('previousHash')
  })

  it('verifyChain exists in os-core', () => {
    const hashPath = join(ROOT, 'packages', 'os-core', 'src', 'hash.ts')
    const content = readFileSync(hashPath, 'utf-8')
    expect(content).toContain('export function verifyChain')
    expect(content).toContain('brokenAtIndex')
  })

  it('os-core barrel exports hash utilities', () => {
    const indexPath = join(ROOT, 'packages', 'os-core', 'src', 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('computeEntryHash')
    expect(content).toContain('verifyChain')
  })

  it('audit module uses hash chain for audit events', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('computeEntryHash')
    expect(content).toContain('previousHash')
  })
})
