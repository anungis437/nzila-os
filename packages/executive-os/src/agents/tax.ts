/**
 * Tax agent — filing deadlines, installments, approver coverage.
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract'

export interface UpcomingTaxFiling {
  filingId: string
  filingType: string
  periodLabel: string
  dueDate: string
  daysUntilDue: number
  status: 'draft' | 'ready_for_review' | 'submitted' | 'late'
  preparer?: string | null
  approver?: string | null
}

export interface UpcomingInstallment {
  installmentId: string
  authority: 'CRA' | 'Revenu Quebec'
  amount: number
  dueDate: string
  daysUntilDue: number
  status: 'due' | 'paid' | 'late'
}

export interface TaxSignal {
  filings: UpcomingTaxFiling[]
  installments: UpcomingInstallment[]
  warningWindowDays?: number
}

const DEFAULT_WINDOW = 30

export const taxAgent: ExecutiveAgent<TaxSignal> = {
  key: 'tax',
  name: 'Tax',
  domain: 'finance',
  mission: 'Never miss a filing or installment; enforce approver coverage.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No tax signal available.', insights, actions }

    const win = sig.warningWindowDays ?? DEFAULT_WINDOW

    const lateFilings = sig.filings.filter((f) => f.status === 'late' || f.daysUntilDue < 0)
    if (lateFilings.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${lateFilings.length} tax filing(s) LATE`,
        body: lateFilings
          .map((f) => `${f.filingType} ${f.periodLabel} · due ${f.dueDate} (${Math.abs(f.daysUntilDue)}d ago)`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'File immediately and document remediation.',
      })
      for (const f of lateFilings) {
        actions.push({
          actionClass: 'recommendation',
          title: `URGENT: file ${f.filingType} ${f.periodLabel}`,
          description: `Overdue ${Math.abs(f.daysUntilDue)} days. Status: ${f.status}.`,
          riskLevel: 'critical',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const upcoming = sig.filings
      .filter((f) => f.daysUntilDue >= 0 && f.daysUntilDue <= win)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    if (upcoming.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${upcoming.length} tax filing(s) due within ${win} days`,
        body: upcoming
          .map(
            (f) =>
              `${f.filingType} ${f.periodLabel} · due ${f.dueDate} (${f.daysUntilDue}d) · ${f.status}` +
              (f.approver ? '' : ' · NO APPROVER'),
          )
          .join('\n'),
        severity: upcoming.some((f) => f.daysUntilDue <= 7) ? 'warn' : 'info',
        confidence: 1,
      })
      for (const f of upcoming.filter((f) => !f.approver)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Assign approver for ${f.filingType} ${f.periodLabel}`,
          description: `Due in ${f.daysUntilDue} days.`,
          riskLevel: 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const lateInstallments = sig.installments.filter(
      (i) => i.status === 'late' || (i.daysUntilDue < 0 && i.status !== 'paid'),
    )
    if (lateInstallments.length > 0) {
      const total = lateInstallments.reduce((sum, i) => sum + i.amount, 0)
      insights.push({
        domain: 'finance',
        title: `${lateInstallments.length} tax installment(s) LATE — $${total.toLocaleString()}`,
        body: lateInstallments
          .map((i) => `${i.authority} · $${i.amount.toLocaleString()} due ${i.dueDate}`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Pay immediately; CRA/RQ interest accrues daily.',
      })
    }

    const upcomingInst = sig.installments
      .filter((i) => i.status === 'due' && i.daysUntilDue >= 0 && i.daysUntilDue <= win)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    if (upcomingInst.length > 0) {
      const total = upcomingInst.reduce((sum, i) => sum + i.amount, 0)
      insights.push({
        domain: 'finance',
        title: `${upcomingInst.length} installment(s) due in ${win}d — $${total.toLocaleString()}`,
        body: upcomingInst
          .map((i) => `${i.authority} · $${i.amount.toLocaleString()} · ${i.dueDate} (${i.daysUntilDue}d)`)
          .join('\n'),
        severity: upcomingInst.some((i) => i.daysUntilDue <= 7) ? 'warn' : 'info',
        confidence: 1,
      })
    }

    const ok =
      lateFilings.length === 0 &&
      upcoming.length === 0 &&
      lateInstallments.length === 0 &&
      upcomingInst.length === 0
    const summary = ok
      ? `No tax deadlines within ${win} days.`
      : `Tax: ${lateFilings.length} late filing(s), ${upcoming.length} upcoming, ${lateInstallments.length} late installment(s).`
    return { summary, insights, actions }
  },
}
