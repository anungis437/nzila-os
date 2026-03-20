/**
 * @nzila/zonga-intelligence — Recommendation Engine
 *
 * Heuristic-based recommendation scoring using collaborative signals.
 * Designed for feature-flag controlled rollout.
 */
import type {
  UserSignal,
  Recommendation,
  RecommendationResult,
  InferenceExplanation,
} from './types'
import { SignalType } from './types'

// ── Signal Weights ────────────────────────────────────────────────────────

/**
 * Default signal weights for recommendation scoring.
 * Higher values = stronger positive signal.
 */
const SIGNAL_WEIGHTS: Record<string, number> = {
  [SignalType.PLAY]: 1.0,
  [SignalType.SAVE]: 3.0,
  [SignalType.SHARE]: 4.0,
  [SignalType.FOLLOW]: 5.0,
  [SignalType.PLAYLIST_ADD]: 3.5,
  [SignalType.PURCHASE]: 6.0,
  [SignalType.TIP]: 7.0,
  [SignalType.EVENT_ATTEND]: 5.0,
  [SignalType.SEARCH]: 1.5,
  [SignalType.SKIP]: -2.0,
  [SignalType.UNFOLLOW]: -4.0,
}

// ── Scoring ───────────────────────────────────────────────────────────────

export interface ScoredItem {
  readonly itemId: string
  readonly itemType: 'track' | 'artist' | 'event' | 'playlist'
  readonly rawScore: number
  readonly signalCount: number
  readonly topSignals: readonly string[]
}

/**
 * Score items based on user signals using weighted aggregation.
 * This is a simple heuristic approach — production would use ML models.
 */
export function scoreItemsBySignals(
  signals: readonly UserSignal[],
  decayDays: number = 30,
  now?: Date,
): ScoredItem[] {
  const currentTime = (now ?? new Date()).getTime()
  const decayMs = decayDays * 24 * 60 * 60 * 1000

  // Aggregate scores per item
  const itemScores = new Map<
    string,
    { itemType: string; rawScore: number; signalCount: number; signals: Map<string, number> }
  >()

  for (const signal of signals) {
    const key = `${signal.targetType}:${signal.targetId}`
    const existing = itemScores.get(key) ?? {
      itemType: signal.targetType,
      rawScore: 0,
      signalCount: 0,
      signals: new Map<string, number>(),
    }

    // Time decay: recent signals weigh more
    const age = currentTime - signal.timestamp.getTime()
    const decay = Math.max(0, 1 - age / decayMs)

    const weight = SIGNAL_WEIGHTS[signal.signalType] ?? 1.0
    const contribution = weight * signal.weight * decay

    existing.rawScore += contribution
    existing.signalCount++
    existing.signals.set(
      signal.signalType,
      (existing.signals.get(signal.signalType) ?? 0) + Math.abs(contribution),
    )

    itemScores.set(key, existing)
  }

  // Convert to sorted array
  const scored: ScoredItem[] = []
  for (const [key, data] of itemScores) {
    const [itemType, itemId] = key.split(':') as [string, string]
    const topSignals = [...data.signals.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type)

    scored.push({
      itemId,
      itemType: itemType as ScoredItem['itemType'],
      rawScore: Math.round(data.rawScore * 100) / 100,
      signalCount: data.signalCount,
      topSignals,
    })
  }

  return scored.sort((a, b) => b.rawScore - a.rawScore)
}

/**
 * Build recommendations from scored items.
 */
export function buildRecommendations(
  scoredItems: readonly ScoredItem[],
  limit: number = 20,
  excludeIds: readonly string[] = [],
): Recommendation[] {
  const excluded = new Set(excludeIds)
  const maxScore = Math.max(...scoredItems.map((s) => s.rawScore), 1)

  return scoredItems
    .filter((item) => !excluded.has(item.itemId) && item.rawScore > 0)
    .slice(0, limit)
    .map((item) => ({
      itemId: item.itemId,
      itemType: item.itemType,
      score: Math.round((item.rawScore / maxScore) * 100) / 100,
      reason: `Based on ${item.signalCount} interactions (${item.topSignals.join(', ')})`,
      strategy: 'collaborative' as const,
    }))
}

/**
 * Compute diversity score for a recommendation set.
 * Higher = more diverse (more item types, fewer repeated artists).
 */
export function computeDiversity(recommendations: readonly Recommendation[]): number {
  if (recommendations.length <= 1) return 1.0

  const types = new Set(recommendations.map((r) => r.itemType))
  const typeRatio = types.size / 4 // max 4 types

  // Unique items vs total
  const uniqueItems = new Set(recommendations.map((r) => r.itemId))
  const uniqueRatio = uniqueItems.size / recommendations.length

  return Math.round(((typeRatio + uniqueRatio) / 2) * 100) / 100
}
