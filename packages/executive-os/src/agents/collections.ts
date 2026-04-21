/**
 * Collections Agent — improve cash collection.
 *
 * Pure function over an AR aging snapshot. Surfaces:
 *   - overdue invoice queue (sorted by impact = amount × days_overdue)
 *   - draft follow-up actions (email reminder / call / escalation)
 *   - dispute flags (invoices flagged by client)
 */
import type { ExecutiveAgent, AgentResult, AgentInsight, AgentAction } from '../contract.js'

export interface OverdueInvoice {
  invoiceId: string
  clientId: string
  clientName: string
  amount: number
  dueDate: string
  daysOverdue: number
  disputed?: boolean
  lastContactDate?: string
  lastContactType?: 'email' | 'call' | 'escalation'
}

export interface CollectionsSignal {
  invoices: ReadonlyArray<OverdueInvoice>
  /** Quiet period (days) before re-contacting same client */
  quietPeriodDays?: number
}

const DEFAULT_QUIET_PERIOD = 5

const NEXT_CONTACT: Record<string, 'email' | 'call' | 'escalation'> = {
  email: 'call',
  call: 'escalation',
  escalation: 'escalation',
}

export const collectionsAgent: ExecutiveAgent<CollectionsSignal> = {
  key: 'collections',
  name: 'Collections',
  domain: 'finance',
  mission: 'Improve cash collection by sequencing follow-ups and surfacing disputes.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const s = req.input
    if (!s) return { summary: 'No collections signal provided.', insights: [], actions: [] }

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const quietPeriod = s.quietPeriodDays ?? DEFAULT_QUIET_PERIOD
    const now = req.now ?? new Date()

    if (s.invoices.length === 0) {
      return { summary: 'No overdue invoices.', insights: [], actions: [] }
    }

    // Rank by impact = amount × daysOverdue
    const ranked = [...s.invoices]
      .map((inv) => ({ ...inv, impact: inv.amount * Math.max(inv.daysOverdue, 1) }))
      .sort((a, b) => b.impact - a.impact)

    const totalOverdue = ranked.reduce((s, i) => s + i.amount, 0)
    const disputed = ranked.filter((i) => i.disputed)

    insights.push({
      domain: 'finance',
      title: `$${totalOverdue.toLocaleString('en-CA')} overdue across ${ranked.length} invoice${ranked.length === 1 ? '' : 's'}`,
      body: ranked
        .slice(0, 5)
        .map((i) => `${i.clientName}: $${i.amount.toLocaleString('en-CA')} (${i.daysOverdue}d overdue)`)
        .join('\n'),
      severity: totalOverdue > 50000 ? 'warn' : 'info',
      confidence: 1,
      evidence: { totalOverdue, count: ranked.length },
    })

    if (disputed.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${disputed.length} invoice${disputed.length === 1 ? '' : 's'} flagged as disputed`,
        body: disputed.map((d) => `${d.clientName}: $${d.amount.toLocaleString('en-CA')}`).join('\n'),
        severity: 'warn',
        confidence: 1,
        evidence: { disputedIds: disputed.map((d) => d.invoiceId) },
        recommendedNextStep: 'Review dispute reasons before sending automated reminders.',
      })
    }

    // Draft follow-ups (top 5 non-disputed)
    for (const inv of ranked.filter((i) => !i.disputed).slice(0, 5)) {
      const daysSinceContact = inv.lastContactDate
        ? Math.floor((now.getTime() - new Date(inv.lastContactDate).getTime()) / 86_400_000)
        : Infinity
      if (daysSinceContact < quietPeriod) continue

      const nextType = inv.lastContactType ? NEXT_CONTACT[inv.lastContactType] : 'email'
      const isEscalation = nextType === 'escalation'

      actions.push({
        actionClass: 'draft_action',
        title: `${nextType === 'email' ? 'Email' : nextType === 'call' ? 'Call' : 'Escalate'}: ${inv.clientName} — $${inv.amount.toLocaleString('en-CA')} (${inv.daysOverdue}d)`,
        description:
          isEscalation
            ? 'Prior email + call exhausted. Escalate to founder or legal.'
            : nextType === 'call'
            ? 'Email reminder sent previously without resolution. Schedule a call.'
            : 'Send first reminder email with payment link.',
        payload: {
          invoiceId: inv.invoiceId,
          clientId: inv.clientId,
          contactType: nextType,
          amount: inv.amount,
          daysOverdue: inv.daysOverdue,
        },
        confidence: 0.85,
        riskLevel: isEscalation ? 'high' : 'low',
        requiresApproval: true,
      })
    }

    return {
      summary: `$${totalOverdue.toLocaleString('en-CA')} overdue; ${actions.length} follow-up draft${actions.length === 1 ? '' : 's'} ready.`,
      insights,
      actions,
    }
  },
}
