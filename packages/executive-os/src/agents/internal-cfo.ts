/**
 * Internal CFO Agent — strategic finance leadership.
 *
 * Pure function over a finance signal envelope. Surfaces:
 *   - runway health (cash ÷ net burn)
 *   - burn quality (gross vs net burn)
 *   - hiring affordability (cost of planned hires vs runway)
 *   - raise readiness (months of runway vs threshold)
 *   - profitability trajectory (revenue trend vs cost trend)
 *
 * Emits draft_action recommendations for material decisions
 * (e.g. "pause discretionary spend", "delay hire", "open raise process").
 */
import type { ExecutiveAgent, AgentResult, AgentInsight, AgentAction } from '../contract'

export interface CfoSignal {
  /** Latest cash on hand */
  cashOnHand: number
  /** Restricted cash — excluded from runway calc */
  restrictedCash?: number
  /** Last 3 months of net cash burn (positive = burning cash). Index 0 = oldest. */
  monthlyNetBurn: ReadonlyArray<number>
  /** Last 3 months of revenue (cash-in). */
  monthlyRevenue: ReadonlyArray<number>
  /** Outstanding accounts receivable */
  accountsReceivable?: number
  /** Outstanding accounts payable due within 30 days */
  payablesDue30d?: number
  /** Planned hires — fully-loaded monthly cost per hire */
  plannedHires?: ReadonlyArray<{ role: string; monthlyCost: number }>
  /** Discretionary monthly spend the founder controls */
  discretionarySpendMonthly?: number
  /** Founder-stated raise readiness (months of runway minimum to start) */
  raiseRunwayThresholdMonths?: number
}

const DEFAULT_RAISE_THRESHOLD = 9

function avg(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, n) => s + n, 0) / xs.length
}

function trend(xs: ReadonlyArray<number>): 'up' | 'down' | 'flat' {
  if (xs.length < 2) return 'flat'
  const first = xs[0]!
  const last = xs[xs.length - 1]!
  if (first === 0) return last > 0 ? 'up' : 'flat'
  const delta = (last - first) / Math.abs(first)
  if (delta > 0.05) return 'up'
  if (delta < -0.05) return 'down'
  return 'flat'
}

export const internalCfoAgent: ExecutiveAgent<CfoSignal> = {
  key: 'internal-cfo',
  name: 'Internal CFO',
  domain: 'finance',
  mission: 'Protect runway, optimise capital allocation, and surface raise readiness signals.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const s = req.input
    if (!s) {
      return {
        summary: 'No finance signal provided.',
        insights: [],
        actions: [],
      }
    }

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    const usableCash = s.cashOnHand - (s.restrictedCash ?? 0)
    const avgBurn = avg(s.monthlyNetBurn)
    const avgRevenue = avg(s.monthlyRevenue)
    const burnTrend = trend(s.monthlyNetBurn)
    const revenueTrend = trend(s.monthlyRevenue)
    const runwayMonths = avgBurn > 0 ? usableCash / avgBurn : Number.POSITIVE_INFINITY
    const raiseThreshold = s.raiseRunwayThresholdMonths ?? DEFAULT_RAISE_THRESHOLD

    // ── Runway insight (always emitted)
    {
      const severity: AgentInsight['severity'] =
        runwayMonths < 3 ? 'critical' : runwayMonths < 6 ? 'warn' : 'info'
      insights.push({
        domain: 'finance',
        title: `Runway: ${Number.isFinite(runwayMonths) ? runwayMonths.toFixed(1) : '∞'} months`,
        body: `Usable cash $${usableCash.toLocaleString('en-CA')}; avg net burn $${avgBurn.toLocaleString(
          'en-CA',
        )}/mo (trend: ${burnTrend}).`,
        severity,
        confidence: 0.9,
        evidence: { usableCash, avgBurn, burnTrend, runwayMonths },
        consequenceIfIgnored:
          severity === 'critical'
            ? 'Insolvency risk within one quarter without intervention.'
            : severity === 'warn'
            ? 'Forced fundraise or layoffs may follow within two quarters.'
            : undefined,
        recommendedNextStep:
          severity === 'critical'
            ? 'Cut discretionary spend and accelerate AR collection this week.'
            : severity === 'warn'
            ? 'Open raise conversations and review hiring plan.'
            : undefined,
      })
    }

    // ── Burn quality
    if (avgRevenue > 0 && avgBurn > 0) {
      const grossBurn = avgBurn + avgRevenue
      const burnEfficiency = avgRevenue / grossBurn
      insights.push({
        domain: 'finance',
        title: `Burn efficiency: ${(burnEfficiency * 100).toFixed(0)}%`,
        body: `For every $1 of gross spend, $${burnEfficiency.toFixed(2)} returns as revenue. Revenue trend: ${revenueTrend}.`,
        severity: burnEfficiency < 0.3 ? 'warn' : 'info',
        confidence: 0.75,
        evidence: { grossBurn, avgRevenue, burnEfficiency, revenueTrend },
      })
    }

    // ── Critical runway → draft cut
    if (runwayMonths < 6 && (s.discretionarySpendMonthly ?? 0) > 0) {
      actions.push({
        actionClass: 'recommendation',
        title: `Cut discretionary spend ($${s.discretionarySpendMonthly!.toLocaleString('en-CA')}/mo) for 60 days`,
        description:
          `Runway at ${runwayMonths.toFixed(1)}mo is below the 6-month safety threshold. ` +
          `Pausing discretionary spend recovers ~${(s.discretionarySpendMonthly! * 2).toLocaleString(
            'en-CA',
          )} of cash over 60 days.`,
        payload: {
          discretionarySpendMonthly: s.discretionarySpendMonthly,
          recoveryEstimate: s.discretionarySpendMonthly! * 2,
          horizonDays: 60,
        },
        confidence: 0.8,
        riskLevel: runwayMonths < 3 ? 'critical' : 'high',
        requiresApproval: true,
      })
    }

    // ── Hiring affordability
    if (s.plannedHires && s.plannedHires.length > 0 && avgBurn > 0) {
      const totalHireCost = s.plannedHires.reduce((sum, h) => sum + h.monthlyCost, 0)
      const newBurn = avgBurn + totalHireCost
      const newRunway = usableCash / newBurn
      const runwayLossMonths = runwayMonths - newRunway

      const affordable = newRunway >= raiseThreshold
      insights.push({
        domain: 'finance',
        title: `Hiring plan ${affordable ? 'affordable' : 'NOT affordable'}: ${s.plannedHires.length} role${s.plannedHires.length === 1 ? '' : 's'}`,
        body:
          `Total monthly cost: $${totalHireCost.toLocaleString('en-CA')}. ` +
          `Runway after hires: ${newRunway.toFixed(1)}mo (loss of ${runwayLossMonths.toFixed(1)}mo). ` +
          `Threshold: ${raiseThreshold}mo.`,
        severity: affordable ? 'info' : 'warn',
        confidence: 0.85,
        evidence: { totalHireCost, newBurn, newRunway, runwayLossMonths, threshold: raiseThreshold },
      })

      if (!affordable) {
        for (const hire of s.plannedHires) {
          actions.push({
            actionClass: 'recommendation',
            title: `Delay hire: ${hire.role} ($${hire.monthlyCost.toLocaleString('en-CA')}/mo)`,
            description: `Hiring this role drops runway below the ${raiseThreshold}-month threshold.`,
            payload: { role: hire.role, monthlyCost: hire.monthlyCost },
            confidence: 0.75,
            riskLevel: 'medium',
            requiresApproval: true,
          })
        }
      }
    }

    // ── Raise readiness
    if (runwayMonths < raiseThreshold && Number.isFinite(runwayMonths)) {
      actions.push({
        actionClass: 'recommendation',
        title: `Open raise process — ${runwayMonths.toFixed(1)}mo runway < ${raiseThreshold}mo threshold`,
        description:
          'Industry guidance: start a raise with at least 9 months of runway. Below that, leverage drops sharply.',
        payload: { runwayMonths, threshold: raiseThreshold },
        confidence: 0.85,
        riskLevel: runwayMonths < 4 ? 'critical' : 'high',
        requiresApproval: true,
      })
    }

    // ── AR vs cash gap
    if (s.accountsReceivable && s.accountsReceivable > 0 && avgBurn > 0) {
      const arMonths = s.accountsReceivable / avgBurn
      if (arMonths > 1) {
        insights.push({
          domain: 'finance',
          title: `AR represents ${arMonths.toFixed(1)} months of burn`,
          body: `$${s.accountsReceivable.toLocaleString('en-CA')} outstanding. Collecting AR materially extends runway.`,
          severity: 'warn',
          confidence: 0.9,
          evidence: { accountsReceivable: s.accountsReceivable, arMonths },
          recommendedNextStep: 'Trigger Collections agent and prioritise top 3 invoices.',
        })
      }
    }

    // ── AP pressure
    if (s.payablesDue30d && s.payablesDue30d > usableCash * 0.4) {
      insights.push({
        domain: 'finance',
        title: `Payables due in 30 days = ${((s.payablesDue30d / usableCash) * 100).toFixed(0)}% of cash`,
        body: `$${s.payablesDue30d.toLocaleString('en-CA')} due against $${usableCash.toLocaleString('en-CA')} cash.`,
        severity: 'warn',
        confidence: 0.95,
        evidence: { payablesDue30d: s.payablesDue30d, usableCash },
        consequenceIfIgnored: 'Vendor relationships and credit terms degrade quickly past due.',
      })
    }

    const summary = `Runway ${Number.isFinite(runwayMonths) ? runwayMonths.toFixed(1) + 'mo' : '∞'}; ${insights.length} insight${insights.length === 1 ? '' : 's'}, ${actions.length} action${actions.length === 1 ? '' : 's'} pending.`

    return { summary, insights, actions }
  },
}
