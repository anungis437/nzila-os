/**
 * @nzila/zonga-intelligence — Trending Scorer
 *
 * Standalone trending scorer that ranks items by velocity, volume,
 * recency, and regional momentum. Produces trending scores that
 * the recommendation engine can consume.
 */

import type { TrendingItem } from './recommendation-engine'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TrendingInput {
  readonly itemId: string
  readonly itemType: 'track' | 'artist' | 'event' | 'playlist'
  readonly region: string
  /** Number of plays/interactions in the current window */
  readonly currentCount: number
  /** Number of plays/interactions in the previous window */
  readonly previousCount: number
  /** Epoch ms of the most recent interaction */
  readonly lastInteractionAt: number
  /** Total all-time count */
  readonly totalCount: number
}

export interface TrendingScorerConfig {
  /** Weight for velocity (rate of change) */
  readonly velocityWeight: number
  /** Weight for absolute volume */
  readonly volumeWeight: number
  /** Weight for recency */
  readonly recencyWeight: number
  /** Window size in hours for velocity calculation */
  readonly windowHours: number
  /** How fast recency decays (hours). Items older than 3× this are heavily penalized */
  readonly recencyHalfLifeHours: number
}

export const DEFAULT_TRENDING_CONFIG: Readonly<TrendingScorerConfig> = {
  velocityWeight: 0.50,
  volumeWeight: 0.30,
  recencyWeight: 0.20,
  windowHours: 24,
  recencyHalfLifeHours: 12,
}

// ── Scorer ──────────────────────────────────────────────────────────────────

/**
 * Score a collection of items for trendiness.
 * Returns sorted TrendingItem[] with velocity and volume fields.
 */
export function scoreTrendingItems(
  inputs: readonly TrendingInput[],
  config: Readonly<TrendingScorerConfig> = DEFAULT_TRENDING_CONFIG,
  now: number = Date.now(),
): TrendingItem[] {
  if (inputs.length === 0) return []

  // 1. Compute raw metrics
  const raw = inputs.map((input) => {
    const velocity = computeVelocity(input.currentCount, input.previousCount)
    const volume = input.currentCount
    const recency = computeRecency(input.lastInteractionAt, now, config.recencyHalfLifeHours)
    return { input, velocity, volume, recency }
  })

  // 2. Normalize to 0-1 across the set
  const maxVelocity = Math.max(...raw.map((r) => Math.abs(r.velocity)), 1)
  const maxVolume = Math.max(...raw.map((r) => r.volume), 1)

  // 3. Compute composite score
  const scored = raw.map((r) => {
    const normVelocity = Math.max(0, r.velocity) / maxVelocity
    const normVolume = r.volume / maxVolume

    const score =
      normVelocity * config.velocityWeight +
      normVolume * config.volumeWeight +
      r.recency * config.recencyWeight

    return {
      itemId: r.input.itemId,
      itemType: r.input.itemType,
      velocity: Math.round(r.velocity * 1000) / 1000,
      volume: r.volume,
      region: r.input.region,
      score: Math.round(score * 10000) / 10000,
    }
  })

  // 4. Sort by composite score descending
  return scored
    .sort((a, b) => b.score - a.score || b.volume - a.volume)
    .map(({ score: _score, ...item }) => item)
}

/**
 * Get trending items for a specific region and item type.
 */
export function getTrendingByRegion(
  inputs: readonly TrendingInput[],
  region: string,
  itemType: TrendingItem['itemType'],
  limit: number = 50,
  config: Readonly<TrendingScorerConfig> = DEFAULT_TRENDING_CONFIG,
  now: number = Date.now(),
): TrendingItem[] {
  const filtered = inputs.filter(
    (i) => i.region === region && i.itemType === itemType,
  )
  return scoreTrendingItems(filtered, config, now).slice(0, limit)
}

/**
 * Detect breakout items: items with extreme velocity growth (> 3× previous window).
 */
export function detectBreakouts(
  inputs: readonly TrendingInput[],
  breakoutThreshold: number = 3.0,
): TrendingInput[] {
  return inputs.filter((input) => {
    if (input.previousCount === 0) {
      // New item: breakout if current count is significant
      return input.currentCount >= 50
    }
    return input.currentCount / input.previousCount >= breakoutThreshold
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Velocity: rate of change between windows.
 * Handles zero-previous gracefully.
 */
function computeVelocity(current: number, previous: number): number {
  if (previous === 0) {
    // Bootstrap: treat as initial velocity proportional to absolute count
    return current > 0 ? Math.log2(current + 1) : 0
  }
  return (current - previous) / previous
}

/**
 * Recency: exponential decay based on time since last interaction.
 * Returns 0-1 where 1 = just now, ~0 = very old.
 */
function computeRecency(
  lastInteractionAt: number,
  now: number,
  halfLifeHours: number,
): number {
  const hoursAgo = (now - lastInteractionAt) / 3_600_000
  if (hoursAgo <= 0) return 1
  // Exponential decay: score = 0.5^(hoursAgo / halfLife)
  return Math.pow(0.5, hoursAgo / halfLifeHours)
}
