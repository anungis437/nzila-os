import type { WorkItem } from '../models/types.js'
import { describeRiskFactors } from '../signals/risk.js'
import { describeStrategicFactors } from '../signals/strategic.js'
import type { SignalScores } from '../models/types.js'

/**
 * Generate a human-readable explanation for why a work item was prioritized.
 * Target: readable in under 5 seconds.
 */
export function generateExplanation(
  item: WorkItem,
  signals: SignalScores,
  score: number,
): { explanation: string; contributingFactors: readonly string[] } {
  const factors: string[] = []

  // Urgency
  if (signals.urgency >= 0.7) {
    if (item.dueAt) {
      const deadline = new Date(item.dueAt)
      const now = new Date()
      const hoursLeft = Math.max(0, (deadline.getTime() - now.getTime()) / 3_600_000)
      if (hoursLeft <= 0) {
        factors.push('Deadline has passed — immediate attention required')
      } else if (hoursLeft <= 24) {
        factors.push(`Deadline in ${Math.round(hoursLeft)} hours`)
      } else {
        factors.push(`Deadline approaching: ${Math.round(hoursLeft / 24)} days remaining`)
      }
    }
    if (item.urgencySignals.some((s) => s.type === 'escalation')) {
      factors.push('Active escalation in progress')
    }
    if (item.urgencySignals.some((s) => s.type === 'member_pressure')) {
      factors.push('Member pressure reported')
    }
  }

  // Risk
  if (signals.risk >= 0.5) {
    factors.push(...describeRiskFactors(item))
  }

  // Strategic
  if (signals.strategic >= 0.4) {
    factors.push(...describeStrategicFactors(item))
  }

  // Saturation
  if (signals.saturation >= 0.6) {
    factors.push('Stakeholders are at high workload saturation — bottleneck risk')
  }

  // Fallback — always provide at least one factor
  if (factors.length === 0) {
    factors.push(`${capitalize(item.type)} item with standard priority`)
  }

  const explanation = buildSentence(item, factors, score)

  return { explanation, contributingFactors: factors }
}

function buildSentence(
  item: WorkItem,
  factors: readonly string[],
  score: number,
): string {
  const typeLabel = TYPE_LABELS[item.type] ?? item.type
  const level = score >= 0.75 ? 'critical' : score >= 0.5 ? 'high' : score >= 0.25 ? 'moderate' : 'standard'

  if (factors.length === 1) {
    return `This ${typeLabel} is prioritized at ${level} level due to: ${factors[0]!.toLowerCase()}.`
  }

  const primary = factors[0]!.toLowerCase()
  const rest = factors.slice(1).map((f) => f.toLowerCase()).join(', ')
  return `This ${typeLabel} is prioritized at ${level} level due to ${primary}, combined with ${rest}.`
}

const TYPE_LABELS: Record<string, string> = {
  grievance: 'grievance',
  member_call: 'member call',
  committee: 'committee matter',
  bargaining: 'bargaining item',
  arbitration: 'arbitration',
  settlement: 'settlement',
  admin: 'administrative task',
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
