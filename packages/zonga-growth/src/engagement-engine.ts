/**
 * @nzila/zonga-growth — Engagement Engine
 *
 * Regional charts, velocity-based ranking, fan engagement scoring,
 * and creator loyalty metrics. All scoring is deterministic —
 * same inputs produce same outputs.
 *
 * @module @nzila/zonga-growth/engagement-engine
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface RegionalChartEntry {
  readonly rank: number
  readonly assetId: string
  readonly creatorId: string
  readonly region: string
  readonly streams: number
  readonly uniqueListeners: number
  readonly saves: number
  readonly score: number
}

export interface RegionalChartInput {
  readonly assetId: string
  readonly creatorId: string
  readonly streams: number
  readonly uniqueListeners: number
  readonly saves: number
}

export interface VelocityRankEntry {
  readonly assetId: string
  readonly currentStreams: number
  readonly previousStreams: number
  readonly velocity: number
  readonly acceleration: number
  readonly direction: 'rising' | 'stable' | 'falling'
}

export interface VelocityInput {
  readonly assetId: string
  readonly currentPeriodStreams: number
  readonly previousPeriodStreams: number
  readonly priorPeriodStreams: number
}

export interface FanEngagementScore {
  readonly listenerId: string
  readonly creatorId: string
  readonly score: number
  readonly tier: FanTier
  readonly totalStreams: number
  readonly uniqueTracks: number
  readonly shares: number
  readonly eventAttendances: number
  readonly tipCount: number
  readonly tipAmountMinor: number
  readonly computedAt: string
}

export type FanTier = 'casual' | 'regular' | 'superfan' | 'champion'

export interface FanEngagementInput {
  readonly listenerId: string
  readonly creatorId: string
  readonly totalStreams: number
  readonly uniqueTracks: number
  readonly shares: number
  readonly eventAttendances: number
  readonly tipCount: number
  readonly tipAmountMinor: number
}

export interface CreatorMomentumScore {
  readonly creatorId: string
  readonly followerGrowthRate: number
  readonly streamGrowthRate: number
  readonly engagementRate: number
  readonly revenueGrowthRate: number
  readonly overallMomentum: number
  readonly direction: 'accelerating' | 'steady' | 'decelerating'
}

export interface CreatorMomentumInput {
  readonly creatorId: string
  readonly currentFollowers: number
  readonly previousFollowers: number
  readonly currentStreams: number
  readonly previousStreams: number
  readonly currentEngagements: number
  readonly totalListeners: number
  readonly currentRevenueMinor: number
  readonly previousRevenueMinor: number
}

// ── Regional Chart Weights ──────────────────────────────────────────────────

const CHART_WEIGHTS = {
  streams: 1.0,
  uniqueListeners: 2.0,
  saves: 3.0,
} as const

/**
 * Compute a regional chart from asset performance data.
 * Deterministic: same inputs → same ranking.
 */
export function computeRegionalChart(
  region: string,
  assets: readonly RegionalChartInput[],
  limit: number = 50,
): readonly RegionalChartEntry[] {
  if (assets.length === 0) return []

  const maxStreams = Math.max(...assets.map((a) => a.streams), 1)
  const maxListeners = Math.max(...assets.map((a) => a.uniqueListeners), 1)
  const maxSaves = Math.max(...assets.map((a) => a.saves), 1)

  const scored = assets.map((asset) => {
    const score =
      (asset.streams / maxStreams) * CHART_WEIGHTS.streams +
      (asset.uniqueListeners / maxListeners) * CHART_WEIGHTS.uniqueListeners +
      (asset.saves / maxSaves) * CHART_WEIGHTS.saves

    return { ...asset, region, score: Math.round(score * 10000) / 10000 }
  })

  // Sort by score descending, then by assetId for deterministic tie-breaking
  scored.sort((a, b) => b.score - a.score || a.assetId.localeCompare(b.assetId))

  return scored.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    assetId: entry.assetId,
    creatorId: entry.creatorId,
    region: entry.region,
    streams: entry.streams,
    uniqueListeners: entry.uniqueListeners,
    saves: entry.saves,
    score: entry.score,
  }))
}

// ── Velocity Ranking ────────────────────────────────────────────────────────

/**
 * Compute velocity rankings — identifies tracks gaining/losing momentum.
 * Velocity = (current - previous) / max(previous, 1)
 * Acceleration = velocity change between periods.
 */
export function computeVelocityRanking(
  inputs: readonly VelocityInput[],
  limit: number = 50,
): readonly VelocityRankEntry[] {
  if (inputs.length === 0) return []

  const entries: VelocityRankEntry[] = inputs.map((input) => {
    const prev = Math.max(input.previousPeriodStreams, 1)
    const prior = Math.max(input.priorPeriodStreams, 1)

    const velocity = (input.currentPeriodStreams - input.previousPeriodStreams) / prev
    const prevVelocity = (input.previousPeriodStreams - input.priorPeriodStreams) / prior
    const acceleration = velocity - prevVelocity

    let direction: VelocityRankEntry['direction']
    if (velocity > 0.1) direction = 'rising'
    else if (velocity < -0.1) direction = 'falling'
    else direction = 'stable'

    return {
      assetId: input.assetId,
      currentStreams: input.currentPeriodStreams,
      previousStreams: input.previousPeriodStreams,
      velocity: Math.round(velocity * 10000) / 10000,
      acceleration: Math.round(acceleration * 10000) / 10000,
      direction,
    }
  })

  // Sort by velocity descending, tie-break by assetId
  entries.sort((a, b) => b.velocity - a.velocity || a.assetId.localeCompare(b.assetId))

  return entries.slice(0, limit)
}

// ── Fan Engagement Scoring ──────────────────────────────────────────────────

const FAN_WEIGHTS = {
  streams: 1.0,
  uniqueTracks: 2.0,
  shares: 4.0,
  events: 5.0,
  tips: 6.0,
} as const

const FAN_TIER_THRESHOLDS: readonly { min: number; tier: FanTier }[] = [
  { min: 80, tier: 'champion' },
  { min: 50, tier: 'superfan' },
  { min: 20, tier: 'regular' },
  { min: 0, tier: 'casual' },
]

/**
 * Score a listener's engagement with a specific creator.
 * Returns a 0–100 score and fan tier classification.
 */
export function scoreFanEngagement(input: FanEngagementInput): FanEngagementScore {
  // Normalize each dimension to 0–1 using diminishing returns (log scale)
  const norm = (val: number, scale: number): number =>
    val <= 0 ? 0 : Math.min(1, Math.log1p(val) / Math.log1p(scale))

  const streamScore = norm(input.totalStreams, 500)
  const trackScore = norm(input.uniqueTracks, 50)
  const shareScore = norm(input.shares, 20)
  const eventScore = norm(input.eventAttendances, 10)
  const tipScore = norm(input.tipCount, 10)

  const totalWeight =
    FAN_WEIGHTS.streams +
    FAN_WEIGHTS.uniqueTracks +
    FAN_WEIGHTS.shares +
    FAN_WEIGHTS.events +
    FAN_WEIGHTS.tips

  const rawScore =
    (streamScore * FAN_WEIGHTS.streams +
      trackScore * FAN_WEIGHTS.uniqueTracks +
      shareScore * FAN_WEIGHTS.shares +
      eventScore * FAN_WEIGHTS.events +
      tipScore * FAN_WEIGHTS.tips) /
    totalWeight

  const score = Math.round(rawScore * 100)
  const tier = FAN_TIER_THRESHOLDS.find((t) => score >= t.min)?.tier ?? 'casual'

  return {
    listenerId: input.listenerId,
    creatorId: input.creatorId,
    score,
    tier,
    totalStreams: input.totalStreams,
    uniqueTracks: input.uniqueTracks,
    shares: input.shares,
    eventAttendances: input.eventAttendances,
    tipCount: input.tipCount,
    tipAmountMinor: input.tipAmountMinor,
    computedAt: new Date().toISOString(),
  }
}

// ── Creator Momentum ────────────────────────────────────────────────────────

/**
 * Compute a creator's overall momentum score.
 * Combines follower growth, stream growth, engagement rate, and revenue growth.
 */
export function computeCreatorMomentum(
  input: CreatorMomentumInput,
): CreatorMomentumScore {
  const growthRate = (current: number, previous: number): number => {
    if (previous <= 0) return current > 0 ? 1 : 0
    return (current - previous) / previous
  }

  const followerGrowthRate = growthRate(input.currentFollowers, input.previousFollowers)
  const streamGrowthRate = growthRate(input.currentStreams, input.previousStreams)
  const engagementRate =
    input.totalListeners > 0
      ? input.currentEngagements / input.totalListeners
      : 0
  const revenueGrowthRate = growthRate(input.currentRevenueMinor, input.previousRevenueMinor)

  // Weighted overall momentum
  const overallMomentum =
    followerGrowthRate * 0.25 +
    streamGrowthRate * 0.30 +
    engagementRate * 0.20 +
    revenueGrowthRate * 0.25

  let direction: CreatorMomentumScore['direction']
  if (overallMomentum > 0.05) direction = 'accelerating'
  else if (overallMomentum < -0.05) direction = 'decelerating'
  else direction = 'steady'

  return {
    creatorId: input.creatorId,
    followerGrowthRate: Math.round(followerGrowthRate * 10000) / 10000,
    streamGrowthRate: Math.round(streamGrowthRate * 10000) / 10000,
    engagementRate: Math.round(engagementRate * 10000) / 10000,
    revenueGrowthRate: Math.round(revenueGrowthRate * 10000) / 10000,
    overallMomentum: Math.round(overallMomentum * 10000) / 10000,
    direction,
  }
}
