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

// ── computeRegionalChart ────────────────────────────────────────────────────

describe('computeRegionalChart', () => {
  it('returns empty for empty input', () => {
    expect(computeRegionalChart('africa-east', [])).toEqual([])
  })

  it('ranks assets by weighted score (saves > listeners > streams)', () => {
    const assets: RegionalChartInput[] = [
      { assetId: 'a1', creatorId: 'c1', streams: 100, uniqueListeners: 50, saves: 10 },
      { assetId: 'a2', creatorId: 'c2', streams: 50, uniqueListeners: 80, saves: 20 },
    ]

    const chart = computeRegionalChart('africa-east', assets)
    expect(chart).toHaveLength(2)
    // a2 should rank higher: fewer streams but more listeners (2x weight) and more saves (3x weight)
    expect(chart[0]!.rank).toBe(1)
    expect(chart[0]!.assetId).toBe('a2')
    expect(chart[1]!.rank).toBe(2)
    expect(chart[1]!.assetId).toBe('a1')
  })

  it('respects limit', () => {
    const assets: RegionalChartInput[] = Array.from({ length: 10 }, (_, i) => ({
      assetId: `a${i}`,
      creatorId: `c${i}`,
      streams: 100 - i * 10,
      uniqueListeners: 50,
      saves: 5,
    }))

    const chart = computeRegionalChart('global', assets, 3)
    expect(chart).toHaveLength(3)
    expect(chart[0]!.rank).toBe(1)
    expect(chart[2]!.rank).toBe(3)
  })

  it('includes region in output', () => {
    const assets: RegionalChartInput[] = [
      { assetId: 'a1', creatorId: 'c1', streams: 10, uniqueListeners: 5, saves: 1 },
    ]
    const chart = computeRegionalChart('africa-west', assets)
    expect(chart[0]!.region).toBe('africa-west')
  })

  it('breaks ties deterministically by assetId', () => {
    const assets: RegionalChartInput[] = [
      { assetId: 'b1', creatorId: 'c1', streams: 100, uniqueListeners: 50, saves: 10 },
      { assetId: 'a1', creatorId: 'c2', streams: 100, uniqueListeners: 50, saves: 10 },
    ]
    const chart = computeRegionalChart('global', assets)
    expect(chart[0]!.assetId).toBe('a1') // 'a1' < 'b1' lexicographically
  })
})

// ── computeVelocityRanking ──────────────────────────────────────────────────

describe('computeVelocityRanking', () => {
  it('returns empty for empty input', () => {
    expect(computeVelocityRanking([])).toEqual([])
  })

  it('classifies rising, stable, and falling', () => {
    const inputs: VelocityInput[] = [
      { assetId: 'rising', currentPeriodStreams: 200, previousPeriodStreams: 100, priorPeriodStreams: 50 },
      { assetId: 'stable', currentPeriodStreams: 100, previousPeriodStreams: 100, priorPeriodStreams: 100 },
      { assetId: 'falling', currentPeriodStreams: 50, previousPeriodStreams: 100, priorPeriodStreams: 150 },
    ]

    const ranked = computeVelocityRanking(inputs)
    expect(ranked[0]!.assetId).toBe('rising')
    expect(ranked[0]!.direction).toBe('rising')
    expect(ranked.find((r) => r.assetId === 'stable')?.direction).toBe('stable')
    expect(ranked.find((r) => r.assetId === 'falling')?.direction).toBe('falling')
  })

  it('handles zero previous streams (division safety)', () => {
    const inputs: VelocityInput[] = [
      { assetId: 'new', currentPeriodStreams: 100, previousPeriodStreams: 0, priorPeriodStreams: 0 },
    ]
    const ranked = computeVelocityRanking(inputs)
    expect(ranked[0]!.direction).toBe('rising')
    expect(ranked[0]!.velocity).toBeGreaterThan(0)
  })

  it('respects limit', () => {
    const inputs: VelocityInput[] = Array.from({ length: 10 }, (_, i) => ({
      assetId: `a${i}`,
      currentPeriodStreams: 100 + i * 50,
      previousPeriodStreams: 100,
      priorPeriodStreams: 100,
    }))

    const ranked = computeVelocityRanking(inputs, 3)
    expect(ranked).toHaveLength(3)
  })

  it('computes acceleration as velocity change', () => {
    const inputs: VelocityInput[] = [
      { assetId: 'x', currentPeriodStreams: 300, previousPeriodStreams: 200, priorPeriodStreams: 100 },
    ]
    const ranked = computeVelocityRanking(inputs)
    // velocity = (300-200)/200 = 0.5, prevVelocity = (200-100)/100 = 1.0, acceleration = -0.5
    expect(ranked[0]!.acceleration).toBe(-0.5)
  })
})

// ── scoreFanEngagement ──────────────────────────────────────────────────────

describe('scoreFanEngagement', () => {
  const baseInput: FanEngagementInput = {
    listenerId: 'listener-1',
    creatorId: 'creator-1',
    totalStreams: 0,
    uniqueTracks: 0,
    shares: 0,
    eventAttendances: 0,
    tipCount: 0,
    tipAmountMinor: 0,
  }

  it('returns 0 score for zero engagement', () => {
    const result = scoreFanEngagement(baseInput)
    expect(result.score).toBe(0)
    expect(result.tier).toBe('casual')
  })

  it('classifies casual fans', () => {
    const result = scoreFanEngagement({ ...baseInput, totalStreams: 10, uniqueTracks: 2 })
    expect(result.tier).toBe('casual')
    expect(result.score).toBeLessThan(20)
  })

  it('classifies superfan with high engagement', () => {
    const result = scoreFanEngagement({
      ...baseInput,
      totalStreams: 150,
      uniqueTracks: 20,
      shares: 8,
      eventAttendances: 4,
      tipCount: 2,
    })
    expect(result.tier).toBe('superfan')
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.score).toBeLessThan(80)
  })

  it('classifies champion with maximum engagement', () => {
    const result = scoreFanEngagement({
      ...baseInput,
      totalStreams: 500,
      uniqueTracks: 50,
      shares: 20,
      eventAttendances: 10,
      tipCount: 10,
      tipAmountMinor: 50000,
    })
    expect(result.tier).toBe('champion')
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('returns all input fields in result', () => {
    const result = scoreFanEngagement({ ...baseInput, totalStreams: 50 })
    expect(result.listenerId).toBe('listener-1')
    expect(result.creatorId).toBe('creator-1')
    expect(result.computedAt).toBeTruthy()
  })
})

// ── computeCreatorMomentum ──────────────────────────────────────────────────

describe('computeCreatorMomentum', () => {
  const baseInput: CreatorMomentumInput = {
    creatorId: 'creator-1',
    currentFollowers: 100,
    previousFollowers: 100,
    currentStreams: 1000,
    previousStreams: 1000,
    currentEngagements: 50,
    totalListeners: 500,
    currentRevenueMinor: 10000,
    previousRevenueMinor: 10000,
  }

  it('returns steady when no change', () => {
    const result = computeCreatorMomentum(baseInput)
    expect(result.direction).toBe('steady')
    expect(result.overallMomentum).toBeCloseTo(0.02, 1) // 50/500=0.1 engagement rate × 0.2 weight
  })

  it('returns accelerating when growing', () => {
    const result = computeCreatorMomentum({
      ...baseInput,
      currentFollowers: 200,
      currentStreams: 2000,
      currentRevenueMinor: 20000,
    })
    expect(result.direction).toBe('accelerating')
    expect(result.followerGrowthRate).toBe(1) // 100/100
    expect(result.streamGrowthRate).toBe(1)
  })

  it('returns decelerating when declining', () => {
    const result = computeCreatorMomentum({
      ...baseInput,
      currentFollowers: 50,
      currentStreams: 500,
      currentRevenueMinor: 5000,
    })
    expect(result.direction).toBe('decelerating')
  })

  it('handles zero previous values', () => {
    const result = computeCreatorMomentum({
      ...baseInput,
      previousFollowers: 0,
      previousStreams: 0,
      previousRevenueMinor: 0,
    })
    // growth rate = 1 when previous = 0 and current > 0
    expect(result.followerGrowthRate).toBe(1)
    expect(result.streamGrowthRate).toBe(1)
  })

  it('handles zero total listeners (no engagement rate)', () => {
    const result = computeCreatorMomentum({
      ...baseInput,
      totalListeners: 0,
    })
    expect(result.engagementRate).toBe(0)
  })
})
