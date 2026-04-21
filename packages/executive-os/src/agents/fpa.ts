/**
 * FP&A agent — budget-vs-actual variance with persistence detection.
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract.js'

export interface FpaLineActuals {
  period: string
  budget: number
  actual: number
}

export interface FpaLine {
  lineId: string
  label: string
  category: 'revenue' | 'expense' | 'other'
  history: FpaLineActuals[]
}

export interface FpaSignal {
  lines: FpaLine[]
  windowPeriods?: number
  materialPct?: number
  severePct?: number
}

const DEFAULT_WINDOW = 3
const DEFAULT_MATERIAL = 0.1
const DEFAULT_SEVERE = 0.25

interface VarianceRow {
  line: FpaLine
  worstAbsPct: number
  averageAbsPct: number
  direction: 'over' | 'under' | 'mixed'
  periodsOver: number
}

export const fpaAgent: ExecutiveAgent<FpaSignal> = {
  key: 'fpa',
  name: 'FP&A',
  domain: 'finance',
  mission: 'Detect budget variance early; distinguish noise from new baselines.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No FP&A signal available.', insights, actions }

    const window = sig.windowPeriods ?? DEFAULT_WINDOW
    const material = sig.materialPct ?? DEFAULT_MATERIAL
    const severe = sig.severePct ?? DEFAULT_SEVERE

    const rows: VarianceRow[] = []
    for (const line of sig.lines) {
      const recent = line.history.slice(-window)
      if (recent.length === 0) continue
      const pcts = recent.map((p) => {
        if (p.budget === 0) return p.actual === 0 ? 0 : 1
        return (p.actual - p.budget) / Math.abs(p.budget)
      })
      const absPcts = pcts.map(Math.abs)
      const worst = Math.max(...absPcts)
      const avg = absPcts.reduce((a, b) => a + b, 0) / absPcts.length
      const periodsOver = absPcts.filter((p) => p >= material).length
      const directions = pcts.map((p) => (p > 0 ? 'over' : p < 0 ? 'under' : 'flat'))
      const allOver = directions.every((d) => d === 'over' || d === 'flat')
      const allUnder = directions.every((d) => d === 'under' || d === 'flat')
      const direction: VarianceRow['direction'] = allOver ? 'over' : allUnder ? 'under' : 'mixed'
      rows.push({ line, worstAbsPct: worst, averageAbsPct: avg, direction, periodsOver })
    }

    const flagged = rows
      .filter((r) => r.worstAbsPct >= material)
      .sort((a, b) => b.worstAbsPct - a.worstAbsPct)
    const severeRows = flagged.filter((r) => r.worstAbsPct >= severe)
    const persistent = flagged.filter((r) => r.periodsOver === window && window > 1)

    if (flagged.length === 0) {
      return {
        summary: `All ${rows.length} lines within ${(material * 100).toFixed(0)}% of budget.`,
        insights,
        actions,
      }
    }

    insights.push({
      domain: 'finance',
      title: `${flagged.length} budget lines off plan`,
      body: flagged
        .slice(0, 10)
        .map(
          (r) =>
            `${r.line.label} (${r.line.category}) · worst ${(r.worstAbsPct * 100).toFixed(1)}% ${r.direction} · avg ${(r.averageAbsPct * 100).toFixed(1)}%`,
        )
        .join('\n'),
      severity: severeRows.length > 0 ? 'critical' : 'warn',
      confidence: 0.9,
      recommendedNextStep: 'Review reforecast for next month.',
    })

    if (severeRows.length > 0) {
      for (const r of severeRows.slice(0, 5)) {
        const isExpenseOver = r.line.category === 'expense' && r.direction === 'over'
        const isRevenueUnder = r.line.category === 'revenue' && r.direction === 'under'
        const risky = isExpenseOver || isRevenueUnder
        actions.push({
          actionClass: 'recommendation',
          title: `Reforecast ${r.line.label}`,
          description: `Worst variance ${(r.worstAbsPct * 100).toFixed(1)}% ${r.direction} over ${window} periods.`,
          riskLevel: risky ? 'high' : 'medium',
          confidence: 0.85,
          requiresApproval: true,
        })
      }
    }

    if (persistent.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${persistent.length} lines persistently off all ${window} periods`,
        body: persistent.map((r) => `${r.line.label} · ${r.direction}`).join('\n'),
        severity: 'warn',
        confidence: 0.95,
        recommendedNextStep: 'Treat persistent variance as the new baseline; rebudget.',
      })
    }

    return {
      summary: `${flagged.length} off plan (${severeRows.length} severe, ${persistent.length} persistent).`,
      insights,
      actions,
    }
  },
}
