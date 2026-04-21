/**
 * FinOps agent
 *
 * Cost hygiene over platform_cost_rollups + platform_cost_budget_breaches:
 *   - budget breaches (already-flagged events)
 *   - month-over-month category growth > threshold
 *   - top cost categories this month
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export interface CostCategoryTotal {
  category: string
  mtdUsd: number
  lastMonthFullUsd?: number
  // Pro-rated last-month-to-date for an apples-to-apples comparison:
  lastMonthSameDayUsd?: number
}

export interface BudgetBreach {
  recordedAt: string
  state: 'warning' | 'breach' | string
  dailySpendUsd: number
  monthlySpendUsd: number
  categoryBreaches?: Array<{ category: string; amountUsd: number; limitUsd: number }>
}

export interface FinopsSignal {
  categories: CostCategoryTotal[]
  breaches: BudgetBreach[]
  monthlyBudgetUsd?: number
  growthWarnPct?: number // default 0.25 (+25%)
  growthCriticalPct?: number // default 0.5 (+50%)
}

const DEFAULT_WARN = 0.25
const DEFAULT_CRITICAL = 0.5

export const finopsAgent: ExecutiveAgent<FinopsSignal> = {
  key: 'finops',
  name: 'FinOps',
  domain: 'platform',
  mission: 'Keep platform spend proportional to usage; catch runaway cost before the invoice.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No FinOps signal available.', insights, actions }

    const warnPct = sig.growthWarnPct ?? DEFAULT_WARN
    const critPct = sig.growthCriticalPct ?? DEFAULT_CRITICAL

    const mtdTotal = sig.categories.reduce((s, c) => s + c.mtdUsd, 0)

    if (sig.breaches.length > 0) {
      const latest = sig.breaches[0]!
      insights.push({
        domain: 'platform',
        title: `Budget ${latest.state} · $${latest.monthlySpendUsd.toFixed(0)} MTD`,
        body: [
          `Daily: $${latest.dailySpendUsd.toFixed(0)}`,
          ...(latest.categoryBreaches ?? []).map(
            (b) => `  ${b.category} · $${b.amountUsd.toFixed(0)} / $${b.limitUsd.toFixed(0)}`,
          ),
        ].join('\n'),
        severity: latest.state === 'breach' ? 'critical' : 'warn',
        confidence: 1,
        recommendedNextStep: 'Investigate dominant category; throttle or rate-limit if abusive.',
      })
      if (latest.state === 'breach') {
        actions.push({
          actionClass: 'recommendation',
          title: 'Review budget breach and remediate',
          description: `$${latest.monthlySpendUsd.toFixed(0)} MTD.`,
          riskLevel: 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const growing = sig.categories
      .filter(
        (c) =>
          c.lastMonthSameDayUsd !== undefined &&
          c.lastMonthSameDayUsd > 0 &&
          c.mtdUsd / c.lastMonthSameDayUsd - 1 >= warnPct,
      )
      .sort((a, b) => b.mtdUsd / (b.lastMonthSameDayUsd ?? 1) - a.mtdUsd / (a.lastMonthSameDayUsd ?? 1))

    if (growing.length > 0) {
      const criticals = growing.filter(
        (c) => (c.mtdUsd / (c.lastMonthSameDayUsd ?? 1) - 1) >= critPct,
      )
      insights.push({
        domain: 'platform',
        title: `${growing.length} cost categor${growing.length > 1 ? 'ies' : 'y'} growing > ${(warnPct * 100).toFixed(0)}%`,
        body: growing
          .slice(0, 8)
          .map((c) => {
            const growth = ((c.mtdUsd / (c.lastMonthSameDayUsd ?? 1) - 1) * 100).toFixed(0)
            return `${c.category} · MTD $${c.mtdUsd.toFixed(0)} vs $${(c.lastMonthSameDayUsd ?? 0).toFixed(0)} (+${growth}%)`
          })
          .join('\n'),
        severity: criticals.length > 0 ? 'critical' : 'warn',
        confidence: 0.9,
      })
    }

    if (mtdTotal > 0) {
      const top = [...sig.categories].sort((a, b) => b.mtdUsd - a.mtdUsd).slice(0, 5)
      insights.push({
        domain: 'platform',
        title: `Top 5 cost categories MTD · $${mtdTotal.toFixed(0)} total`,
        body: top.map((c) => `${c.category} · $${c.mtdUsd.toFixed(0)}`).join('\n'),
        severity: 'info',
        confidence: 1,
      })
    }

    if (sig.monthlyBudgetUsd && mtdTotal > sig.monthlyBudgetUsd * 0.8) {
      const pct = (mtdTotal / sig.monthlyBudgetUsd) * 100
      insights.push({
        domain: 'platform',
        title: `MTD spend ${pct.toFixed(0)}% of monthly budget`,
        body: `$${mtdTotal.toFixed(0)} of $${sig.monthlyBudgetUsd.toFixed(0)} budget.`,
        severity: pct >= 100 ? 'critical' : 'warn',
        confidence: 1,
      })
    }

    const ok = sig.breaches.length === 0 && growing.length === 0
    const summary = ok
      ? `FinOps healthy · $${mtdTotal.toFixed(0)} MTD.`
      : `FinOps: ${sig.breaches.length} breach(es), ${growing.length} growing categor${growing.length === 1 ? 'y' : 'ies'}.`
    return { summary, insights, actions }
  },
}
