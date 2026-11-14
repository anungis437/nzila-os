/**
 * CONTRACT_META_001 — "Contracts are fast + deterministic"
 *
 * Meta-contract ensuring governance tests stay practical:
 *   - Exception files are valid JSON with required fields
 *   - No expired exceptions exist (caught per-rule, but also verified here fleet-wide)
 *   - Contract tests are self-consistent
 *
 * @invariant CONTRACT_META_001
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, isExceptionExpired, type ExceptionFile } from './governance-helpers'

const EXCEPTIONS_DIR = join(ROOT, 'governance/exceptions')

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadAllExceptionFiles(): Array<{
  filename: string
  data: ExceptionFile
}> {
  if (!existsSync(EXCEPTIONS_DIR)) return []
  return readdirSync(EXCEPTIONS_DIR)
    .filter((f) => f.endsWith('.json') && !f.includes('schema'))
    .map((f) => ({
      filename: f,
      data: JSON.parse(
        readFileSync(join(EXCEPTIONS_DIR, f), 'utf-8'),
      ) as ExceptionFile,
    }))
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CONTRACT_META_001 — Contracts are fast + deterministic', () => {
  const exceptionFiles = loadAllExceptionFiles()

  it('all exception files parse as valid JSON with required fields', () => {
    for (const { filename, data } of exceptionFiles) {
      expect(data.ruleId, `${filename} missing ruleId`).toBeTruthy()
      expect(data.entries, `${filename} missing entries array`).toBeInstanceOf(
        Array,
      )

      for (const entry of data.entries) {
        expect(entry.path, `${filename} entry missing path`).toBeTruthy()
        expect(entry.owner, `${filename} entry missing owner`).toBeTruthy()
        expect(
          entry.justification,
          `${filename} entry missing justification`,
        ).toBeTruthy()
        expect(
          entry.expiresOn,
          `${filename} entry missing expiresOn`,
        ).toBeTruthy()
        // Validate date format
        expect(
          /^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn),
          `${filename} entry expiresOn "${entry.expiresOn}" must be YYYY-MM-DD`,
        ).toBe(true)
      }
    }
  })

  it('no exception entries are expired fleet-wide', () => {
    const today = new Date()
    const expired: string[] = []

    for (const { filename, data } of exceptionFiles) {
      for (const entry of data.entries) {
        if (isExceptionExpired(entry.expiresOn, today)) {
          expired.push(
            `[${data.ruleId}] ${entry.path} expired ${entry.expiresOn} (owner: ${entry.owner}, file: ${filename})`,
          )
        }
      }
    }

    expect(
      expired,
      `Expired governance exceptions:\n${expired.join('\n')}`,
    ).toHaveLength(0)
  })

  it('contract test files exist for each governance rule', () => {
    const contractDir = join(ROOT, 'tooling/contract-tests')
    const expectedFiles = [
      'ts-strict.test.ts',
      'no-console.test.ts',
      'arch-layer.test.ts',
    ]

    for (const f of expectedFiles) {
      expect(
        existsSync(join(contractDir, f)),
        `Contract test file ${f} must exist`,
      ).toBe(true)
    }
  })
})
