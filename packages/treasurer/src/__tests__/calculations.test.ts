import { describe, expect, it } from 'vitest'

import {
  acceptScenarioForDecision,
  allocateMinor,
  applyScenario,
  benchmarkExcess,
  envelopeUnreleased,
  holdingPeriodReturnBps,
  maxDrawdownBps,
  opportunityCostBps,
} from '../calculations'
import { createEnvelope, releaseEnvelope } from '../envelope'
import { validateSnapshot } from '../integrity'
import { AS_OF, cashEvidence, constraints, marketEvidence, position, snapshot } from '../fixtures'

describe('D. financial calculations', () => {
  it('allocates with largest remainder and a deterministic tie break', () => {
    const split = allocateMinor(100, [
      { id: 'a', bps: 3333 },
      { id: 'b', bps: 3333 },
      { id: 'c', bps: 3334 },
    ])
    expect(split.ok).toBe(true)
    if (split.ok) expect(split.value.map((row) => row.minor)).toEqual([33, 33, 34])
    const tie = allocateMinor(1, [
      { id: 'b', bps: 5000 },
      { id: 'a', bps: 5000 },
    ])
    expect(tie.ok).toBe(true)
    if (tie.ok) expect(tie.value).toEqual([{ id: 'b', minor: 0 }, { id: 'a', minor: 1 }])
    expect(allocateMinor(10, [{ id: 'a', bps: 4000 }]).ok).toBe(false)
  })

  it('computes return, benchmark excess, opportunity cost, and drawdown', () => {
    const ret = holdingPeriodReturnBps(10_000, 11_000)
    expect(ret.ok && ret.value).toBe(1000)
    expect(holdingPeriodReturnBps(0, 10).ok).toBe(false)
    const excess = benchmarkExcess({
      portfolioReturnBps: 1000,
      portfolioClass: 'FACT',
      portfolioPeriodStart: '2026-01-01',
      portfolioPeriodEnd: '2026-09-01',
      portfolioCurrency: 'CAD',
      benchmark: {
        id: 'b',
        name: 'bench',
        epistemicClass: 'FACT',
        returnBps: 800,
        periodStart: '2026-01-01',
        periodEnd: '2026-09-01',
        currency: 'CAD',
        evidenceId: 'e',
      },
    })
    expect(excess.ok && excess.value).toEqual({ excessBps: 200, epistemicClass: 'FACT' })
    const cost = opportunityCostBps({
      chosenReturnBps: 1000,
      chosenClass: 'FACT',
      alternativeReturnBps: 1500,
      alternativeClass: 'FACT',
    })
    expect(cost.ok && cost.value).toEqual({ costBps: 500, epistemicClass: 'ESTIMATE' })
    const drawdown = maxDrawdownBps([100, 120, 90])
    expect(drawdown.ok && drawdown.value).toBe(-2500)
    expect(maxDrawdownBps([]).ok).toBe(false)
    expect(maxDrawdownBps([10, -1]).ok).toBe(false)
  })

  it('rejects a benchmark whose period or currency does not match', () => {
    const mismatch = benchmarkExcess({
      portfolioReturnBps: 100,
      portfolioClass: 'ESTIMATE',
      portfolioPeriodStart: '2026-01-01',
      portfolioPeriodEnd: '2026-06-01',
      portfolioCurrency: 'CAD',
      benchmark: {
        id: 'b',
        name: 'bench',
        epistemicClass: 'ESTIMATE',
        returnBps: 100,
        periodStart: '2026-01-01',
        periodEnd: '2026-07-01',
        currency: 'USD',
        evidenceId: 'e',
      },
    })
    expect(mismatch.ok).toBe(false)
  })

  it('computes envelope release without authorizing or committing capital', () => {
    const unreleased = envelopeUnreleased(100_000, 25_000)
    expect(unreleased.ok).toBe(true)
    if (unreleased.ok) expect(unreleased.value).toBe(75_000)
    expect(envelopeUnreleased(10, 11).ok).toBe(false)
    const created = createEnvelope({
      id: 'env',
      currency: 'CAD',
      ceilingMinor: 100_000,
      benchmarkAlternativeId: 'bench-1',
      evidenceGateIds: ['g'],
      thesisId: 'thesis-1',
      downsideCaseIds: ['d'],
      impairmentScenarioIds: ['i'],
      liquidityNote: 'planning only',
      concentrationNote: 'ceiling still applies',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value.investmentAuthorized).toBe(false)
    expect(created.value.transactionExecuted).toBe(false)
    expect(created.value.committedMinor).toBe(0)
    const released = releaseEnvelope(created.value, 25_000)
    expect(released.ok).toBe(true)
    if (!released.ok) return
    expect(released.value.unreleasedMinor).toBe(75_000)
    expect(released.value.investmentAuthorized).toBe(false)
    expect(released.value.committedMinor).toBe(0)
    expect(released.value.transactionExecuted).toBe(false)
  })

  it('aggregates disguised concentration across a shared exposure group', () => {
    const rows = ['a', 'b', 'c', 'd'].map((suffix) => ({
      evidence: marketEvidence({ id: `ev-${suffix}`, instrumentId: `SYN-${suffix}`, marketValueMinor: 2_000 }),
      position: position({
        id: `p-${suffix}`,
        instrumentId: `SYN-${suffix}`,
        marketValueMinor: 2_000,
        exposureGroupId: 'same-issuer',
        evidenceId: `ev-${suffix}`,
      }),
    }))
    const result = validateSnapshot(
      snapshot({
        positions: rows.map((row) => row.position),
        evidence: [...rows.map((row) => row.evidence), cashEvidence(2_000)],
        cashMinor: 2_000,
      }),
      AS_OF,
      constraints({ maxPositionWeightBps: 3_000, maxGroupWeightBps: 2_500, minLiquidityMinor: 0 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONCENTRATION_BREACH')
  })

  it('keeps scenario math labeled SCENARIO and rejects survivorship for decisions', () => {
    const applied = applyScenario(10_000, {
      id: 's',
      epistemicClass: 'SCENARIO',
      name: 'down',
      returnBps: -2_000,
      includesFailedPaths: true,
      droppedPathIds: [],
    })
    expect(applied.ok && applied.value).toEqual({ endMinor: 8_000, epistemicClass: 'SCENARIO' })
    const biased = acceptScenarioForDecision({
      id: 's',
      epistemicClass: 'SCENARIO',
      name: 'winners only',
      returnBps: 100,
      includesFailedPaths: false,
      droppedPathIds: ['loser'],
    })
    expect(biased.ok).toBe(false)
    if (!biased.ok) expect(biased.code).toBe('SURVIVORSHIP_BIAS')
  })
})
