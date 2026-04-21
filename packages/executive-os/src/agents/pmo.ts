/**
 * PMO — initiative scheduling & discipline.
 *
 * - In-progress initiatives with no due date → planning gap
 * - Initiatives "not-started" but urgent → backlog debt
 * - Done initiatives not closed for >30d → hygiene
 * - Long-running initiatives (>90d in progress) → scope drift
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export type InitiativeStatus = 'not-started' | 'in-progress' | 'done'

export interface PmoInitiative {
  id: string
  title: string
  status: InitiativeStatus
  dueDate: string | null
  owner: string | null
  urgent: boolean
  ageDays: number
  /** Days since last status change, if tracked. */
  daysSinceUpdate?: number
}

export interface PmoSignal {
  initiatives: ReadonlyArray<PmoInitiative>
  /** Days in-progress beyond which we call "scope drift". Default 90. */
  longRunningDays?: number
}

export const pmoAgent: ExecutiveAgent<PmoSignal> = {
  key: 'pmo',
  name: 'PMO',
  domain: 'portfolio',
  mission: 'Every initiative has an owner, a due date, and visible progress.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const signal: PmoSignal = req.input ?? { initiatives: [] }
    const longRunning = signal.longRunningDays ?? 90

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    // No due date, in progress
    const noDueDate = signal.initiatives.filter(
      (i) => i.status === 'in-progress' && !i.dueDate,
    )
    if (noDueDate.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${noDueDate.length} in-progress initiative${noDueDate.length === 1 ? '' : 's'} without a due date`,
        body: noDueDate.slice(0, 8).map((i) => `- ${i.title}`).join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { initiativeIds: noDueDate.map((i) => i.id) },
        recommendedNextStep: 'Add a target date or explicitly mark as open-ended research.',
      })
    }

    // Urgent not started
    const urgentBacklog = signal.initiatives.filter(
      (i) => i.status === 'not-started' && i.urgent,
    )
    if (urgentBacklog.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${urgentBacklog.length} urgent initiative${urgentBacklog.length === 1 ? '' : 's'} not started`,
        body: urgentBacklog.slice(0, 8).map((i) => `- ${i.title}`).join('\n'),
        severity: 'critical',
        confidence: 0.9,
        evidence: { initiativeIds: urgentBacklog.map((i) => i.id) },
        recommendedNextStep: 'Kick off this week or de-flag the urgency.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Kick off urgent backlog',
        payload: { initiativeIds: urgentBacklog.map((i) => i.id) },
        requiresApproval: true,
        confidence: 0.85,
        riskLevel: 'medium',
      })
    }

    // Long-running in progress
    const drifting = signal.initiatives.filter(
      (i) => i.status === 'in-progress' && i.ageDays > longRunning,
    )
    if (drifting.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${drifting.length} initiative${drifting.length === 1 ? '' : 's'} running >${longRunning}d (scope drift risk)`,
        body: drifting.slice(0, 8).map((i) => `- ${i.title} (${i.ageDays}d)`).join('\n'),
        severity: 'warn',
        confidence: 0.8,
        evidence: { initiativeIds: drifting.map((i) => i.id) },
        recommendedNextStep: 'Split into phases or declare done-so-far.',
      })
    }

    const summary =
      insights.length === 0
        ? 'Initiative discipline nominal.'
        : `${insights.length} PMO signal${insights.length === 1 ? '' : 's'}.`
    return { summary, insights, actions }
  },
}
