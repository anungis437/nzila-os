import type {
  WorkItem,
  PriorityLevel,
  SignalScores,
  ScoringWeights,
} from '../models/types.js'
import { DEFAULT_WEIGHTS } from '../models/types.js'
import { scoreUrgency } from '../signals/urgency.js'
import { scoreRisk } from '../signals/risk.js'
import { scoreStrategic } from '../signals/strategic.js'

/**
 * Compute a composite priority score for a work item.
 *
 * Formula:
 *   score = urgencyWeight * urgency + riskWeight * risk + strategicWeight * strategic + saturationWeight * saturation
 *
 * @returns Score normalized to 0-1
 */
export function computePriorityScore(
  item: WorkItem,
  allItems: readonly WorkItem[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  now: Date = new Date(),
): { score: number; signals: SignalScores } {
  const urgency = scoreUrgency(item, now)
  const risk = scoreRisk(item)
  const strategic = scoreStrategic(item)
  const saturation = computeSaturation(item, allItems)

  const signals: SignalScores = { urgency, risk, strategic, saturation }

  const score = clamp(
    weights.urgency * urgency +
      weights.risk * risk +
      weights.strategic * strategic +
      weights.saturation * saturation,
    0,
    1,
  )

  return { score, signals }
}

/**
 * Map a numeric priority score to a discrete priority level.
 */
export function scoreToPriorityLevel(score: number): PriorityLevel {
  if (score >= 0.75) return 'critical'
  if (score >= 0.50) return 'high'
  if (score >= 0.25) return 'medium'
  return 'low'
}

/**
 * Compute workload saturation — how overloaded is this org/stakeholder set?
 * More active items with overlapping stakeholders → higher saturation → higher priority
 * (to surface bottlenecks).
 */
function computeSaturation(
  item: WorkItem,
  allItems: readonly WorkItem[],
): number {
  if (allItems.length <= 1) return 0

  const stakeholderSet = new Set(item.stakeholders)
  if (stakeholderSet.size === 0) return 0

  let overlappingCount = 0
  for (const other of allItems) {
    if (other.id === item.id) continue
    const hasOverlap = other.stakeholders.some((s) => stakeholderSet.has(s))
    if (hasOverlap) overlappingCount++
  }

  // Normalize: 5+ overlapping items = full saturation
  return clamp(overlappingCount / 5, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
