import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const INVENTORY_PATH = resolve(ROOT, 'governance/ai/inventory.json')
const MATRIX_PATH = resolve(ROOT, 'governance/ai/AI_VALIDATION_MATRIX.md')

interface Surface {
  id: string
  status: 'DESIGN' | 'DEV' | 'PROD' | 'DEPRECATED' | 'RETIRED'
  approval: { by: string; date: string | null; decision: string }
  piaStatus?: string
  worldClassEvidence?: {
    incidentPlaybook?: string
    monitoringPlan?: string
    killSwitchDrill?: string
    humanOversight?: string
  }
}

interface Inventory {
  surfaces: Surface[]
}

const REQUIRED_WORLD_CLASS_SURFACES = ['union-eyes-triage', 'platform-cognition-phase1'] as const

describe('UE world-class readiness', () => {
  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8')) as Inventory
  const matrix = readFileSync(MATRIX_PATH, 'utf-8')

  function getSurface(id: string): Surface {
    const found = inventory.surfaces.find((surface) => surface.id === id)
    expect(found, `Missing required world-class surface in inventory: ${id}`).toBeTruthy()
    return found as Surface
  }

  it('keeps required world-class surfaces in implemented state', () => {
    for (const id of REQUIRED_WORLD_CLASS_SURFACES) {
      const surface = getSurface(id)
      expect(['DEV', 'PROD']).toContain(surface.status)
    }
  })

  it('requires approved governance decisions with recorded approval date', () => {
    for (const id of REQUIRED_WORLD_CLASS_SURFACES) {
      const surface = getSurface(id)
      expect(surface.approval.decision, `${id} approval decision must be approved`).toBe('approved')
      expect(surface.approval.date, `${id} approval date is required`).toBeTruthy()
    }
  })

  it('requires closed/approved PIA status for world-class surfaces', () => {
    expect(getSurface('union-eyes-triage').piaStatus).toBe('CLOSED')
    expect(getSurface('platform-cognition-phase1').piaStatus).toBe('APPROVED')
  })

  it('requires ACCOUNTED matrix status for world-class surfaces', () => {
    for (const id of REQUIRED_WORLD_CLASS_SURFACES) {
      const rowRegex = new RegExp(`\\|\\s${id}\\s\\|[\\s\\S]*?\\|\\sACCOUNTED\\s\\|`)
      expect(rowRegex.test(matrix), `${id} must remain ACCOUNTED in AI_VALIDATION_MATRIX`).toBe(true)
    }
  })

  it('requires world-class governance evidence files for UE triage', () => {
    const ue = getSurface('union-eyes-triage')
    const evidence = ue.worldClassEvidence ?? {}

    expect(evidence.incidentPlaybook).toBeTruthy()
    expect(evidence.monitoringPlan).toBeTruthy()
    expect(evidence.killSwitchDrill).toBeTruthy()
    expect(evidence.humanOversight).toBeTruthy()

    expect(existsSync(resolve(ROOT, evidence.incidentPlaybook as string))).toBe(true)
    expect(existsSync(resolve(ROOT, evidence.monitoringPlan as string))).toBe(true)
    expect(existsSync(resolve(ROOT, evidence.killSwitchDrill as string))).toBe(true)
    expect(existsSync(resolve(ROOT, evidence.humanOversight as string))).toBe(true)
  })

  it('requires world-class governance evidence files for platform cognition', () => {
    const platform = getSurface('platform-cognition-phase1')
    const evidence = platform.worldClassEvidence ?? {}

    expect(evidence.incidentPlaybook).toBeTruthy()
    expect(evidence.monitoringPlan).toBeTruthy()
    expect(evidence.killSwitchDrill).toBeTruthy()

    expect(existsSync(resolve(ROOT, evidence.incidentPlaybook as string))).toBe(true)
    expect(existsSync(resolve(ROOT, evidence.monitoringPlan as string))).toBe(true)
    expect(existsSync(resolve(ROOT, evidence.killSwitchDrill as string))).toBe(true)
  })
}
