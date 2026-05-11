import { describe, expect, it } from 'vitest'
import {
  classifyClaimBatch,
  computeMandateRiskScore,
  MANDATE_RISK_BANDS,
} from './index'

describe('computeMandateRiskScore', () => {
  it('returns a low band for a brand-new mandate with zero risk signals', () => {
    const result = computeMandateRiskScore({
      currentStage: 'mandate_intake',
      daysSinceIntake: 0,
      creditorCount: 0,
      totalClaimAmountCents: 0,
      contestedClaimCount: 0,
      missedDeadlineCount: 0,
    })
    expect(result.score).toBe(0)
    expect(result.band).toBe('low')
    expect(result.drivers).toHaveLength(0)
    expect(result.stage).toBe('mandate_intake')
    expect(result.progress).toBe(0)
  })

  it('caps individual driver weights so a single signal cannot dominate', () => {
    const result = computeMandateRiskScore({
      currentStage: 'claims_classification',
      daysSinceIntake: 0,
      creditorCount: 0,
      totalClaimAmountCents: 0,
      contestedClaimCount: 0,
      missedDeadlineCount: 99,
    })
    const missed = result.drivers.find((d) => d.code === 'missed_deadlines')
    expect(missed?.weight).toBe(36)
    expect(result.score).toBe(36)
    expect(result.band).toBe('medium')
  })

  it('escalates to a critical band when many signals stack', () => {
    const result = computeMandateRiskScore({
      currentStage: 'court_filing',
      daysSinceIntake: 365,
      creditorCount: 150,
      totalClaimAmountCents: 1_000_000_000,
      contestedClaimCount: 20,
      missedDeadlineCount: 5,
    })
    expect(result.score).toBe(100)
    expect(result.band).toBe('critical')
    expect(result.drivers.map((d) => d.code).sort()).toEqual(
      ['aging', 'contested_claims', 'creditor_concentration', 'high_value_mandate', 'missed_deadlines'].sort(),
    )
  })

  it('produces a band from the documented ladder', () => {
    const result = computeMandateRiskScore({
      currentStage: 'distribution',
      daysSinceIntake: 200,
      creditorCount: 30,
      totalClaimAmountCents: 0,
      contestedClaimCount: 6,
      missedDeadlineCount: 1,
    })
    expect(MANDATE_RISK_BANDS).toContain(result.band)
    expect(result.band).toBe('high')
  })

  it('rejects negative inputs via zod', () => {
    expect(() =>
      computeMandateRiskScore({
        currentStage: 'mandate_intake',
        daysSinceIntake: -1,
        creditorCount: 0,
        totalClaimAmountCents: 0,
        contestedClaimCount: 0,
        missedDeadlineCount: 0,
      }),
    ).toThrow()
  })
})

describe('classifyClaimBatch', () => {
  it('returns an empty result for an empty batch', () => {
    const result = classifyClaimBatch({ items: [] })
    expect(result.itemCount).toBe(0)
    expect(result.totalAmountCents).toBe(0)
    expect(result.admittedAmountCents).toBe(0)
    expect(result.statusCounts).toEqual({ open: 0, admitted: 0, other: 0 })
    expect(result.breakdown).toEqual([])
  })

  it('aggregates counts, totals and admitted amounts per classification', () => {
    const result = classifyClaimBatch({
      items: [
        { classification: 'secured', status: 'admitted', amountCents: 1_000_00 },
        { classification: 'secured', status: 'submitted', amountCents: 500_00 },
        { classification: 'unsecured', status: 'partially_admitted', amountCents: 300_00 },
        { classification: 'unsecured', status: 'rejected', amountCents: 200_00 },
        { classification: 'priority', status: 'under_review', amountCents: 100_00 },
      ],
    })

    expect(result.itemCount).toBe(5)
    expect(result.totalAmountCents).toBe(2_100_00)
    expect(result.admittedAmountCents).toBe(1_300_00)
    expect(result.statusCounts).toEqual({ open: 2, admitted: 2, other: 1 })

    const secured = result.breakdown.find((b) => b.classification === 'secured')
    expect(secured?.count).toBe(2)
    expect(secured?.totalAmountCents).toBe(1_500_00)
    expect(secured?.admittedAmountCents).toBe(1_000_00)
  })

  it('sorts breakdown entries by creditor priority order', () => {
    const result = classifyClaimBatch({
      items: [
        { classification: 'subordinated', status: 'submitted', amountCents: 10_00 },
        { classification: 'priority', status: 'submitted', amountCents: 10_00 },
        { classification: 'secured', status: 'submitted', amountCents: 10_00 },
        { classification: 'unsecured', status: 'submitted', amountCents: 10_00 },
        { classification: 'equity', status: 'submitted', amountCents: 10_00 },
      ],
    })
    expect(result.breakdown.map((b) => b.classification)).toEqual([
      'secured',
      'priority',
      'unsecured',
      'subordinated',
      'equity',
    ])
  })

  it('computes percentOfBatch with two decimals of precision', () => {
    const result = classifyClaimBatch({
      items: [
        { classification: 'secured', status: 'admitted', amountCents: 750 },
        { classification: 'unsecured', status: 'admitted', amountCents: 250 },
      ],
    })
    const secured = result.breakdown.find((b) => b.classification === 'secured')
    const unsecured = result.breakdown.find((b) => b.classification === 'unsecured')
    expect(secured?.percentOfBatch).toBe(75)
    expect(unsecured?.percentOfBatch).toBe(25)
  })

  it('rejects negative amounts via zod', () => {
    expect(() =>
      classifyClaimBatch({
        items: [{ classification: 'secured', status: 'admitted', amountCents: -1 }],
      }),
    ).toThrow()
  })
})
