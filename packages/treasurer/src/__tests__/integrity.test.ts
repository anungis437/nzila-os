import { describe, expect, it } from 'vitest'

import { validateSnapshot } from '../integrity'
import { AS_OF, STALE_AS_OF, cashEvidence, constraints, marketEvidence, position, snapshot } from '../fixtures'
import { buildEvidence } from '../integrity'

describe('C. data integrity', () => {
  it('accepts a fresh personal snapshot', () => {
    const result = validateSnapshot(snapshot(), AS_OF, constraints())
    expect(result.ok).toBe(true)
  })

  it('fails closed on missing and malformed values', () => {
    const missing = validateSnapshot({ id: 'x' }, AS_OF, constraints())
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.code).toBe('MALFORMED')
    const badDate = validateSnapshot(snapshot({ asOf: '2026-02-31' }), '2026-02-31', constraints())
    expect(badDate.ok).toBe(false)
  })

  it('rejects stale prices, duplicates, negative quantities, and bad currency', () => {
    const staleEvidence = marketEvidence({
      id: 'ev-old',
      instrumentId: 'SYN-OLD',
      marketValueMinor: 2_000,
      observedAt: STALE_AS_OF,
    })
    const stale = validateSnapshot(
      snapshot({
        positions: [
          position({
            id: 'p-old',
            instrumentId: 'SYN-OLD',
            marketValueMinor: 2_000,
            exposureGroupId: 'old',
            evidenceId: 'ev-old',
          }),
        ],
        evidence: [staleEvidence, cashEvidence(8_000)],
        cashMinor: 8_000,
      }),
      AS_OF,
      constraints({ maxPositionWeightBps: 10_000, maxGroupWeightBps: 10_000 }),
    )
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.code).toBe('STALE_EVIDENCE')

    const base = snapshot()
    const duplicate = validateSnapshot(
      { ...base, positions: [...base.positions, base.positions[0]] },
      AS_OF,
      constraints(),
    )
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.code).toBe('DUPLICATE_POSITION')

    const negative = validateSnapshot(
      {
        ...base,
        positions: [{ ...base.positions[0], quantity: -1 }],
      },
      AS_OF,
      constraints(),
    )
    expect(negative.ok).toBe(false)

    const mixed = validateSnapshot(
      {
        ...base,
        positions: [{ ...base.positions[0], currency: 'USD' }],
      },
      AS_OF,
      constraints(),
    )
    expect(mixed.ok).toBe(false)
    if (!mixed.ok) expect(mixed.code).toBe('INCONSISTENT_CURRENCY')
  })

  it('rejects contradictory facts and a tampered hash', () => {
    const first = marketEvidence({ id: 'ev-eq', instrumentId: 'SYN-EQ', marketValueMinor: 3_000 })
    const second = marketEvidence({ id: 'ev-eq-2', instrumentId: 'SYN-EQ', marketValueMinor: 9_000 })
    const base = snapshot()
    const contradictory = validateSnapshot(
      { ...base, evidence: [...base.evidence, second] },
      AS_OF,
      constraints(),
    )
    expect(contradictory.ok).toBe(false)
    if (!contradictory.ok) expect(contradictory.code).toBe('CONTRADICTORY_EVIDENCE')
    expect(first.payload.marketValueMinor).toBe(3_000)

    const tampered = buildEvidence({
      id: 'ev-bad',
      epistemicClass: 'FACT',
      sourceType: 'CUSTODIAN_STATEMENT',
      sourceName: 'synthetic-custodian',
      observedAt: AS_OF,
      origin: 'EXTERNAL',
      payload: { instrumentId: 'SYN-EQ', marketValueMinor: 3_000, currency: 'CAD' },
    })
    const broken = validateSnapshot(
      snapshot({
        positions: [
          position({
            id: 'p-eq',
            instrumentId: 'SYN-EQ',
            marketValueMinor: 3_000,
            exposureGroupId: 'equity',
            evidenceId: 'ev-bad',
          }),
        ],
        evidence: [{ ...tampered, contentHash: 'a'.repeat(64) }, cashEvidence(7_000)],
        cashMinor: 7_000,
      }),
      AS_OF,
      constraints({ maxPositionWeightBps: 10_000, maxGroupWeightBps: 10_000 }),
    )
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.code).toBe('MALFORMED')
  })
})
