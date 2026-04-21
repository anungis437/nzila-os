/**
 * RevOps agent
 *
 * Tracks pipeline coverage, stalled opportunities, and forecast realism.
 * Inputs: active commerce opportunities with (stage, estimated value,
 * last-updated age). Emits:
 *  - pipeline coverage vs quarterly target (warn < 3x, critical < 2x)
 *  - stalled opportunities (older than staleDays in current stage)
 *  - stage imbalance (too few late-stage)
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract'

export type RevOpsStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won'

export interface RevOpsOpportunity {
  opportunityId: string
  title: string
  estimatedValue: number
  stage: RevOpsStage
  daysInStage: number
  owner?: string | null
}

export interface RevOpsSignal {
  quarterlyTarget: number // dollars of new ARR/bookings for the quarter
  openOpportunities: RevOpsOpportunity[]
  closedWonThisQuarter: number // dollars
  staleDays?: number // default 21
}

const DEFAULT_STALE = 21

const LATE_STAGES: RevOpsStage[] = ['proposal', 'negotiation']

export const revopsAgent: ExecutiveAgent<RevOpsSignal> = {
  key: 'revops',
  name: 'RevOps',
  domain: 'revenue',
  mission: 'Protect pipeline coverage, unstick deals, and keep the forecast honest.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No RevOps signal available.', insights, actions }

    const staleDays = sig.staleDays ?? DEFAULT_STALE
    const remaining = Math.max(0, sig.quarterlyTarget - sig.closedWonThisQuarter)
    const openValue = sig.openOpportunities.reduce((s, o) => s + o.estimatedValue, 0)
    const coverage = remaining > 0 ? openValue / remaining : Infinity

    if (sig.quarterlyTarget > 0) {
      let severity: 'info' | 'warn' | 'critical' = 'info'
      if (coverage < 2) severity = 'critical'
      else if (coverage < 3) severity = 'warn'
      insights.push({
        domain: 'revenue',
        title: `Pipeline coverage ${coverage === Infinity ? '∞' : coverage.toFixed(1)}x of remaining target`,
        body: `Target: $${sig.quarterlyTarget.toLocaleString()} · closed-won: $${sig.closedWonThisQuarter.toLocaleString()} · open: $${openValue.toLocaleString()} · remaining: $${remaining.toLocaleString()}.`,
        severity,
        confidence: 0.9,
        recommendedNextStep: severity === 'info' ? undefined : 'Top up pipeline or escalate sourcing.',
      })
      if (severity !== 'info') {
        actions.push({
          actionClass: 'recommendation',
          title: 'Run pipeline-sourcing sprint',
          description: `Coverage ${coverage.toFixed(1)}x below healthy 3x. Remaining: $${remaining.toLocaleString()}.`,
          riskLevel: severity === 'critical' ? 'high' : 'medium',
          confidence: 0.8,
          requiresApproval: true,
        })
      }
    }

    const stalled = sig.openOpportunities
      .filter((o) => o.daysInStage > staleDays && o.stage !== 'closed_won')
      .sort((a, b) => b.daysInStage - a.daysInStage)
    if (stalled.length > 0) {
      const stalledValue = stalled.reduce((s, o) => s + o.estimatedValue, 0)
      insights.push({
        domain: 'revenue',
        title: `${stalled.length} stalled opportunities · $${stalledValue.toLocaleString()} at risk`,
        body: stalled
          .slice(0, 8)
          .map((o) => `${o.title} · ${o.stage} · ${o.daysInStage}d (${o.owner ?? 'unassigned'}) · $${o.estimatedValue.toLocaleString()}`)
          .join('\n'),
        severity: stalled[0]!.daysInStage > staleDays * 2 ? 'critical' : 'warn',
        confidence: 0.95,
      })
      for (const o of stalled.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Unstick: ${o.title}`,
          description: `${o.daysInStage}d in ${o.stage}. Owner: ${o.owner ?? 'unassigned'}.`,
          riskLevel: o.daysInStage > staleDays * 2 ? 'high' : 'medium',
          confidence: 0.85,
          requiresApproval: true,
        })
      }
    }

    const lateValue = sig.openOpportunities
      .filter((o) => LATE_STAGES.includes(o.stage))
      .reduce((s, o) => s + o.estimatedValue, 0)
    if (openValue > 0 && lateValue / openValue < 0.3 && remaining > 0) {
      insights.push({
        domain: 'revenue',
        title: 'Pipeline skewed to early stage',
        body: `Only ${((lateValue / openValue) * 100).toFixed(0)}% of open value is in proposal/negotiation. Forecast risk.`,
        severity: 'warn',
        confidence: 0.8,
        recommendedNextStep: 'Push qualified deals into proposal with clear criteria.',
      })
    }

    const summary =
      stalled.length === 0 && (sig.quarterlyTarget === 0 || coverage >= 3)
        ? 'Pipeline healthy.'
        : `RevOps: coverage ${coverage === Infinity ? '∞' : coverage.toFixed(1)}x, ${stalled.length} stalled.`
    return { summary, insights, actions }
  },
}
