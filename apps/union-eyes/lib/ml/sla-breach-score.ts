/**
 * The SLA breach risk score: a rule-based heuristic, and described as one.
 *
 * It is arithmetic over a small number of weights, not a trained model, so it carries no confidence, no interval and no training
 * date. Its two decisive inputs, the case's priority and how long it has left, are taken from the case itself, never from the
 * caller, because a score of 0.80 or more raises an imminent-breach alert for the organization and a caller who could choose the
 * inputs could choose the alert.
 */
import { getSLADeadlineHours, type CasePriority } from '@/lib/workflow/case-lifecycle'
import { slaClockStart } from '@/lib/workflow/sla-clock'
import { toLifecycleState } from '@/lib/workflow/state-bridge'

export const SLA_SCORING_METHOD = 'rule_based_heuristic_v1'
/** The one model version this scorer can honestly claim: a caller does not get to name another. */
export const SLA_MODEL_VERSION = 'sla-risk-v1'

export type ScoringPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface SlaScoreInput {
  priority: ScoringPriority
  hoursRemaining: number
  transitionCount: number
  hasPreviousBreaches: boolean
}

const PRIORITIES: readonly ScoringPriority[] = ['low', 'medium', 'high', 'urgent']

/** A case priority the heuristic has no weight for (a value outside the four) scores as medium. */
export function scoringPriority(value: unknown): ScoringPriority {
  return PRIORITIES.includes(value as ScoringPriority) ? (value as ScoringPriority) : 'medium'
}

export function computeSlaBreachProbability(input: SlaScoreInput): number {
  const priorityWeight = input.priority === 'urgent' ? 0.25 : input.priority === 'high' ? 0.18 : input.priority === 'medium' ? 0.1 : 0.04
  const timePressure = input.hoursRemaining <= 0 ? 0.45 : input.hoursRemaining < 12 ? 0.32 : input.hoursRemaining < 24 ? 0.2 : 0.08
  const transitionPressure = Math.min(Math.max(input.transitionCount, 0) * 0.03, 0.18)
  const historyWeight = input.hasPreviousBreaches ? 0.16 : 0
  const score = Math.min(0.99, Math.max(0.01, priorityWeight + timePressure + transitionPressure + historyWeight))
  return Number(score.toFixed(4))
}

export interface ScoredCase {
  status: string
  priority: string | null
  statusChangedAt?: Date | null
  createdAt: Date | null
}

/** The priority and time remaining of a case, as the system itself holds them. */
export function caseFacts(claim: ScoredCase, now: Date): { priority: ScoringPriority; hoursRemaining: number } {
  const priority = scoringPriority(claim.priority)
  const totalHours = getSLADeadlineHours(toLifecycleState('claim', claim.status) ?? 'submitted', priority as CasePriority)
  const changedAt = slaClockStart(claim, now).startedAt
  const deadline = changedAt.getTime() + totalHours * 3_600_000
  return { priority, hoursRemaining: (deadline - now.getTime()) / 3_600_000 }
}
