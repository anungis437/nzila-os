import type { RiskSignal, WorkItem } from '../models/types.js'

const SEVERITY_WEIGHTS: Record<string, number> = {
  low: 0.2,
  medium: 0.5,
  high: 1.0,
}

const TYPE_MULTIPLIERS: Record<string, number> = {
  legal: 1.5,
  precedent: 1.3,
  pattern_detected: 1.1,
}

/**
 * Score risk signals for a work item.
 * Risk is weighted heavily — legal risk with high severity produces near-maximum scores.
 *
 * @returns Normalized score between 0 and 1
 */
export function scoreRisk(item: WorkItem): number {
  if (item.riskSignals.length === 0) return 0

  const scores = item.riskSignals.map(computeSignalRisk)

  // Use max-dominant blending: max contributes 70%, average contributes 30%
  // This ensures a single critical risk signal isn't diluted
  const maxScore = Math.max(...scores)
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  return clamp(maxScore * 0.7 + avgScore * 0.3, 0, 1)
}

function computeSignalRisk(signal: RiskSignal): number {
  const severity = SEVERITY_WEIGHTS[signal.severity] ?? 0.2
  const multiplier = TYPE_MULTIPLIERS[signal.type] ?? 1.0
  return clamp(severity * multiplier, 0, 1)
}

/**
 * Describe risk factors in human-readable form.
 */
export function describeRiskFactors(item: WorkItem): readonly string[] {
  return item.riskSignals.map((signal) => {
    const labels: Record<string, string> = {
      legal: 'Legal risk exposure',
      precedent: 'Precedent-setting implications',
      pattern_detected: 'Pattern detected across cases',
    }
    return `${labels[signal.type] ?? signal.type} (${signal.severity})`
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
