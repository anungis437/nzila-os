import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const INVENTORY_PATH = resolve(ROOT, 'governance/ai/inventory.json')
const MATRIX_PATH = resolve(ROOT, 'governance/ai/AI_VALIDATION_MATRIX.md')

type SurfaceStatus = 'DESIGN' | 'DEV' | 'PROD' | 'DEPRECATED' | 'RETIRED'

interface Surface {
  id: string
  status: SurfaceStatus
  pia?: string | null
  evalDataset?: string | null
}

interface Inventory {
  surfaces: Surface[]
}

const REQUIRED_SURFACES = ['union-eyes-triage', 'platform-cognition-phase1'] as const

const REQUIRED_RUNTIME_EVIDENCE = [
  'apps/union-eyes/app/api/ai/grievances/[id]/clause-reasoning/route.ts',
  'apps/union-eyes/app/api/ai/search/route.ts',
  'apps/union-eyes/lib/ai-client.ts',
  'apps/union-eyes/lib/ai/ai-client.ts',
  'packages/platform-cognition-core/src/index.ts',
] as const

describe('UE release readiness', () => {
  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8')) as Inventory
  const matrix = readFileSync(MATRIX_PATH, 'utf-8')

  function getSurface(id: string): Surface {
    const found = inventory.surfaces.find((surface) => surface.id === id)
    expect(found, `Missing required inventory surface: ${id}`).toBeTruthy()
    return found as Surface
  }

  it('contains required UE release surfaces', () => {
    const ids = new Set(inventory.surfaces.map((surface) => surface.id))
    for (const id of REQUIRED_SURFACES) {
      expect(ids.has(id), `Missing required surface: ${id}`).toBe(true)
    }
  })

  it('marks required UE release surfaces as implemented status (DEV/PROD)', () => {
    for (const id of REQUIRED_SURFACES) {
      const surface = getSurface(id)
      expect(
        ['DEV', 'PROD'],
        `${id} must be DEV/PROD for UE release. Current status: ${surface.status}`,
      ).toContain(surface.status)
    }
  })

  it('marks required UE release surfaces as ACCOUNTED in validation matrix', () => {
    for (const id of REQUIRED_SURFACES) {
      const rowRegex = new RegExp(`\\|\\s${id}\\s\\|[\\s\\S]*?\\|\\sACCOUNTED\\s\\|`)
      expect(
        rowRegex.test(matrix),
        `Matrix row for ${id} must be ACCOUNTED for UE release`,
      ).toBe(true)
    }
  })

  it('has governance evidence paths present for union-eyes-triage', () => {
    const ue = getSurface('union-eyes-triage')
    expect(ue.pia, 'union-eyes-triage must reference a PIA').toBeTruthy()
    expect(ue.evalDataset, 'union-eyes-triage must reference an eval dataset').toBeTruthy()

    expect(
      existsSync(resolve(ROOT, ue.pia as string)),
      `PIA path does not exist: ${ue.pia}`,
    ).toBe(true)
    expect(
      existsSync(resolve(ROOT, ue.evalDataset as string)),
      `Eval dataset path does not exist: ${ue.evalDataset}`,
    ).toBe(true)
  })

  it('contains required UE runtime artifacts', () => {
    for (const artifact of REQUIRED_RUNTIME_EVIDENCE) {
      expect(
        existsSync(resolve(ROOT, artifact)),
        `Missing required UE runtime evidence file: ${artifact}`,
      ).toBe(true)
    }
  })
})