import type { StrategicSignal, WorkItem } from '../models/types.js'

const TYPE_MULTIPLIERS: Record<string, number> = {
  bargaining_phase: 1.4,
  organizational_priority: 1.2,
}

/**
 * Score strategic signals for a work item.
 * Strategic importance captures organizational alignment and bargaining context.
 *
 * @returns Normalized score between 0 and 1
 */
export function scoreStrategic(item: WorkItem): number {
  if (item.strategicSignals.length === 0) return 0

  const scores = item.strategicSignals.map(computeSignalStrategic)

  // Weighted average with type multipliers
  const total = scores.reduce((a, b) => a + b, 0)
  return clamp(total / scores.length, 0, 1)
}

function computeSignalStrategic(signal: StrategicSignal): number {
  const multiplier = TYPE_MULTIPLIERS[signal.type] ?? 1.0
  return clamp(signal.impact * multiplier, 0, 1)
}

/**
 * Describe strategic factors in human-readable form.
 */
export function describeStrategicFactors(item: WorkItem): readonly string[] {
  return item.strategicSignals.map((signal) => {
    const labels: Record<string, string> = {
      bargaining_phase: 'Active bargaining phase alignment',
      organizational_priority: 'Organizational priority directive',
    }
    return `${labels[signal.type] ?? signal.type} (impact: ${(signal.impact * 100).toFixed(0)}%)`
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
