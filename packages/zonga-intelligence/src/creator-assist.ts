/**
 * @nzila/zonga-intelligence — Creator Assist
 *
 * AI-powered creator assistance: release timing optimization,
 * pricing suggestions, audience growth strategies, and
 * content performance predictions.
 *
 * All recommendations are deterministic heuristic fallbacks
 * when ML models are disabled via feature flags.
 *
 * @module @nzila/zonga-intelligence/creator-assist
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ReleaseTimingSuggestion {
  readonly creatorId: string
  readonly suggestedDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  readonly suggestedHourUtc: number
  readonly confidence: number
  readonly reasoning: string
}

export interface PricingSuggestion {
  readonly creatorId: string
  readonly contentType: 'track' | 'album' | 'ticket'
  readonly suggestedPriceMinor: number
  readonly currency: string
  readonly lowerBoundMinor: number
  readonly upperBoundMinor: number
  readonly reasoning: string
}

export interface GrowthStrategy {
  readonly creatorId: string
  readonly strategies: readonly StrategyRecommendation[]
  readonly generatedAt: string
}

export interface StrategyRecommendation {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly priority: 'high' | 'medium' | 'low'
  readonly category: 'content' | 'engagement' | 'monetization' | 'collaboration'
  readonly estimatedImpact: string
}

export interface PerformancePrediction {
  readonly assetId: string
  readonly predictedStreams30d: number
  readonly predictedRevenue30dMinor: number
  readonly confidence: number
  readonly basedOn: string
}

export interface CreatorAssistInput {
  readonly creatorId: string
  readonly totalTracks: number
  readonly totalStreams: number
  readonly followerCount: number
  readonly avgStreamsPerTrack: number
  readonly topRegions: readonly string[]
  readonly revenueLastMonthMinor: number
  readonly hasEvents: boolean
  readonly hasMerchandise: boolean
}

// ── Release Timing (Heuristic Fallback) ────────────────────────────────────

/**
 * Suggest optimal release timing based on region and audience size.
 * Heuristic: Fridays are standard for music releases globally.
 * African markets show strong weekend engagement.
 */
export function suggestReleaseTiming(
  creatorId: string,
  topRegions: readonly string[],
): ReleaseTimingSuggestion {
  // African markets peak on Friday evenings (UTC+1 to UTC+3)
  const africanRegions = new Set([
    'NG', 'KE', 'ZA', 'GH', 'TZ', 'UG', 'SN', 'CI', 'CM', 'ET',
    'RW', 'CD', 'AO', 'MZ', 'ZM', 'ZW', 'MW', 'BW', 'NA', 'MG',
  ])

  const isAfricanFocused = topRegions.some((r) => africanRegions.has(r))

  return {
    creatorId,
    suggestedDay: 'friday',
    suggestedHourUtc: isAfricanFocused ? 15 : 12, // 3PM UTC for Africa (6PM WAT), noon UTC otherwise
    confidence: 0.7,
    reasoning: isAfricanFocused
      ? 'Friday 6PM WAT/EAT — peak engagement for African music audiences'
      : 'Friday noon UTC — standard global release window',
  }
}

// ── Pricing Suggestions (Heuristic Fallback) ────────────────────────────────

/** Default pricing tiers for African markets (in USD minor units/cents) */
const DEFAULT_PRICING = {
  track: { low: 49, mid: 99, high: 199 },     // $0.49 - $1.99
  album: { low: 499, mid: 999, high: 1999 },   // $4.99 - $19.99
  ticket: { low: 500, mid: 2000, high: 10000 }, // $5.00 - $100.00
} as const satisfies Record<string, { low: number; mid: number; high: number }>

/**
 * Suggest pricing based on creator tier and content type.
 */
export function suggestPricing(
  creatorId: string,
  contentType: 'track' | 'album' | 'ticket',
  followerCount: number,
): PricingSuggestion {
  const tier = DEFAULT_PRICING[contentType]

  // Higher follower count → can command higher prices
  let suggestedPriceMinor: number
  let reasoning: string

  if (followerCount >= 10000) {
    suggestedPriceMinor = tier.high
    reasoning = 'Established audience supports premium pricing'
  } else if (followerCount >= 1000) {
    suggestedPriceMinor = tier.mid
    reasoning = 'Growing audience supports mid-tier pricing'
  } else {
    suggestedPriceMinor = tier.low
    reasoning = 'Emerging creator — competitive pricing to build audience'
  }

  return {
    creatorId,
    contentType,
    suggestedPriceMinor,
    currency: 'USD',
    lowerBoundMinor: tier.low,
    upperBoundMinor: tier.high,
    reasoning,
  }
}

// ── Growth Strategies ───────────────────────────────────────────────────────

/**
 * Generate growth strategy recommendations based on creator profile.
 * Deterministic — same input always produces same output.
 */
export function generateGrowthStrategies(input: CreatorAssistInput): GrowthStrategy {
  const strategies: StrategyRecommendation[] = []

  // Content strategies
  if (input.totalTracks < 10) {
    strategies.push({
      id: 'increase_catalog',
      title: 'Grow Your Catalog',
      description: 'Release at least 2 tracks per month to build momentum. Algorithms favor active creators.',
      priority: 'high',
      category: 'content',
      estimatedImpact: '+30% discoverability in 90 days',
    })
  }

  if (input.avgStreamsPerTrack > 0 && input.avgStreamsPerTrack < 100) {
    strategies.push({
      id: 'improve_metadata',
      title: 'Optimize Track Metadata',
      description: 'Add genre tags, mood labels, and compelling descriptions to improve search visibility.',
      priority: 'medium',
      category: 'content',
      estimatedImpact: '+20% search-driven streams',
    })
  }

  // Engagement strategies
  if (input.followerCount < 500) {
    strategies.push({
      id: 'build_following',
      title: 'Build Your Following',
      description: 'Share content on WhatsApp and social media. Cross-promote with local artists.',
      priority: 'high',
      category: 'engagement',
      estimatedImpact: '+50 followers per month',
    })
  }

  // Monetization strategies
  if (!input.hasEvents) {
    strategies.push({
      id: 'start_events',
      title: 'Launch Live Events',
      description: 'Live performances drive 3x the engagement of streaming. Start with small local venues.',
      priority: 'medium',
      category: 'monetization',
      estimatedImpact: '+40% total revenue',
    })
  }

  if (input.revenueLastMonthMinor < 5000 && input.followerCount > 100) {
    strategies.push({
      id: 'enable_tipping',
      title: 'Enable Fan Tipping',
      description: 'Top creators earn 15-25% of revenue from tips. Add a tip prompt to your profile.',
      priority: 'medium',
      category: 'monetization',
      estimatedImpact: '+15% revenue',
    })
  }

  // Collaboration strategies
  if (input.topRegions.length <= 1) {
    strategies.push({
      id: 'cross_regional',
      title: 'Collaborate Across Regions',
      description: 'Feature artists from other African markets to expand your geographic reach.',
      priority: 'low',
      category: 'collaboration',
      estimatedImpact: 'New market exposure',
    })
  }

  return {
    creatorId: input.creatorId,
    strategies,
    generatedAt: new Date().toISOString(),
  }
}

// ── Performance Prediction (Heuristic Fallback) ────────────────────────────

/**
 * Predict 30-day performance for a new release based on creator history.
 * Simple linear heuristic — production uses ML model.
 */
export function predictPerformance(
  assetId: string,
  avgStreamsPerTrack: number,
  followerCount: number,
  isNewRelease: boolean,
): PerformancePrediction {
  // New releases get a boost from follower notifications
  const multiplier = isNewRelease ? 1.5 : 1.0
  const predictedStreams30d = Math.round(
    avgStreamsPerTrack * multiplier * (1 + Math.log1p(followerCount) / 10),
  )

  // Rough per-stream rate: $0.004 (African market average)
  const perStreamMinor = 0.4 // 0.4 cents
  const predictedRevenue30dMinor = Math.round(predictedStreams30d * perStreamMinor)

  return {
    assetId,
    predictedStreams30d,
    predictedRevenue30dMinor,
    confidence: 0.5, // heuristic = moderate confidence
    basedOn: 'Historical average streams per track + follower count heuristic',
  }
}
