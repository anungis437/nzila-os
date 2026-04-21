/**
 * CS / Renewal agent
 *
 * Watches account health, upcoming renewals, and churn risk signals.
 * Inputs describe each customer's health, ARR, renewal date, and
 * recent support/usage signals. Emits:
 *  - upcoming renewals in window (default 90 days) with risk bucket
 *  - critical at-risk accounts
 *  - expansion opportunities (healthy accounts with ARR growth signal)
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract'

export type HealthScore = 'green' | 'yellow' | 'red'

export interface CsAccount {
  customerId: string
  customerName: string
  arr: number
  renewalDate?: string // ISO
  daysUntilRenewal?: number
  healthScore: HealthScore
  lastTouchDaysAgo?: number
  openTickets?: number
  usageTrend?: 'up' | 'flat' | 'down'
  expansionSignal?: boolean
}

export interface CsSignal {
  accounts: CsAccount[]
  renewalWindowDays?: number // default 90
  quietTouchDays?: number // warn if no touch in N days for yellow/red
}

const DEFAULT_WINDOW = 90
const DEFAULT_QUIET = 21

export const csRenewalAgent: ExecutiveAgent<CsSignal> = {
  key: 'cs-renewal',
  name: 'CS / Renewal',
  domain: 'revenue',
  mission: 'Protect retained ARR; catch churn risk before the renewal clock runs out.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No CS signal available.', insights, actions }

    const win = sig.renewalWindowDays ?? DEFAULT_WINDOW
    const quiet = sig.quietTouchDays ?? DEFAULT_QUIET

    const red = sig.accounts.filter((a) => a.healthScore === 'red')
    const yellow = sig.accounts.filter((a) => a.healthScore === 'yellow')

    const upcoming = sig.accounts
      .filter((a) => a.daysUntilRenewal !== undefined && a.daysUntilRenewal >= 0 && a.daysUntilRenewal <= win)
      .sort((a, b) => (a.daysUntilRenewal ?? 0) - (b.daysUntilRenewal ?? 0))

    if (red.length > 0) {
      const redArr = red.reduce((s, a) => s + a.arr, 0)
      insights.push({
        domain: 'revenue',
        title: `${red.length} RED accounts · $${redArr.toLocaleString()} ARR at risk`,
        body: red
          .map((a) => `${a.customerName} · $${a.arr.toLocaleString()} ARR · ${a.usageTrend ?? 'trend unknown'}${a.openTickets ? ` · ${a.openTickets} open tickets` : ''}`)
          .join('\n'),
        severity: 'critical',
        confidence: 0.95,
        recommendedNextStep: 'Exec sponsor + remediation plan within 5 business days.',
      })
      for (const a of red.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Save plan: ${a.customerName}`,
          description: `RED. $${a.arr.toLocaleString()} ARR. ${a.usageTrend === 'down' ? 'Usage dropping. ' : ''}${a.renewalDate ? `Renewal ${a.renewalDate}.` : ''}`.trim(),
          riskLevel: 'critical',
          confidence: 0.9,
          requiresApproval: true,
        })
      }
    }

    if (upcoming.length > 0) {
      const totalUpcomingArr = upcoming.reduce((s, a) => s + a.arr, 0)
      const redInWindow = upcoming.filter((a) => a.healthScore === 'red').length
      insights.push({
        domain: 'revenue',
        title: `${upcoming.length} renewals in ${win}d · $${totalUpcomingArr.toLocaleString()}`,
        body: upcoming
          .slice(0, 10)
          .map(
            (a) =>
              `${a.customerName} · ${a.daysUntilRenewal}d · ${a.healthScore} · $${a.arr.toLocaleString()}`,
          )
          .join('\n'),
        severity: redInWindow > 0 ? 'critical' : upcoming.some((a) => (a.daysUntilRenewal ?? 99) <= 30) ? 'warn' : 'info',
        confidence: 1,
      })
    }

    const quietRisky = [...red, ...yellow].filter(
      (a) => a.lastTouchDaysAgo !== undefined && a.lastTouchDaysAgo > quiet,
    )
    if (quietRisky.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${quietRisky.length} at-risk accounts untouched > ${quiet}d`,
        body: quietRisky
          .map((a) => `${a.customerName} · ${a.healthScore} · ${a.lastTouchDaysAgo}d since last touch`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.9,
        recommendedNextStep: 'Schedule check-in calls this week.',
      })
      for (const a of quietRisky.slice(0, 5)) {
        actions.push({
          actionClass: 'draft_action',
          title: `Draft check-in email: ${a.customerName}`,
          description: `${a.lastTouchDaysAgo}d since last touch. Health: ${a.healthScore}.`,
          riskLevel: 'low',
          confidence: 0.8,
          requiresApproval: true,
        })
      }
    }

    const expansion = sig.accounts.filter((a) => a.expansionSignal && a.healthScore === 'green')
    if (expansion.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${expansion.length} expansion opportunities (green + signal)`,
        body: expansion
          .map((a) => `${a.customerName} · $${a.arr.toLocaleString()} ARR${a.usageTrend === 'up' ? ' · usage up' : ''}`)
          .join('\n'),
        severity: 'info',
        confidence: 0.8,
        recommendedNextStep: 'AE + CSM build expansion pitch.',
      })
    }

    const summary =
      red.length === 0 && quietRisky.length === 0 && upcoming.length === 0
        ? 'CS healthy.'
        : `CS: ${red.length} red, ${upcoming.length} upcoming renewals, ${quietRisky.length} quiet-risky.`
    return { summary, insights, actions }
  },
}
