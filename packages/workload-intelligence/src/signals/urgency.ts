import type { UrgencySignal, WorkItem } from '../models/types.js'

const HOURS_IN_DAY = 24
const MS_PER_HOUR = 3_600_000

/**
 * Score urgency signals for a work item.
 * Uses time-based decay for deadline proximity and weighted aggregation for escalation/pressure.
 *
 * @returns Normalized score between 0 and 1
 */
export function scoreUrgency(item: WorkItem, now: Date = new Date()): number {
  const deadlineScore = computeDeadlineUrgency(item.dueAt, now)
  const signalScore = aggregateUrgencySignals(item.urgencySignals)

  // Blend: deadline proximity dominates when close, signals add pressure
  const blended = deadlineScore * 0.6 + signalScore * 0.4
  return clamp(blended, 0, 1)
}

/**
 * Compute deadline-based urgency with exponential decay.
 * - Overdue → 1.0
 * - Due within 24h → 0.9+
 * - Due within 72h → 0.7+
 * - Due within 7 days → 0.4+
 * - Due beyond 30 days → ~0.1
 * - No deadline → 0.3 (baseline pressure)
 */
function computeDeadlineUrgency(dueAt: string | undefined, now: Date): number {
  if (!dueAt) return 0.3

  const deadline = new Date(dueAt)
  const hoursRemaining = (deadline.getTime() - now.getTime()) / MS_PER_HOUR

  if (hoursRemaining <= 0) return 1.0

  const daysRemaining = hoursRemaining / HOURS_IN_DAY

  // Exponential decay: urgency increases as deadline approaches
  // score = e^(-daysRemaining / decayFactor)
  const decayFactor = 10
  return Math.exp(-daysRemaining / decayFactor)
}

/**
 * Aggregate weighted urgency signals.
 * Each signal's weight is 0-1; we take the weighted average.
 */
function aggregateUrgencySignals(signals: readonly UrgencySignal[]): number {
  if (signals.length === 0) return 0

  const SIGNAL_MULTIPLIERS: Record<string, number> = {
    deadline: 1.0,
    escalation: 1.3,
    member_pressure: 1.1,
  }

  let total = 0
  let weightSum = 0

  for (const signal of signals) {
    const multiplier = SIGNAL_MULTIPLIERS[signal.type] ?? 1.0
    total += signal.weight * multiplier
    weightSum += multiplier
  }

  return weightSum > 0 ? clamp(total / weightSum, 0, 1) : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
