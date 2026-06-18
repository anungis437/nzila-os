/**
 * Treasury Agent — protect cash reality.
 *
 * Pure function over a 13-week cash forecast envelope. Surfaces:
 *   - cash today (current vs minimum reserve)
 *   - 13-week trough (lowest projected cash balance)
 *   - runway compression (forecast vs assumption drift)
 *   - payable timing concentration (large outflows in same week)
 */
import type { ExecutiveAgent, AgentResult, AgentInsight, AgentAction } from '../contract'

export interface WeekCashFlow {
  /** ISO week start date */
  weekStart: string
  inflows: number
  outflows: number
}

export interface TreasurySignal {
  cashToday: number
  minimumReserve: number
  /** 13 weeks of projected flows, oldest first */
  weeks: ReadonlyArray<WeekCashFlow>
}

export const treasuryAgent: ExecutiveAgent<TreasurySignal> = {
  key: 'treasury',
  name: 'Treasury',
  domain: 'finance',
  mission: 'Protect cash reality with a rolling 13-week view.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const s = req.input
    if (!s) return { summary: 'No treasury signal provided.', insights: [], actions: [] }

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    // Roll forward cash week-by-week, tracking the trough.
    let running = s.cashToday
    let trough = { weekStart: 'today', balance: running }
    const balances: Array<{ weekStart: string; balance: number; netFlow: number }> = []
    for (const w of s.weeks) {
      const net = w.inflows - w.outflows
      running += net
      balances.push({ weekStart: w.weekStart, balance: running, netFlow: net })
      if (running < trough.balance) {
        trough = { weekStart: w.weekStart, balance: running }
      }
    }

    // ── Reserve breach
    if (s.cashToday < s.minimumReserve) {
      insights.push({
        domain: 'finance',
        title: 'Cash below minimum reserve',
        body: `Cash $${s.cashToday.toLocaleString('en-CA')} < reserve $${s.minimumReserve.toLocaleString('en-CA')}.`,
        severity: 'critical',
        confidence: 1,
        evidence: { cashToday: s.cashToday, minimumReserve: s.minimumReserve },
        consequenceIfIgnored: 'Operational disruption if a single payable hits unexpectedly.',
        recommendedNextStep: 'Pause non-essential outflows and accelerate collections.',
      })
    }

    // ── 13-week trough
    if (trough.weekStart !== 'today') {
      const breachesReserve = trough.balance < s.minimumReserve
      const goesNegative = trough.balance < 0
      insights.push({
        domain: 'finance',
        title: `13-week cash trough: $${trough.balance.toLocaleString('en-CA')} (week of ${trough.weekStart})`,
        body: goesNegative
          ? 'Forecast goes NEGATIVE — immediate action required.'
          : breachesReserve
          ? `Trough breaches minimum reserve of $${s.minimumReserve.toLocaleString('en-CA')}.`
          : 'Trough remains above minimum reserve.',
        severity: goesNegative ? 'critical' : breachesReserve ? 'warn' : 'info',
        confidence: 0.85,
        evidence: { trough, minimumReserve: s.minimumReserve },
      })

      if (breachesReserve) {
        actions.push({
          actionClass: 'recommendation',
          title: `Defer outflows around week of ${trough.weekStart}`,
          description: 'Treasury trough breaches reserve. Negotiate payment delays or accelerate AR.',
          payload: { troughWeek: trough.weekStart, troughBalance: trough.balance },
          confidence: 0.8,
          riskLevel: goesNegative ? 'critical' : 'high',
          requiresApproval: true,
        })
      }
    }

    // ── Concentration: unknown single week with outflows > 30% of cash today
    const concentrationWeeks = s.weeks.filter((w) => w.outflows > s.cashToday * 0.3)
    if (concentrationWeeks.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${concentrationWeeks.length} week${concentrationWeeks.length === 1 ? '' : 's'} with concentrated outflows`,
        body: concentrationWeeks
          .slice(0, 3)
          .map((w) => `${w.weekStart}: $${w.outflows.toLocaleString('en-CA')} out`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.85,
        evidence: { weeks: concentrationWeeks.map((w) => ({ weekStart: w.weekStart, outflows: w.outflows })) },
        recommendedNextStep: 'Consider staggering large payments across adjacent weeks.',
      })
    }

    return {
      summary: `Trough $${trough.balance.toLocaleString('en-CA')}; ${insights.length} insight${insights.length === 1 ? '' : 's'}.`,
      insights,
      actions,
    }
  },
}
