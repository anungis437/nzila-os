import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAcceptanceControls, CONTROLS } from './acceptance-ledger'

const appRoot = path.resolve(__dirname, '..', '..')
const controls = buildAcceptanceControls()

describe('compressed acceptance model (G2-G4, G6)', () => {
  it('binds every mutating root caller to a shared control (unmapped = 0)', () => {
    expect(controls.summary.mutatingCallers).toBe(512)
    expect(controls.summary.mutatingBound).toBe(512)
    expect(controls.summary.mutatingUnmapped).toBe(0)
    expect(controls.summary.unresolvedControls).toEqual([])
  })

  it('places every exception caller in exactly one deduplicated exception class', () => {
    expect(controls.summary.unclassifiedExceptionCallers).toBe(0)
    const total = controls.exceptionClasses.reduce((sum, entry) => sum + entry.callerCount, 0)
    expect(total).toBe(controls.summary.mutatingExceptionCallers)
    expect(controls.summary.exceptionClassCount).toBeLessThanOrEqual(10)
  })

  it('places every financial mutation caller in a financial authority class', () => {
    expect(controls.summary.unclassifiedFinancialCallers).toEqual([])
    expect(controls.summary.financialClassCount).toBeGreaterThan(0)
  })

  it('references only runtime evidence files that exist', () => {
    const referenced = new Set<string>([
      ...CONTROLS.flatMap((control) => control.runtimeEvidence),
      ...controls.exceptionClasses.flatMap((entry) => entry.representativeProof),
      ...controls.financialClasses.flatMap((entry) => entry.representativeProof),
    ])
    for (const file of referenced)
      expect(existsSync(path.join(appRoot, ...file.split('/'))), file).toBe(true)
  })
})
