import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), '../../docs/union-eyes/convergence/remediation')
const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'))

describe('Gate 0 accounting reconciliation', () => {
  const rec = read('ue-gate0-accounting-reconciliation.json')
  const overlay = read('ue-all-777-remediation-register.json')
  const ledger = read('ue-gate0-defect-elimination.json')

  it('records no inconsistency between the overlay and the elimination ledger', () => {
    expect(rec.problems).toEqual([])
    expect(rec.consistent).toBe(true)
  })

  it('accounts for every corrected defect exactly once: ledger credits plus earlier-run credits equal the overlay total', () => {
    const implemented = overlay.records.filter((r: any) => r.engineeringCorrection?.state === 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION').length
    const ledgerImplemented = Object.values(ledger.entries).filter((e: any) => e.status === 'IMPLEMENTED_PENDING_QUALIFICATION').length
    expect(rec.totals.overlayImplemented).toBe(implemented)
    expect(rec.totals.ledgerImplemented).toBe(ledgerImplemented)
    expect(rec.totals.creditedByEarlierRuns).toBe(implemented - ledgerImplemented)
    expect(rec.totals.unresolvedByOverlay).toBe(777 - implemented)
  })

  it('never reports a defect as qualification-verified or closed', () => {
    expect(rec.totals.qualificationVerified).toBe(0)
    expect(rec.totals.closed).toBe(0)
  })
})
