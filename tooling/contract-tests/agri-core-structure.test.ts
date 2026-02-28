/**
 * Contract Test — Agri Core Package Structure
 *
 * AGRI_CORE_STRUCTURE_005:
 *   1. Core package exports enums, types, schemas, FSMs, audit
 *   2. Enums use const-object pattern (not TypeScript enum keyword)
 *   3. Schemas use Zod
 *   4. FSMs have transition validation
 *
 * @invariant AGRI_CORE_STRUCTURE_005
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const CORE = join(ROOT, 'packages', 'agri-core', 'src')

describe('AGRI-CORE-01 — Required source files exist', () => {
  const required = ['enums.ts', 'types/index.ts', 'schemas/index.ts', 'fsm/index.ts', 'audit.ts', 'index.ts']
  for (const file of required) {
    it(`${file} exists`, () => {
      expect(existsSync(join(CORE, file))).toBe(true)
    })
  }
})

describe('AGRI-CORE-02 — Enums use const-object pattern', () => {
  it('enums.ts uses "as const" pattern, not "enum" keyword', () => {
    const content = readFileSync(join(CORE, 'enums.ts'), 'utf-8')
    expect(content).toContain('as const')
    // Should not use TypeScript enum keyword
    expect(content).not.toMatch(/^\s*export\s+enum\s+/m)
  })
})

describe('AGRI-CORE-03 — Schemas use Zod', () => {
  it('schemas/index.ts imports from zod', () => {
    const content = readFileSync(join(CORE, 'schemas', 'index.ts'), 'utf-8')
    expect(content).toContain("from 'zod'")
  })
})

describe('AGRI-CORE-04 — FSMs have transition validation', () => {
  it('fsm/index.ts defines transition functions', () => {
    const content = readFileSync(join(CORE, 'fsm', 'index.ts'), 'utf-8')
    expect(content).toContain('transition')
    expect(content).toContain('LotQualityFSM')
    expect(content).toContain('ShipmentFSM')
  })
})

describe('AGRI-CORE-05 — Barrel export re-exports all modules', () => {
  it('index.ts re-exports enums, types, schemas, fsm, audit', () => {
    const content = readFileSync(join(CORE, 'index.ts'), 'utf-8')
    expect(content).toContain('enums')
    expect(content).toContain('types')
    expect(content).toContain('schemas')
    expect(content).toContain('fsm')
    expect(content).toContain('audit')
  })
})
