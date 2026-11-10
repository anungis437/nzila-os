import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface ReconciliationDoc {
  problems: string[]
  consistent: boolean
  totals: {
    overlayImplemented: number
    overlayPartial: number
    ledgerImplemented: number
    creditedByEarlierRuns: number
    unresolvedByOverlay: number
    untouchedByOverlay: number
    qualificationVerified: number
    closed: number
  }
  mutuallyExclusiveAccounting: {
    population: number
    implemented: number
    partial: number
    untouched: number
    partialIds: string[]
    untouchedIds: string[]
  }
}

interface OverlayDoc {
  records: Array<{ engineeringCorrection?: { state?: string } | null }>
}

interface LedgerDoc {
  entries: Record<string, { status?: string }>
}

const dir = join(process.cwd(), '../../docs/union-eyes/convergence/remediation')
function read<T>(name: string): T {
  return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T
}

describe('Gate 0 accounting reconciliation', () => {
  const rec = read<ReconciliationDoc>('ue-gate0-accounting-reconciliation.json')
  const overlay = read<OverlayDoc>('ue-all-777-remediation-register.json')
  const ledger = read<LedgerDoc>('ue-gate0-defect-elimination.json')

  it('records no inconsistency between the overlay and the elimination ledger', () => {
    expect(rec.problems).toEqual([])
    expect(rec.consistent).toBe(true)
  })

  it('accounts for every corrected defect exactly once: ledger credits plus earlier-run credits equal the overlay total', () => {
    const implemented = overlay.records.filter((r) => r.engineeringCorrection?.state === 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION').length
    const ledgerImplemented = Object.values(ledger.entries).filter((e) => e.status === 'IMPLEMENTED_PENDING_QUALIFICATION').length
    expect(rec.totals.overlayImplemented).toBe(implemented)
    expect(rec.totals.ledgerImplemented).toBe(ledgerImplemented)
    expect(rec.totals.creditedByEarlierRuns).toBe(implemented - ledgerImplemented)
    expect(rec.totals.unresolvedByOverlay).toBe(777 - implemented)
  })

  it('never reports a defect as qualification-verified or closed', () => {
    expect(rec.totals.qualificationVerified).toBe(0)
    expect(rec.totals.closed).toBe(0)
  })

  it('partitions every one of the 777 defects into exactly one of implemented, partial or untouched, with no overlap', () => {
    const m = rec.mutuallyExclusiveAccounting
    expect(m.population).toBe(777)
    expect(m.implemented + m.partial + m.untouched).toBe(777)
    expect(m.implemented).toBe(rec.totals.overlayImplemented)
    expect(m.partial).toBe(rec.totals.overlayPartial)
    expect(m.untouched).toBe(rec.totals.untouchedByOverlay)
    expect(new Set(m.partialIds).size).toBe(m.partialIds.length)
    expect(new Set(m.untouchedIds).size).toBe(m.untouchedIds.length)
    expect(m.partialIds.some((id: string) => m.untouchedIds.includes(id))).toBe(false)
    // "unresolvedByOverlay" (the historical name) is partial + untouched together, never additional to partial.
    expect(rec.totals.unresolvedByOverlay).toBe(m.partial + m.untouched)
  })
})
