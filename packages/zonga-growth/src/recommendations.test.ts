import { describe, it, expect, vi } from 'vitest'
import { computeTrendingScores, CACHE_TTL } from './recommendations'
import type { TrendingSignal } from './recommendations'

function makeSignal(overrides: Partial<TrendingSignal> = {}): TrendingSignal {
  return {
    assetId: 'a1',
    streams24h: 100,
    streams7d: 500,
    uniqueListeners: 200,
    shareCount: 50,
    saveCount: 30,
    ...overrides,
  }
}

// ── computeTrendingScores ────────────────────────────────────────────────────

describe('computeTrendingScores', () => {
  it('returns empty for empty signals', () => {
    expect(computeTrendingScores([])).toEqual([])
  })

  it('computes scores and velocity for a single asset', () => {
    const result = computeTrendingScores([makeSignal()])
    expect(result).toHaveLength(1)
    expect(result[0]!.assetId).toBe('a1')
    expect(result[0]!.score).toBeGreaterThan(0)
    expect(result[0]!.velocity).toBeGreaterThan(0)
  })

  it('returns scores sorted descending', () => {
    const signals = [
      makeSignal({ assetId: 'low', streams24h: 10, streams7d: 100, uniqueListeners: 5, shareCount: 1, saveCount: 1 }),
      makeSignal({ assetId: 'high', streams24h: 1000, streams7d: 500, uniqueListeners: 800, shareCount: 200, saveCount: 100 }),
    ]
    const result = computeTrendingScores(signals)
    expect(result[0]!.assetId).toBe('high')
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score)
  })

  it('computes velocity as (24h * 7) / 7d ratio', () => {
    const result = computeTrendingScores([
      makeSignal({ streams24h: 100, streams7d: 200 }),
    ])
    // velocity = (100 * 7) / 200 = 3.5
    expect(result[0]!.velocity).toBeCloseTo(3.5, 1)
  })

  it('assigns max velocity 10 for new content with zero 7d streams', () => {
    const result = computeTrendingScores([
      makeSignal({ streams24h: 100, streams7d: 0 }),
    ])
    expect(result[0]!.velocity).toBe(10)
  })

  it('assigns velocity 0 when both 24h and 7d are zero', () => {
    const result = computeTrendingScores([
      makeSignal({ streams24h: 0, streams7d: 0 }),
    ])
    expect(result[0]!.velocity).toBe(0)
  })

  it('normalizes across multiple signals', () => {
    const signals = [
      makeSignal({ assetId: 'a1', streams24h: 50, shareCount: 100 }),
      makeSignal({ assetId: 'a2', streams24h: 100, shareCount: 50 }),
    ]
    const result = computeTrendingScores(signals)
    // Both should have non-zero scores
    expect(result.every((r) => r.score > 0)).toBe(true)
  })
})

// ── CACHE_TTL ────────────────────────────────────────────────────────────────

describe('CACHE_TTL', () => {
  it('has expected surface TTLs', () => {
    expect(CACHE_TTL.trending).toBe(300)
    expect(CACHE_TTL.for_you).toBe(1800)
    expect(CACHE_TTL.city).toBe(3600)
    expect(CACHE_TTL.session).toBe(60)
    expect(CACHE_TTL.similar).toBe(3600)
  })
})
