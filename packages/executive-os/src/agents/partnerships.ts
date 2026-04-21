/**
 * Partnerships agent
 *
 * Watches the partner deal registry (partners.deals):
 *  - stale deals in a stage for too long
 *  - deal-protection locks that are about to expire
 *  - unreviewed submitted deals (no nzila_reviewer_id + submitted > N days)
 *  - unpaid earned commissions past SLA
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract'

export type PartnerDealStage = 'registered' | 'submitted' | 'approved' | 'won' | 'lost'

export interface PartnerDealSignal {
  dealId: string
  partnerName: string
  accountName: string
  stage: PartnerDealStage
  estimatedArr: number
  daysInStage: number
  lockedUntil?: string | null
  daysUntilLockExpires?: number | null
  hasReviewer: boolean
}

export interface PartnerCommissionSignal {
  commissionId: string
  partnerName: string
  amount: number
  status: 'pending' | 'earned' | 'paid' | 'cancelled'
  ageDays: number
}

export interface PartnershipsSignal {
  deals: PartnerDealSignal[]
  commissions: PartnerCommissionSignal[]
  staleDays?: number
  reviewSlaDays?: number
  commissionPaySlaDays?: number
}

const DEFAULT_STALE = 14
const DEFAULT_REVIEW_SLA = 3
const DEFAULT_COMMISSION_SLA = 30

export const partnershipsAgent: ExecutiveAgent<PartnershipsSignal> = {
  key: 'partnerships',
  name: 'Partnerships',
  domain: 'revenue',
  mission: 'Keep partner deals moving and compensation on time.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No partnerships signal available.', insights, actions }

    const stale = sig.staleDays ?? DEFAULT_STALE
    const reviewSla = sig.reviewSlaDays ?? DEFAULT_REVIEW_SLA
    const payrollSla = sig.commissionPaySlaDays ?? DEFAULT_COMMISSION_SLA

    const unreviewed = sig.deals.filter(
      (d) => d.stage === 'submitted' && !d.hasReviewer && d.daysInStage >= reviewSla,
    )
    if (unreviewed.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${unreviewed.length} submitted deals have no Nzila reviewer`,
        body: unreviewed
          .map((d) => `${d.partnerName} · ${d.accountName} · ${d.daysInStage}d · $${d.estimatedArr.toLocaleString()}`)
          .join('\n'),
        severity: unreviewed.some((d) => d.daysInStage > reviewSla * 3) ? 'critical' : 'warn',
        confidence: 1,
        recommendedNextStep: 'Assign reviewer within SLA window.',
      })
      for (const d of unreviewed) {
        actions.push({
          actionClass: 'recommendation',
          title: `Assign reviewer: ${d.partnerName} → ${d.accountName}`,
          description: `Submitted ${d.daysInStage}d ago. $${d.estimatedArr.toLocaleString()} est ARR.`,
          riskLevel: 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const stalled = sig.deals.filter(
      (d) => !['won', 'lost'].includes(d.stage) && d.daysInStage > stale,
    )
    if (stalled.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${stalled.length} partner deals stalled > ${stale}d`,
        body: stalled
          .slice(0, 10)
          .map((d) => `${d.partnerName} · ${d.accountName} · ${d.stage} · ${d.daysInStage}d`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.9,
      })
    }

    const lockExpiring = sig.deals.filter(
      (d) =>
        d.lockedUntil &&
        d.daysUntilLockExpires !== undefined &&
        d.daysUntilLockExpires !== null &&
        d.daysUntilLockExpires <= 7 &&
        d.daysUntilLockExpires >= 0 &&
        !['won', 'lost'].includes(d.stage),
    )
    if (lockExpiring.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${lockExpiring.length} deal-protection locks expiring within 7d`,
        body: lockExpiring
          .map((d) => `${d.partnerName} · ${d.accountName} · lock expires in ${d.daysUntilLockExpires}d`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
        recommendedNextStep: 'Extend lock or push deal to close.',
      })
    }

    const overdueCommissions = sig.commissions.filter(
      (c) => c.status === 'earned' && c.ageDays > payrollSla,
    )
    if (overdueCommissions.length > 0) {
      const total = overdueCommissions.reduce((s, c) => s + c.amount, 0)
      insights.push({
        domain: 'revenue',
        title: `${overdueCommissions.length} commissions past ${payrollSla}d SLA · $${total.toLocaleString()}`,
        body: overdueCommissions
          .slice(0, 10)
          .map((c) => `${c.partnerName} · $${c.amount.toLocaleString()} · ${c.ageDays}d earned`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Run partner payout batch this week.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Run partner commission payout batch',
        description: `${overdueCommissions.length} commissions · $${total.toLocaleString()} past SLA.`,
        riskLevel: 'high',
        confidence: 1,
        requiresApproval: true,
      })
    }

    const ok =
      unreviewed.length === 0 &&
      stalled.length === 0 &&
      lockExpiring.length === 0 &&
      overdueCommissions.length === 0
    const summary = ok
      ? 'Partnerships pipeline healthy, commissions current.'
      : `Partnerships: ${unreviewed.length} unreviewed, ${stalled.length} stalled, ${lockExpiring.length} locks expiring, ${overdueCommissions.length} overdue payouts.`
    return { summary, insights, actions }
  },
}
