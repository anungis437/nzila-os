/**
 * @nzila/zonga-intelligence — Fraud Detection Engine
 *
 * Heuristic-based fraud scoring for stream farming,
 * fake accounts, ticket scalping, and payment fraud.
 */
import type {
  FraudSignal,
  FraudScore,
  InferenceExplanation,
  ExplanationFactor,
  RiskLevel,
} from './types'

// ── Fraud Heuristics ──────────────────────────────────────────────────────

export interface FraudIndicator {
  readonly name: string
  readonly weight: number
  readonly description: string
}

/**
 * Built-in fraud indicators with weights.
 */
const FRAUD_INDICATORS: Record<string, FraudIndicator> = {
  rapid_stream_repeat: {
    name: 'Rapid Stream Repeats',
    weight: 15,
    description: 'Same track streamed many times in short period',
  },
  geographic_impossibility: {
    name: 'Geographic Impossibility',
    weight: 25,
    description: 'Activity from geographically impossible locations in short timeframe',
  },
  bot_pattern: {
    name: 'Bot-like Pattern',
    weight: 20,
    description: 'Perfectly regular intervals between actions',
  },
  burst_account_creation: {
    name: 'Burst Account Creation',
    weight: 30,
    description: 'Many accounts created from same IP/device in short period',
  },
  scalping_pattern: {
    name: 'Ticket Scalping Pattern',
    weight: 20,
    description: 'Bulk ticket purchase followed by immediate transfer listing',
  },
  payment_velocity: {
    name: 'Payment Velocity',
    weight: 25,
    description: 'Unusually high payment frequency or amount',
  },
  review_spam: {
    name: 'Review Manipulation',
    weight: 10,
    description: 'Repetitive review content or coordinated review timing',
  },
  dormant_activation: {
    name: 'Dormant Account Activation',
    weight: 15,
    description: 'Long-dormant account suddenly very active',
  },
}

// ── Scoring ───────────────────────────────────────────────────────────────

/**
 * Compute a fraud score from a set of indicator names.
 * Returns 0-100 score with risk level classification.
 */
export function computeFraudScore(
  targetEntityId: string,
  entityType: 'user' | 'track' | 'event' | 'transaction',
  indicatorNames: readonly string[],
): {
  score: number
  riskLevel: RiskLevel
  factors: ExplanationFactor[]
  recommendedAction: 'allow' | 'flag' | 'block' | 'manual_review'
} {
  if (indicatorNames.length === 0) {
    return { score: 0, riskLevel: 'low', factors: [], recommendedAction: 'allow' }
  }

  let totalWeight = 0
  const factors: ExplanationFactor[] = []

  for (const name of indicatorNames) {
    const indicator = FRAUD_INDICATORS[name]
    if (indicator) {
      totalWeight += indicator.weight
      factors.push({
        feature: indicator.name,
        weight: indicator.weight,
        direction: 'negative',
      })
    }
  }

  // Cap at 100
  const score = Math.min(100, totalWeight)

  // Risk level thresholds
  let riskLevel: RiskLevel
  let recommendedAction: 'allow' | 'flag' | 'block' | 'manual_review'

  if (score >= 70) {
    riskLevel = 'critical'
    recommendedAction = 'block'
  } else if (score >= 50) {
    riskLevel = 'high'
    recommendedAction = 'manual_review'
  } else if (score >= 25) {
    riskLevel = 'medium'
    recommendedAction = 'flag'
  } else {
    riskLevel = 'low'
    recommendedAction = 'allow'
  }

  return { score, riskLevel, factors, recommendedAction }
}

// ── Stream Farm Detection ─────────────────────────────────────────────────

export interface StreamPattern {
  readonly trackId: string
  readonly userId: string
  readonly playCount: number
  readonly timeWindowMinutes: number
  readonly averageListenDuration: number
  readonly trackDuration: number
}

/**
 * Detect stream farming patterns.
 * A stream is suspicious if:
 * - Play count > threshold in time window
 * - Average listen duration < 30% of track duration (skimming)
 */
export function detectStreamFarming(
  pattern: StreamPattern,
  maxPlaysPerHour: number = 10,
  minListenRatio: number = 0.3,
): FraudSignal | null {
  const playsPerHour = (pattern.playCount / pattern.timeWindowMinutes) * 60
  const listenRatio =
    pattern.trackDuration > 0
      ? pattern.averageListenDuration / pattern.trackDuration
      : 0

  const indicators: string[] = []

  if (playsPerHour > maxPlaysPerHour) {
    indicators.push(`${Math.round(playsPerHour)} plays/hour exceeds threshold of ${maxPlaysPerHour}`)
  }

  if (listenRatio < minListenRatio && pattern.playCount > 3) {
    indicators.push(
      `Average listen ratio ${Math.round(listenRatio * 100)}% below ${Math.round(minListenRatio * 100)}% threshold`,
    )
  }

  if (indicators.length === 0) return null

  return {
    type: 'stream_farming',
    userId: pattern.userId,
    targetEntityId: pattern.trackId,
    indicators,
    timestamp: new Date(),
  }
}
