/**
 * Automation rules (Phase 16).
 *
 * Each rule is a pure function that classifies the world and produces zero or
 * more {@link Alert} records. The runtime (apps/nzila-hq/server) is responsible
 * for delivering alerts (write to dashboard, email, queue tasks, etc).
 */
import type { DependencyScore, FinanceSnapshot, Opportunity, Task, Venture } from './types'

export type AlertSeverity = 'info' | 'warn' | 'critical'

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  ventureSlug: string | null
  /** Suggested follow-up action the operator/founder can take. */
  suggestedAction: string | null
  /** Pure-function rule code that produced this alert (e.g. `STALE_DEAL_14D`). */
  ruleCode: string
}

export interface AutomationInput {
  founderUserId: string
  now: string
  ventures: Venture[]
  opportunities: Opportunity[]
  tasks: Task[]
  dependencyScores: DependencyScore[]
  /** Snapshot used for finance comparisons; pass `null` if not yet computed. */
  finance: FinanceSnapshot | null
  /** Previous month MRR for the studio, in cents — for drop detection. */
  previousMonthMrrCents: number | null
}

const STALE_DEAL_DAYS = 14
const FOUNDER_TASK_SHARE_THRESHOLD = 0.6
const MRR_DROP_THRESHOLD = 0.1

function id(parts: (string | number)[]): string {
  return parts.join(':')
}

export function runAutomations(input: AutomationInput): Alert[] {
  const alerts: Alert[] = []

  // Rule: STALE_DEAL_14D
  for (const opp of input.opportunities) {
    if (opp.stage === 'won' || opp.stage === 'lost') continue
    if (opp.daysStale > STALE_DEAL_DAYS) {
      alerts.push({
        id: id(['stale-deal', opp.id]),
        severity: opp.daysStale > STALE_DEAL_DAYS * 2 ? 'critical' : 'warn',
        title: `Deal stale: ${opp.name}`,
        detail: `No activity for ${opp.daysStale} days (threshold ${STALE_DEAL_DAYS}).`,
        ventureSlug: opp.ventureSlug,
        suggestedAction: opp.nextAction || 'Schedule follow-up with account owner',
        ruleCode: 'STALE_DEAL_14D',
      })
    }
  }

  // Rule: FOUNDER_TASK_OVERLOAD
  const openTasks = input.tasks.filter((t) => t.status !== 'done')
  if (openTasks.length > 0) {
    const founderShare =
      openTasks.filter((t) => t.ownerUserId === input.founderUserId).length / openTasks.length
    if (founderShare >= FOUNDER_TASK_SHARE_THRESHOLD) {
      alerts.push({
        id: id(['founder-overload', input.now]),
        severity: 'warn',
        title: 'Founder owns majority of open tasks',
        detail: `${Math.round(founderShare * 100)}% of open tasks are founder-owned (threshold ${Math.round(
          FOUNDER_TASK_SHARE_THRESHOLD * 100,
        )}%).`,
        ventureSlug: null,
        suggestedAction: 'Triage operator queue and reassign at least 30% of items.',
        ruleCode: 'FOUNDER_TASK_OVERLOAD',
      })
    }
  }

  // Rule: PILOT_WON → expansion playbook
  for (const opp of input.opportunities) {
    if (opp.stage === 'won' && opp.daysStale <= 7) {
      alerts.push({
        id: id(['pilot-won', opp.id]),
        severity: 'info',
        title: `Pilot won: ${opp.name}`,
        detail: 'Trigger expansion playbook taskset and finance handoff.',
        ventureSlug: opp.ventureSlug,
        suggestedAction: 'Open expansion plan in venture page.',
        ruleCode: 'PILOT_WON_EXPANSION',
      })
    }
  }

  // Rule: MRR_DROP
  if (input.finance && input.previousMonthMrrCents != null && input.previousMonthMrrCents > 0) {
    const dropRatio =
      (input.previousMonthMrrCents - input.finance.totalMrrCents) / input.previousMonthMrrCents
    if (dropRatio >= MRR_DROP_THRESHOLD) {
      alerts.push({
        id: id(['mrr-drop', input.now]),
        severity: 'critical',
        title: 'MRR dropped month over month',
        detail: `Studio MRR fell ${Math.round(dropRatio * 100)}% versus last month.`,
        ventureSlug: null,
        suggestedAction: 'Open Finance dashboard and review per-venture deltas.',
        ruleCode: 'MRR_DROP_MOM',
      })
    }
  }

  // Rule: DEPENDENCY_RED
  for (const score of input.dependencyScores) {
    if (score.signal === 'red') {
      alerts.push({
        id: id(['dependency-red', score.ventureSlug]),
        severity: 'critical',
        title: `Founder dependency RED on ${score.ventureSlug}`,
        detail:
          score.reasons.length === 0
            ? `Score ${score.score}/100.`
            : `Score ${score.score}/100 — ${score.reasons.slice(0, 2).join('; ')}.`,
        ventureSlug: score.ventureSlug,
        suggestedAction: 'Open Founder Dependency view and assign a second owner.',
        ruleCode: 'DEPENDENCY_RED',
      })
    }
  }

  return alerts
}
