import { describe, it, expect } from 'vitest'
import {
  suggestReleaseTiming,
  suggestPricing,
  generateGrowthStrategies,
  predictPerformance,
} from './creator-assist'
import type { CreatorAssistInput } from './creator-assist'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCreatorInput(overrides?: Partial<CreatorAssistInput>): CreatorAssistInput {
  return {
    creatorId: 'creator-1',
    totalTracks: 20,
    totalStreams: 5000,
    followerCount: 2000,
    avgStreamsPerTrack: 250,
    topRegions: ['NG', 'KE'],
    revenueLastMonthMinor: 10000,
    hasEvents: true,
    hasMerchandise: false,
    ...overrides,
  }
}

// ── Release Timing ──────────────────────────────────────────────────────────

describe('suggestReleaseTiming', () => {
  it('always suggests Friday', () => {
    const result = suggestReleaseTiming('c1', ['NG'])
    expect(result.suggestedDay).toBe('friday')
  })

  it('suggests 15 UTC for African regions', () => {
    const result = suggestReleaseTiming('c1', ['NG', 'KE'])
    expect(result.suggestedHourUtc).toBe(15)
    expect(result.reasoning).toContain('WAT')
  })

  it('suggests 12 UTC for non-African regions', () => {
    const result = suggestReleaseTiming('c1', ['US', 'GB'])
    expect(result.suggestedHourUtc).toBe(12)
  })

  it('uses African timing if any region is African', () => {
    const result = suggestReleaseTiming('c1', ['US', 'GH', 'GB'])
    expect(result.suggestedHourUtc).toBe(15)
  })

  it('returns confidence 0.7', () => {
    const result = suggestReleaseTiming('c1', ['NG'])
    expect(result.confidence).toBe(0.7)
  })
})

// ── Pricing Suggestions ────────────────────────────────────────────────────

describe('suggestPricing', () => {
  it('suggests low price for creators with < 1000 followers', () => {
    const result = suggestPricing('c1', 'track', 500)
    expect(result.suggestedPriceMinor).toBe(49) // $0.49
  })

  it('suggests mid price for creators with 1000-9999 followers', () => {
    const result = suggestPricing('c1', 'track', 5000)
    expect(result.suggestedPriceMinor).toBe(99) // $0.99
  })

  it('suggests high price for creators with 10000+ followers', () => {
    const result = suggestPricing('c1', 'track', 15000)
    expect(result.suggestedPriceMinor).toBe(199) // $1.99
  })

  it('handles album pricing tiers', () => {
    expect(suggestPricing('c1', 'album', 500).suggestedPriceMinor).toBe(499)
    expect(suggestPricing('c1', 'album', 5000).suggestedPriceMinor).toBe(999)
    expect(suggestPricing('c1', 'album', 50000).suggestedPriceMinor).toBe(1999)
  })

  it('handles ticket pricing tiers', () => {
    expect(suggestPricing('c1', 'ticket', 500).suggestedPriceMinor).toBe(500)
    expect(suggestPricing('c1', 'ticket', 5000).suggestedPriceMinor).toBe(2000)
    expect(suggestPricing('c1', 'ticket', 50000).suggestedPriceMinor).toBe(10000)
  })

  it('includes bounds in suggestion', () => {
    const result = suggestPricing('c1', 'track', 1000)
    expect(result.lowerBoundMinor).toBe(49)
    expect(result.upperBoundMinor).toBe(199)
  })

  it('always returns USD currency', () => {
    const result = suggestPricing('c1', 'track', 1000)
    expect(result.currency).toBe('USD')
  })
})

// ── Growth Strategies ───────────────────────────────────────────────────────

describe('generateGrowthStrategies', () => {
  it('recommends growing catalog when < 10 tracks', () => {
    const input = makeCreatorInput({ totalTracks: 3 })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).toContain('increase_catalog')
  })

  it('does not recommend growing catalog when >= 10 tracks', () => {
    const input = makeCreatorInput({ totalTracks: 20 })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).not.toContain('increase_catalog')
  })

  it('recommends building following when < 500 followers', () => {
    const input = makeCreatorInput({ followerCount: 100 })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).toContain('build_following')
  })

  it('recommends events when creator has none', () => {
    const input = makeCreatorInput({ hasEvents: false })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).toContain('start_events')
  })

  it('does not recommend events when creator already has them', () => {
    const input = makeCreatorInput({ hasEvents: true })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).not.toContain('start_events')
  })

  it('recommends tipping for low-revenue creators with followers', () => {
    const input = makeCreatorInput({ revenueLastMonthMinor: 1000, followerCount: 500 })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).toContain('enable_tipping')
  })

  it('recommends cross-regional collab when only 1 region', () => {
    const input = makeCreatorInput({ topRegions: ['NG'] })
    const result = generateGrowthStrategies(input)
    const ids = result.strategies.map((s) => s.id)
    expect(ids).toContain('cross_regional')
  })

  it('returns empty strategies for well-rounded creator', () => {
    const input = makeCreatorInput({
      totalTracks: 50,
      followerCount: 5000,
      avgStreamsPerTrack: 500,
      revenueLastMonthMinor: 50000,
      hasEvents: true,
      topRegions: ['NG', 'KE', 'ZA'],
    })
    const result = generateGrowthStrategies(input)
    expect(result.strategies.length).toBeLessThanOrEqual(1) // only metadata if avg < 100
  })

  it('is deterministic', () => {
    const input = makeCreatorInput()
    const run1 = generateGrowthStrategies(input)
    const run2 = generateGrowthStrategies(input)
    expect(run1.strategies.map((s) => s.id)).toEqual(run2.strategies.map((s) => s.id))
  })
})

// ── Performance Prediction ──────────────────────────────────────────────────

describe('predictPerformance', () => {
  it('applies new release multiplier', () => {
    const newRelease = predictPerformance('a1', 100, 1000, true)
    const existing = predictPerformance('a1', 100, 1000, false)
    expect(newRelease.predictedStreams30d).toBeGreaterThan(existing.predictedStreams30d)
  })

  it('accounts for follower count in predictions', () => {
    const bigAudience = predictPerformance('a1', 100, 10000, false)
    const smallAudience = predictPerformance('a1', 100, 100, false)
    expect(bigAudience.predictedStreams30d).toBeGreaterThan(smallAudience.predictedStreams30d)
  })

  it('computes revenue from predicted streams', () => {
    const result = predictPerformance('a1', 100, 0, false)
    // Per-stream rate is 0.4 cents → revenue = streams * 0.4
    expect(result.predictedRevenue30dMinor).toBeGreaterThan(0)
  })

  it('returns integer values for streams and revenue', () => {
    const result = predictPerformance('a1', 333, 777, true)
    expect(Number.isInteger(result.predictedStreams30d)).toBe(true)
    expect(Number.isInteger(result.predictedRevenue30dMinor)).toBe(true)
  })

  it('returns confidence 0.5 for heuristic', () => {
    const result = predictPerformance('a1', 100, 1000, false)
    expect(result.confidence).toBe(0.5)
  })

  it('handles zero avg streams', () => {
    const result = predictPerformance('a1', 0, 0, false)
    expect(result.predictedStreams30d).toBe(0)
    expect(result.predictedRevenue30dMinor).toBe(0)
  })
})
