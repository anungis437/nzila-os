import { describe, expect, it } from 'vitest'

import { validateSnapshot } from '../integrity'
import {
  AS_OF,
  STALE_AS_OF,
  cashEvidence,
  constraints,
  issuerEvidence,
  marketEvidence,
  position,
  snapshot,
} from '../fixtures'
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

  it('refuses distinct instrument ids that have no issuer evidence', () => {
    const seriesA = marketEvidence({ id: 'ev-aaa', instrumentId: 'AAA', marketValueMinor: 2_000 })
    const seriesB = marketEvidence({ id: 'ev-bbb', instrumentId: 'BBB', marketValueMinor: 2_000 })
    const unproven = validateSnapshot(
      snapshot({
        positions: [
          position({
            id: 'p-aaa',
            instrumentId: 'AAA',
            marketValueMinor: 2_000,
            exposureGroupId: 'group-a',
            evidenceId: 'ev-aaa',
          }),
          position({
            id: 'p-bbb',
            instrumentId: 'BBB',
            marketValueMinor: 2_000,
            exposureGroupId: 'group-b',
            evidenceId: 'ev-bbb',
          }),
        ],
        evidence: [seriesA, seriesB, cashEvidence(2_000)],
        cashMinor: 2_000,
      }),
      AS_OF,
      constraints({ maxPositionWeightBps: 4_000, maxGroupWeightBps: 5_000, minLiquidityMinor: 0 }),
    )
    expect(unproven.ok).toBe(false)
    if (!unproven.ok) expect(unproven.code).toBe('CONCENTRATION_UNPROVEN')

    const issuerA = issuerEvidence({ id: 'issuer-aaa', instrumentId: 'AAA', issuerId: 'issuer:same' })
    const issuerB = issuerEvidence({ id: 'issuer-bbb', instrumentId: 'BBB', issuerId: 'issuer:same' })
    const sameIssuer = validateSnapshot(
      snapshot({
        positions: [
          position({
            id: 'p-aaa',
            instrumentId: 'AAA',
            marketValueMinor: 2_000,
            exposureGroupId: 'group-a',
            evidenceId: 'ev-aaa',
            issuerEvidenceId: 'issuer-aaa',
          }),
          position({
            id: 'p-bbb',
            instrumentId: 'BBB',
            marketValueMinor: 2_000,
            exposureGroupId: 'group-b',
            evidenceId: 'ev-bbb',
            issuerEvidenceId: 'issuer-bbb',
          }),
        ],
        evidence: [seriesA, seriesB, issuerA, issuerB, cashEvidence(2_000)],
        cashMinor: 2_000,
      }),
      AS_OF,
      constraints({ maxPositionWeightBps: 4_000, maxGroupWeightBps: 5_000, minLiquidityMinor: 0 }),
    )
    expect(sameIssuer.ok).toBe(false)
    if (!sameIssuer.ok) expect(sameIssuer.code).toBe('CONCENTRATION_BREACH')

    const issuerOther = issuerEvidence({ id: 'issuer-bbb', instrumentId: 'BBB', issuerId: 'issuer:other' })
    const distinct = validateSnapshot(
      snapshot({
        positions: [
          position({
            id: 'p-aaa',
            instrumentId: 'AAA',
            marketValueMinor: 2_000,
            exposureGroupId: 'group-a',
            evidenceId: 'ev-aaa',
            issuerEvidenceId: 'issuer-aaa',
          }),
          position({
            id: 'p-bbb',
            instrumentId: 'BBB',
            marketValueMinor: 2_000,
            exposureGroupId: 'group-b',
            evidenceId: 'ev-bbb',
            issuerEvidenceId: 'issuer-bbb',
          }),
        ],
        evidence: [seriesA, seriesB, issuerA, issuerOther, cashEvidence(2_000)],
        cashMinor: 2_000,
      }),
      AS_OF,
      constraints({ maxPositionWeightBps: 4_000, maxGroupWeightBps: 5_000, minLiquidityMinor: 0 }),
    )
    expect(distinct.ok).toBe(true)
  })
})
