import { describe, expect, it } from 'vitest'
import {
  classifyClaimBatch,
  computeMandateRiskScore,
  type ClaimBatchInput,
  type ClaimBatchResult,
  type MandateRiskInput,
  type MandateRiskResult,
} from './index'

/**
 * Scoring-parity contract test (verification gate 2/5).
 *
 * Locks the public scoring outputs of `@nzila/trustops-intelligence` against
 * frozen golden fixtures. ANY change to the scoring heuristic, weight ladder,
 * band thresholds, breakdown ordering, or precision will fail this test.
 *
 * If a deliberate algorithmic change ships, update the golden fixture in the
 * SAME commit and bump the package version per the platform contract policy.
 *
 * Stability invariant: identical inputs MUST always produce byte-identical
 * outputs across processes and TS/Node versions (no Date.now, no Math.random,
 * no Intl, no env reads).
 */

interface MandateRiskFixture {
  readonly name: string
  readonly input: MandateRiskInput
  readonly expected: {
    readonly score: number
    readonly band: MandateRiskResult['band']
    readonly progress: number
    readonly drivers: ReadonlyArray<{ code: string; weight: number }>
  }
}

const MANDATE_RISK_FIXTURES: ReadonlyArray<MandateRiskFixture> = [
  {
    name: 'zero-signal mandate at intake',
    input: {
      currentStage: 'mandate_intake',
      daysSinceIntake: 0,
      creditorCount: 0,
      totalClaimAmountCents: 0,
      contestedClaimCount: 0,
      missedDeadlineCount: 0,
    },
    expected: { score: 0, band: 'low', progress: 0, drivers: [] },
  },
  {
    name: 'aging-only mandate (29 days → 2 pts)',
    input: {
      currentStage: 'creditor_list_published',
      daysSinceIntake: 29,
      creditorCount: 0,
      totalClaimAmountCents: 0,
      contestedClaimCount: 0,
      missedDeadlineCount: 0,
    },
    expected: {
      score: 2,
      band: 'low',
      progress: 3 / 11,
      drivers: [{ code: 'aging', weight: 2 }],
    },
  },
  {
    name: 'medium band — contested + aging stack',
    input: {
      currentStage: 'claims_classification',
      daysSinceIntake: 100,
      creditorCount: 0,
      totalClaimAmountCents: 0,
      contestedClaimCount: 5,
      missedDeadlineCount: 0,
    },
    expected: {
      score: 30,
      band: 'medium',
      progress: 5 / 11,
      drivers: [
        { code: 'contested_claims', weight: 20 },
        { code: 'aging', weight: 10 },
      ],
    },
  },
  {
    name: 'high band — concentration + high-value + missed',
    input: {
      currentStage: 'distribution',
      daysSinceIntake: 200,
      creditorCount: 30,
      totalClaimAmountCents: 500_000_000,
      contestedClaimCount: 6,
      missedDeadlineCount: 1,
    },
    expected: {
      score: 71,
      band: 'high',
      progress: 9 / 11,
      drivers: [
        { code: 'missed_deadlines', weight: 12 },
        { code: 'contested_claims', weight: 24 },
        { code: 'aging', weight: 20 },
        { code: 'creditor_concentration', weight: 5 },
        { code: 'high_value_mandate', weight: 10 },
      ],
    },
  },
  {
    name: 'critical band — all signals saturated',
    input: {
      currentStage: 'court_filing',
      daysSinceIntake: 365,
      creditorCount: 150,
      totalClaimAmountCents: 1_000_000_000,
      contestedClaimCount: 20,
      missedDeadlineCount: 5,
    },
    expected: {
      score: 100,
      band: 'critical',
      progress: 8 / 11,
      drivers: [
        { code: 'missed_deadlines', weight: 36 },
        { code: 'contested_claims', weight: 24 },
        { code: 'aging', weight: 20 },
        { code: 'creditor_concentration', weight: 10 },
        { code: 'high_value_mandate', weight: 10 },
      ],
    },
  },
  {
    name: 'missed-deadline cap (3 deadlines → 36, medium band)',
    input: {
      currentStage: 'mandate_intake',
      daysSinceIntake: 0,
      creditorCount: 0,
      totalClaimAmountCents: 0,
      contestedClaimCount: 0,
      missedDeadlineCount: 3,
    },
    expected: {
      score: 36,
      band: 'medium',
      progress: 0,
      drivers: [{ code: 'missed_deadlines', weight: 36 }],
    },
  },
  {
    name: 'band threshold — exactly 61 is high',
    input: {
      currentStage: 'discharge',
      daysSinceIntake: 200,
      creditorCount: 25,
      totalClaimAmountCents: 0,
      contestedClaimCount: 0,
      missedDeadlineCount: 3,
    },
    expected: {
      score: 61,
      band: 'high',
      progress: 10 / 11,
      drivers: [
        { code: 'missed_deadlines', weight: 36 },
        { code: 'aging', weight: 20 },
        { code: 'creditor_concentration', weight: 5 },
      ],
    },
  },
  {
    name: 'high band — saturated drivers at terminal stage (76)',
    input: {
      currentStage: 'discharge',
      daysSinceIntake: 200,
      creditorCount: 100,
      totalClaimAmountCents: 500_000_000,
      contestedClaimCount: 0,
      missedDeadlineCount: 3,
    },
    expected: {
      score: 76,
      band: 'high',
      progress: 10 / 11,
      drivers: [
        { code: 'missed_deadlines', weight: 36 },
        { code: 'aging', weight: 20 },
        { code: 'creditor_concentration', weight: 10 },
        { code: 'high_value_mandate', weight: 10 },
      ],
    },
  },
]

interface ClaimBatchFixture {
  readonly name: string
  readonly input: ClaimBatchInput
  readonly expected: {
    readonly itemCount: number
    readonly totalAmountCents: number
    readonly admittedAmountCents: number
    readonly statusCounts: ClaimBatchResult['statusCounts']
    readonly breakdown: ReadonlyArray<{
      classification: string
      count: number
      totalAmountCents: number
      admittedAmountCents: number
      percentOfBatch: number
    }>
  }
}

const CLAIM_BATCH_FIXTURES: ReadonlyArray<ClaimBatchFixture> = [
  {
    name: 'empty batch',
    input: { items: [] },
    expected: {
      itemCount: 0,
      totalAmountCents: 0,
      admittedAmountCents: 0,
      statusCounts: { open: 0, admitted: 0, other: 0 },
      breakdown: [],
    },
  },
  {
    name: 'mixed-status secured + unsecured + priority',
    input: {
      items: [
        { classification: 'secured', status: 'admitted', amountCents: 1_000_00 },
        { classification: 'secured', status: 'submitted', amountCents: 500_00 },
        { classification: 'unsecured', status: 'partially_admitted', amountCents: 300_00 },
        { classification: 'unsecured', status: 'rejected', amountCents: 200_00 },
        { classification: 'priority', status: 'under_review', amountCents: 100_00 },
      ],
    },
    expected: {
      itemCount: 5,
      totalAmountCents: 210_000,
      admittedAmountCents: 130_000,
      statusCounts: { open: 2, admitted: 2, other: 1 },
      breakdown: [
        {
          classification: 'secured',
          count: 2,
          totalAmountCents: 150_000,
          admittedAmountCents: 100_000,
          percentOfBatch: 71.43,
        },
        {
          classification: 'priority',
          count: 1,
          totalAmountCents: 10_000,
          admittedAmountCents: 0,
          percentOfBatch: 4.76,
        },
        {
          classification: 'unsecured',
          count: 2,
          totalAmountCents: 50_000,
          admittedAmountCents: 30_000,
          percentOfBatch: 23.81,
        },
      ],
    },
  },
  {
    name: 'priority-order ordering across all five classes',
    input: {
      items: [
        { classification: 'subordinated', status: 'submitted', amountCents: 10_00 },
        { classification: 'priority', status: 'submitted', amountCents: 10_00 },
        { classification: 'secured', status: 'submitted', amountCents: 10_00 },
        { classification: 'unsecured', status: 'submitted', amountCents: 10_00 },
        { classification: 'equity', status: 'submitted', amountCents: 10_00 },
      ],
    },
    expected: {
      itemCount: 5,
      totalAmountCents: 5_000,
      admittedAmountCents: 0,
      statusCounts: { open: 5, admitted: 0, other: 0 },
      breakdown: [
        { classification: 'secured', count: 1, totalAmountCents: 1_000, admittedAmountCents: 0, percentOfBatch: 20 },
        { classification: 'priority', count: 1, totalAmountCents: 1_000, admittedAmountCents: 0, percentOfBatch: 20 },
        { classification: 'unsecured', count: 1, totalAmountCents: 1_000, admittedAmountCents: 0, percentOfBatch: 20 },
        { classification: 'subordinated', count: 1, totalAmountCents: 1_000, admittedAmountCents: 0, percentOfBatch: 20 },
        { classification: 'equity', count: 1, totalAmountCents: 1_000, admittedAmountCents: 0, percentOfBatch: 20 },
      ],
    },
  },
]

describe('scoring parity (gate 2/5) — computeMandateRiskScore', () => {
  for (const fixture of MANDATE_RISK_FIXTURES) {
    it(`golden: ${fixture.name}`, () => {
      const result = computeMandateRiskScore(fixture.input)
      expect(result.score).toBe(fixture.expected.score)
      expect(result.band).toBe(fixture.expected.band)
      expect(result.progress).toBe(fixture.expected.progress)
      expect(result.drivers.map((d) => ({ code: d.code, weight: d.weight }))).toEqual(
        fixture.expected.drivers,
      )
    })
  }

  it('is deterministic across repeated calls', () => {
    const input: MandateRiskInput = {
      currentStage: 'court_filing',
      daysSinceIntake: 137,
      creditorCount: 42,
      totalClaimAmountCents: 750_000_000,
      contestedClaimCount: 11,
      missedDeadlineCount: 2,
    }
    const a = computeMandateRiskScore(input)
    const b = computeMandateRiskScore(input)
    const c = computeMandateRiskScore(input)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(b)).toBe(JSON.stringify(c))
  })
})

describe('scoring parity (gate 2/5) — classifyClaimBatch', () => {
  for (const fixture of CLAIM_BATCH_FIXTURES) {
    it(`golden: ${fixture.name}`, () => {
      const result = classifyClaimBatch(fixture.input)
      expect(result.itemCount).toBe(fixture.expected.itemCount)
      expect(result.totalAmountCents).toBe(fixture.expected.totalAmountCents)
      expect(result.admittedAmountCents).toBe(fixture.expected.admittedAmountCents)
      expect(result.statusCounts).toEqual(fixture.expected.statusCounts)
      expect(
        result.breakdown.map((b) => ({
          classification: b.classification,
          count: b.count,
          totalAmountCents: b.totalAmountCents,
          admittedAmountCents: b.admittedAmountCents,
          percentOfBatch: b.percentOfBatch,
        })),
      ).toEqual(fixture.expected.breakdown)
    })
  }

  it('is deterministic across repeated calls', () => {
    const input: ClaimBatchInput = {
      items: [
        { classification: 'secured', status: 'admitted', amountCents: 12_345_67 },
        { classification: 'unsecured', status: 'submitted', amountCents: 9_876_54 },
        { classification: 'priority', status: 'partially_admitted', amountCents: 555_55 },
      ],
    }
    const a = classifyClaimBatch(input)
    const b = classifyClaimBatch(input)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
