/**
 * Contract Test — Agri Server Actions — ORG_REQUIRED
 *
 * AGRI_SERVER_ACTIONS_ORG_REQUIRED_001:
 * Every server action file in apps/agrimo MUST:
 *   1. Use 'use server' directive
 *   2. Call resolveOrgContext() for authentication + org scoping
 *   3. Build audit entries for mutations
 *
 * @invariant AGRI_SERVER_ACTIONS_ORG_REQUIRED_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const AGRIMO_ACTIONS = join(ROOT, 'apps', 'agrimo', 'lib', 'actions')

const ACTION_FILES = [
  'producer-actions.ts',
  'harvest-actions.ts',
  'lot-actions.ts',
  'quality-actions.ts',
  'warehouse-actions.ts',
  'shipment-actions.ts',
  'payment-actions.ts',
  'certification-actions.ts',
]

describe('AGRI-ACT — Server action files exist', () => {
  for (const file of ACTION_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(join(AGRIMO_ACTIONS, file))).toBe(true)
    })
  }
})

describe('AGRI-ACT-01 — Every action file uses "use server" directive', () => {
  for (const file of ACTION_FILES) {
    it(`${file} has 'use server'`, () => {
      const path = join(AGRIMO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain("'use server'")
    })
  }
})

describe('AGRI-ACT-02 — Every action calls resolveOrgContext()', () => {
  for (const file of ACTION_FILES) {
    it(`${file} calls resolveOrgContext()`, () => {
      const path = join(AGRIMO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('resolveOrgContext')
    })
  }
})

describe('AGRI-ACT-03 — Mutating actions build audit entries', () => {
  for (const file of ACTION_FILES) {
    it(`${file} builds audit entries`, () => {
      const path = join(AGRIMO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      const hasActionAudit = content.includes('buildActionAuditEntry')
      expect(
        hasActionAudit,
        `${file} must use buildActionAuditEntry`,
      ).toBe(true)
    })
  }
})

describe('AGRI-ACT-04 — resolveOrgContext import comes from @/lib/resolve-org', () => {
  for (const file of ACTION_FILES) {
    it(`${file} imports from @/lib/resolve-org`, () => {
      const path = join(AGRIMO_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      if (content.includes('resolveOrgContext')) {
        expect(content).toContain("from '@/lib/resolve-org'")
      }
    })
  }
})
