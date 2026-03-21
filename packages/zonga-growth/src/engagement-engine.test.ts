import { describe, it, expect } from 'vitest'
import {
  computeRegionalChart,
  computeVelocityRanking,
  scoreFanEngagement,
  computeCreatorMomentum,
} from './engagement-engine'
import type {
  RegionalChartInput,
  VelocityInput,
  FanEngagementInput,
  CreatorMomentumInput,
} from './engagement-engine'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeChartInput(overrides?: Partial<RegionalChartInput>): RegionalChartInput {
  return {
    assetId: 'track-1',
    creatorId: 'creator-1',
    streams: 100,
    uniqueListeners: 80,
    saves: 20,
    ...overrides,
  }
}

function makeVelocityInput(overrides?: Partial<VelocityInput>): VelocityInput {
  return {
    assetId: 'track-1',
    currentPeriodStreams: 1000,
    previousPeriodStreams: 800,
    priorPeriodStreams: 600,
    ...overrides,
  }
}

function makeFanInput(overrides?: Partial<FanEngagementInput>): FanEngagementInput {
  return {
    listenerId: 'listener-1',
    creatorId: 'creator-1',
    totalStreams: 0,
    uniqueTracks: 0,
    shares: 0,
    eventAttendances: 0,
    tipCount: 0,
    tipAmountMinor: 0,
    ...overrides,
  }
}

function makeMomentumInput(overrides?: Partial<CreatorMomentumInput>): CreatorMomentumInput {
  return {
    creatorId: 'creator-1',
    currentFollowers: 1000,
    previousFollowers: 900,
    currentStreams: 5000,
    previousStreams: 4000,
    currentEngagements: 200,
    totalListeners: 1000,
    currentRevenueMinor: 10000,
    previousRevenueMinor: 8000,
    ...overrides,
  }
}

// ── Regional Chart ──────────────────────────────────────────────────────────

describe('computeRegionalChart', () => {
  it('returns empty for empty input', () => {
    expect(computeRegionalChart('NG', [])).toEqual([])
  })

  it('ranks assets by weighted score (saves > listeners > streams)', () => {
    const assets = [
      makeChartInput({ assetId: 'low', streams: 100, uniqueListeners: 10, saves: 1 }),
      makeChartInput({ assetId: 'high', streams: 50, uniqueListeners: 50, saves: 50 }),
    ]
    const chart = computeRegionalChart('NG', assets)
    expect(chart[0]!.assetId).toBe('high')
    expect(chart[0]!.rank).toBe(1)
    expect(chart[1]!.assetId).toBe('low')
    expect(chart[1]!.rank).toBe(2)
  })

  it('uses assetId for deterministic tie-breaking', () => {
    const assets = [
      makeChartInput({ assetId: 'b-track', streams: 100, uniqueListeners: 100, saves: 100 }),
      makeChartInput({ assetId: 'a-track', streams: 100, uniqueListeners: 100, saves: 100 }),
    ]
    const chart = computeRegionalChart('KE', assets)
    // Tie — sorted by assetId ascending
    expect(chart[0]!.assetId).toBe('a-track')
    expect(chart[1]!.assetId).toBe('b-track')
  })

  it('respects limit parameter', () => {
    const assets = Array.from({ length: 10 }, (_, i) =>
      makeChartInput({ assetId: `track-${i}`, streams: 100 - i }),
    )
    const chart = computeRegionalChart('ZA', assets, 3)
    expect(chart).toHaveLength(3)
  })

  it('includes region in output entries', () => {
    const chart = computeRegionalChart('GH', [makeChartInput()])
    expect(chart[0]!.region).toBe('GH')
  })

  it('produces deterministic results across calls', () => {
    const assets = [
      makeChartInput({ assetId: 'x', streams: 200, uniqueListeners: 100, saves: 50 }),
      makeChartInput({ assetId: 'y', streams: 150, uniqueListeners: 120, saves: 60 }),
    ]
    const run1 = computeRegionalChart('NG', assets)
    const run2 = computeRegionalChart('NG', assets)
    expect(run1).toEqual(run2)
  })
})

// ── Velocity Ranking ────────────────────────────────────────────────────────

describe('computeVelocityRanking', () => {
  it('returns empty for empty input', () => {
    expect(computeVelocityRanking([])).toEqual([])
  })

  it('classifies rising tracks (velocity > 0.1)', () => {
    const input = makeVelocityInput({
      currentPeriodStreams: 2000,
      previousPeriodStreams: 1000,
    })
    const result = computeVelocityRanking([input])
    expect(result[0]!.direction).toBe('rising')
    expect(result[0]!.velocity).toBe(1)
  })

  it('classifies falling tracks (velocity < -0.1)', () => {
    const input = makeVelocityInput({
      currentPeriodStreams: 100,
      previousPeriodStreams: 1000,
    })
    const result = computeVelocityRanking([input])
    expect(result[0]!.direction).toBe('falling')
    expect(result[0]!.velocity).toBeLessThan(0)
  })

  it('classifies stable tracks (velocity near zero)', () => {
    const input = makeVelocityInput({
      currentPeriodStreams: 1000,
      previousPeriodStreams: 1000,
    })
    const result = computeVelocityRanking([input])
    expect(result[0]!.direction).toBe('stable')
  })

  it('sorts by velocity descending', () => {
    const inputs = [
      makeVelocityInput({ assetId: 'slow', currentPeriodStreams: 100, previousPeriodStreams: 1000 }),
      makeVelocityInput({ assetId: 'fast', currentPeriodStreams: 5000, previousPeriodStreams: 1000 }),
    ]
    const result = computeVelocityRanking(inputs)
    expect(result[0]!.assetId).toBe('fast')
    expect(result[1]!.assetId).toBe('slow')
  })

  it('handles zero previous streams without division error', () => {
    const input = makeVelocityInput({
      currentPeriodStreams: 100,
      previousPeriodStreams: 0,
      priorPeriodStreams: 0,
    })
    const result = computeVelocityRanking([input])
    expect(result[0]!.velocity).toBeGreaterThan(0)
    expect(Number.isFinite(result[0]!.velocity)).toBe(true)
  })

  it('respects limit', () => {
    const inputs = Array.from({ length: 10 }, (_, i) =>
      makeVelocityInput({ assetId: `t-${i}` }),
    )
    expect(computeVelocityRanking(inputs, 3)).toHaveLength(3)
  })
})

// ── Fan Engagement Scoring ──────────────────────────────────────────────────

describe('scoreFanEngagement', () => {
  it('scores zero for zero activity', () => {
    const result = scoreFanEngagement(makeFanInput())
    expect(result.score).toBe(0)
    expect(result.tier).toBe('casual')
  })

  it('assigns casual tier for low engagement', () => {
    const result = scoreFanEngagement(makeFanInput({ totalStreams: 5 }))
    expect(result.tier).toBe('casual')
    expect(result.score).toBeLessThan(20)
  })

  it('assigns champion tier for maximum engagement', () => {
    const result = scoreFanEngagement(makeFanInput({
      totalStreams: 500,
      uniqueTracks: 50,
      shares: 20,
      eventAttendances: 10,
      tipCount: 10,
      tipAmountMinor: 50000,
    }))
    expect(result.tier).toBe('champion')
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('gives more weight to tips and events than streams', () => {
    const streamsOnly = scoreFanEngagement(makeFanInput({ totalStreams: 100 }))
    const tipsOnly = scoreFanEngagement(makeFanInput({ tipCount: 5 }))
    // Tips have 6x weight vs 1x for streams — fewer tip interactions score higher
    expect(tipsOnly.score).toBeGreaterThanOrEqual(streamsOnly.score)
  })

  it('returns score in 0-100 range', () => {
    const result = scoreFanEngagement(makeFanInput({
      totalStreams: 99999,
      uniqueTracks: 99999,
      shares: 99999,
      eventAttendances: 99999,
      tipCount: 99999,
      tipAmountMinor: 999999999,
    }))
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('preserves input fields in output', () => {
    const input = makeFanInput({ listenerId: 'L1', creatorId: 'C1', totalStreams: 42 })
    const result = scoreFanEngagement(input)
    expect(result.listenerId).toBe('L1')
    expect(result.creatorId).toBe('C1')
    expect(result.totalStreams).toBe(42)
  })

  it('includes ISO timestamp in computedAt', () => {
    const result = scoreFanEngagement(makeFanInput())
    expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ── Creator Momentum ────────────────────────────────────────────────────────

describe('computeCreatorMomentum', () => {
  it('detects accelerating creators', () => {
    const result = computeCreatorMomentum(makeMomentumInput({
      currentFollowers: 2000,
      previousFollowers: 1000,
      currentStreams: 10000,
      previousStreams: 5000,
      currentRevenueMinor: 20000,
      previousRevenueMinor: 10000,
    }))
    expect(result.direction).toBe('accelerating')
    expect(result.overallMomentum).toBeGreaterThan(0.05)
  })

  it('detects decelerating creators', () => {
    const result = computeCreatorMomentum(makeMomentumInput({
      currentFollowers: 500,
      previousFollowers: 1000,
      currentStreams: 2000,
      previousStreams: 5000,
      currentRevenueMinor: 3000,
      previousRevenueMinor: 10000,
    }))
    expect(result.direction).toBe('decelerating')
    expect(result.overallMomentum).toBeLessThan(-0.05)
  })

  it('detects steady creators', () => {
    const result = computeCreatorMomentum(makeMomentumInput({
      currentFollowers: 1000,
      previousFollowers: 1000,
      currentStreams: 5000,
      previousStreams: 5000,
      currentEngagements: 0,
      totalListeners: 1,
      currentRevenueMinor: 10000,
      previousRevenueMinor: 10000,
    }))
    expect(result.direction).toBe('steady')
  })

  it('handles zero previous values without NaN', () => {
    const result = computeCreatorMomentum(makeMomentumInput({
      previousFollowers: 0,
      previousStreams: 0,
      previousRevenueMinor: 0,
    }))
    expect(Number.isFinite(result.overallMomentum)).toBe(true)
    expect(Number.isFinite(result.followerGrowthRate)).toBe(true)
  })

  it('rounds all rates to 4 decimal places', () => {
    const result = computeCreatorMomentum(makeMomentumInput())
    const decimals = (n: number) => {
      const s = n.toString()
      const d = s.indexOf('.')
      return d === -1 ? 0 : s.length - d - 1
    }
    expect(decimals(result.followerGrowthRate)).toBeLessThanOrEqual(4)
    expect(decimals(result.streamGrowthRate)).toBeLessThanOrEqual(4)
    expect(decimals(result.overallMomentum)).toBeLessThanOrEqual(4)
  })
})
