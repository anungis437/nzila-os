/**
 * Chief of Staff Agent — reference implementation
 *
 * Coordinates leadership priorities. Reads pre-fetched executive signals
 * (decisions, initiatives, time logs, treasury) from the request input
 * and emits today's top priorities + draft delegation actions.
 *
 * The host (apps/console) is responsible for fetching from
 * executionInitiatives, executiveDecisions, treasurySnapshots, and
 * passing them in the request. This keeps the agent pure & testable.
 */
import type { ExecutiveAgent, AgentResult, AgentInsight, AgentAction } from '../contract.js'

export interface ChiefOfStaffSignal {
  initiatives: ReadonlyArray<{
    id: string
    title: string
    status: string
    urgent: boolean
    dueDate: string | null
    owner: string | null
  }>
  decisionsAwaiting: ReadonlyArray<{
    id: string
    title: string
    priority: string
    dueDate: string | null
  }>
  cashOnHand?: number
  weeklyHoursLogged?: number
  weeklyHoursTarget?: number
}

const PRIORITY_RANK: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 }

export const chiefOfStaffAgent: ExecutiveAgent<ChiefOfStaffSignal> = {
  key: 'chief-of-staff',
  name: 'Chief of Staff',
  domain: 'executive',
  mission: 'Coordinate leadership priorities and surface today\'s decisive next steps.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const now = req.now ?? new Date()
    const signal = req.input ?? {
      initiatives: [],
      decisionsAwaiting: [],
    }

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    // ── Priority 1: pending p0/p1 decisions
    const decisive = [...signal.decisionsAwaiting]
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))
      .slice(0, 5)

    if (decisive.length > 0) {
      insights.push({
        domain: 'executive',
        title: `${decisive.length} decision${decisive.length === 1 ? '' : 's'} awaiting your call`,
        body: decisive.map((d) => `[${d.priority.toUpperCase()}] ${d.title}`).join('\n'),
        severity: decisive.some((d) => d.priority === 'p0') ? 'critical' : 'warn',
        confidence: 0.95,
        evidence: { decisionIds: decisive.map((d) => d.id) },
        consequenceIfIgnored: 'Decisions queued without action accumulate strategic debt.',
        recommendedNextStep: `Resolve top decision: ${decisive[0]!.title}`,
      })
    }

    // ── Priority 2: urgent / overdue initiatives
    const overdueOrUrgent = signal.initiatives.filter((i) => {
      if (i.status === 'done' || i.status === 'cancelled') return false
      if (i.urgent) return true
      if (!i.dueDate) return false
      return new Date(i.dueDate) < now
    })

    if (overdueOrUrgent.length > 0) {
      insights.push({
        domain: 'executive',
        title: `${overdueOrUrgent.length} initiative${overdueOrUrgent.length === 1 ? '' : 's'} need attention`,
        body: overdueOrUrgent.slice(0, 5).map((i) => `${i.title}${i.owner ? ` (${i.owner})` : ''}`).join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { initiativeIds: overdueOrUrgent.map((i) => i.id) },
        recommendedNextStep: 'Reassign or unblock owner',
      })

      // Draft delegation actions for ownerless overdue initiatives
      for (const init of overdueOrUrgent.filter((i) => !i.owner).slice(0, 3)) {
        actions.push({
          actionClass: 'draft_action',
          title: `Assign owner to "${init.title}"`,
          description: 'Initiative is past due / urgent with no assigned owner.',
          payload: { initiativeId: init.id, suggestedOwner: null },
          requiresApproval: true,
          confidence: 0.7,
          riskLevel: 'medium',
        })
      }
    }

    // ── Priority 3: founder overload signal
    if (
      signal.weeklyHoursLogged !== undefined &&
      signal.weeklyHoursTarget !== undefined &&
      signal.weeklyHoursTarget > 0
    ) {
      const ratio = signal.weeklyHoursLogged / signal.weeklyHoursTarget
      if (ratio > 1.2) {
        insights.push({
          domain: 'people',
          title: 'Founder overload detected',
          body: `Logged ${signal.weeklyHoursLogged.toFixed(1)}h vs target ${signal.weeklyHoursTarget.toFixed(1)}h (${Math.round(ratio * 100)}%).`,
          severity: 'warn',
          confidence: 0.85,
          evidence: { ratio, logged: signal.weeklyHoursLogged, target: signal.weeklyHoursTarget },
          consequenceIfIgnored: 'Sustained overload degrades decision quality and increases incident risk.',
          recommendedNextStep: 'Identify 2 commitments to delegate or drop this week.',
        })
      }
    }

    // ── Priority 4: cash visibility (informational)
    if (signal.cashOnHand !== undefined) {
      insights.push({
        domain: 'finance',
        title: 'Cash position',
        body: `Cash on hand: $${signal.cashOnHand.toLocaleString('en-CA')}`,
        severity: 'info',
        confidence: 1,
        evidence: { cashOnHand: signal.cashOnHand },
      })
    }

    const summary =
      insights.length === 0
        ? 'No urgent executive signals detected.'
        : `${insights.length} executive signal${insights.length === 1 ? '' : 's'} surfaced; ${actions.length} draft action${actions.length === 1 ? '' : 's'} pending approval.`

    return { summary, insights, actions }
  },
}
