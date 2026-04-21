/**
 * COO — cross-functional operations health.
 *
 * Combines initiative execution + open ops tickets + customer onboarding
 * milestone slippage into a single operating signal.
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract'

export type InitiativeStatus = 'not-started' | 'in-progress' | 'done'

export interface CooInitiative {
  id: string
  title: string
  status: InitiativeStatus
  dueDate: string | null
  owner: string | null
  ageDays: number
}

export interface CooTicket {
  id: string
  title: string
  priority: 'p0' | 'p1' | 'p2' | 'p3'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  ageDays: number
  breachedSla: boolean
}

export interface CooMilestone {
  id: string
  label: string
  dueDate: string | null
  completedAt: string | null
  daysLate: number // 0 if on time or not yet due
}

export interface CooSignal {
  initiatives: ReadonlyArray<CooInitiative>
  openTickets: ReadonlyArray<CooTicket>
  milestones: ReadonlyArray<CooMilestone>
  /** Threshold for "stalled" initiatives (default 21d). */
  stalledInitiativeDays?: number
}

export const cooAgent: ExecutiveAgent<CooSignal> = {
  key: 'coo',
  name: 'COO',
  domain: 'operations',
  mission: 'Keep execution flowing — no stalled initiatives, no SLA breaches, no milestone surprises.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const now = req.now ?? new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const signal: CooSignal = req.input ?? { initiatives: [], openTickets: [], milestones: [] }
    const stalledDays = signal.stalledInitiativeDays ?? 21

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    // Stalled initiatives (in-progress, old, no recent movement proxy = ageDays)
    const stalled = signal.initiatives.filter(
      (i) => i.status === 'in-progress' && i.ageDays >= stalledDays,
    )
    if (stalled.length > 0) {
      insights.push({
        domain: 'operations',
        title: `${stalled.length} initiative${stalled.length === 1 ? '' : 's'} stalled >${stalledDays}d`,
        body: stalled.slice(0, 8).map((i) => `- ${i.title} (${i.ageDays}d, owner ${i.owner ?? '—'})`).join('\n'),
        severity: 'warn',
        confidence: 0.85,
        evidence: { initiativeIds: stalled.map((i) => i.id) },
        recommendedNextStep: 'Operating review: kill, re-scope, or unblock each.',
      })
    }

    // Overdue initiatives
    const overdueInits = signal.initiatives.filter(
      (i) => i.status !== 'done' && i.dueDate && new Date(i.dueDate).getTime() < today.getTime(),
    )
    if (overdueInits.length > 0) {
      insights.push({
        domain: 'operations',
        title: `${overdueInits.length} initiative${overdueInits.length === 1 ? '' : 's'} past due`,
        body: overdueInits.slice(0, 8).map((i) => `- ${i.title} (due ${i.dueDate})`).join('\n'),
        severity: 'critical',
        confidence: 0.95,
        evidence: { initiativeIds: overdueInits.map((i) => i.id) },
        recommendedNextStep: 'Close, re-baseline, or escalate.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Triage overdue initiatives',
        payload: { initiativeIds: overdueInits.map((i) => i.id) },
        requiresApproval: true,
        confidence: 0.9,
        riskLevel: 'medium',
      })
    }

    // SLA breaches
    const breaches = signal.openTickets.filter((t) => t.breachedSla)
    if (breaches.length > 0) {
      insights.push({
        domain: 'operations',
        title: `${breaches.length} open ticket${breaches.length === 1 ? '' : 's'} breached SLA`,
        body: breaches.slice(0, 8).map((t) => `- [${t.priority}] ${t.title} (${t.ageDays}d)`).join('\n'),
        severity: 'critical',
        confidence: 0.9,
        evidence: { ticketIds: breaches.map((t) => t.id) },
        recommendedNextStep: 'Reassign or escalate; root-cause the SLA breach.',
      })
    }

    // P0/P1 without movement
    const highPrio = signal.openTickets.filter(
      (t) => (t.priority === 'p0' || t.priority === 'p1') && t.status === 'open' && t.ageDays >= 2,
    )
    if (highPrio.length > 0) {
      insights.push({
        domain: 'operations',
        title: `${highPrio.length} P0/P1 ticket${highPrio.length === 1 ? '' : 's'} still "open" (not in-progress)`,
        body: 'Unassigned high-priority work.',
        severity: 'warn',
        confidence: 0.85,
        evidence: { ticketIds: highPrio.map((t) => t.id) },
        recommendedNextStep: 'Assign an owner within the hour.',
      })
    }

    // Late milestones
    const lateMilestones = signal.milestones.filter((m) => !m.completedAt && m.daysLate > 0)
    if (lateMilestones.length > 0) {
      insights.push({
        domain: 'operations',
        title: `${lateMilestones.length} onboarding milestone${lateMilestones.length === 1 ? '' : 's'} late`,
        body: lateMilestones.slice(0, 8).map((m) => `- ${m.label} (${m.daysLate}d late)`).join('\n'),
        severity: lateMilestones.some((m) => m.daysLate > 14) ? 'critical' : 'warn',
        confidence: 0.9,
        evidence: { milestoneIds: lateMilestones.map((m) => m.id) },
        recommendedNextStep: 'Contact customer success; re-baseline or recover.',
      })
    }

    const summary =
      insights.length === 0
        ? 'Operations nominal.'
        : `${insights.length} operating signal${insights.length === 1 ? '' : 's'}.`
    return { summary, insights, actions }
  },
}
