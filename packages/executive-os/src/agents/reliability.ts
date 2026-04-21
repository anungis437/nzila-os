/**
 * Reliability agent
 *
 * Platform reliability signal:
 *   - SLO burn (by route group): error rate + p95 latency vs target
 *   - incident load: open P1/P2 tickets + SLA breach count
 *   - unresolved problem records (root-cause debt)
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract'

export interface RouteHealth {
  route: string
  requestCount: number
  errorRate: number // 0..1
  p95LatencyMs: number
  errorBudgetTarget?: number // fraction (e.g. 0.01 = 1%)
  latencySloMs?: number
}

export interface ReliabilityIncident {
  ticketId: string
  ticketNumber: string
  priority: 'p1_critical' | 'p2_high' | 'p3_medium' | 'p4_low'
  status: string
  ageHours: number
  slaBreached: boolean
  title: string
}

export interface ReliabilitySignal {
  routes: RouteHealth[]
  incidents: ReliabilityIncident[]
  openProblemsCount: number
  openProblemsAgeDaysP95?: number
}

export const reliabilityAgent: ExecutiveAgent<ReliabilitySignal> = {
  key: 'reliability',
  name: 'Reliability',
  domain: 'platform',
  mission: 'Protect the SLO; surface incident and error-budget burn before users feel it.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No reliability signal available.', insights, actions }

    // Error-budget burn per route
    const burning = sig.routes.filter(
      (r) => r.errorBudgetTarget !== undefined && r.errorRate > r.errorBudgetTarget,
    )
    if (burning.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${burning.length} route(s) burning error budget`,
        body: burning
          .map(
            (r) =>
              `${r.route} · error ${(r.errorRate * 100).toFixed(2)}% / target ${((r.errorBudgetTarget ?? 0) * 100).toFixed(2)}% · ${r.requestCount} req`,
          )
          .join('\n'),
        severity: burning.some((r) => r.errorRate > (r.errorBudgetTarget ?? 0) * 3) ? 'critical' : 'warn',
        confidence: 0.95,
        recommendedNextStep: 'Check recent deploys; consider rollback or circuit-break the failing route.',
      })
      for (const r of burning.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Investigate error spike on ${r.route}`,
          description: `${(r.errorRate * 100).toFixed(2)}% error rate against ${((r.errorBudgetTarget ?? 0) * 100).toFixed(2)}% target.`,
          riskLevel: r.errorRate > (r.errorBudgetTarget ?? 0) * 3 ? 'high' : 'medium',
          confidence: 0.85,
          requiresApproval: true,
        })
      }
    }

    const slow = sig.routes.filter(
      (r) => r.latencySloMs !== undefined && r.p95LatencyMs > r.latencySloMs,
    )
    if (slow.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${slow.length} route(s) exceeding p95 latency SLO`,
        body: slow
          .map((r) => `${r.route} · p95 ${r.p95LatencyMs}ms / SLO ${r.latencySloMs}ms`)
          .join('\n'),
        severity: slow.some((r) => r.p95LatencyMs > (r.latencySloMs ?? 0) * 2) ? 'critical' : 'warn',
        confidence: 0.9,
      })
    }

    const openP1 = sig.incidents.filter(
      (i) => i.priority === 'p1_critical' && i.status !== 'resolved' && i.status !== 'closed',
    )
    const breached = sig.incidents.filter((i) => i.slaBreached)
    if (openP1.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${openP1.length} open P1 incident${openP1.length > 1 ? 's' : ''}`,
        body: openP1
          .map((i) => `${i.ticketNumber} · ${i.title} · ${i.ageHours}h · ${i.status}`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Page on-call, convene war room if >30min old.',
      })
      for (const i of openP1) {
        actions.push({
          actionClass: 'recommendation',
          title: `Escalate P1: ${i.ticketNumber}`,
          description: `${i.title}. ${i.ageHours}h old.`,
          riskLevel: 'critical',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }
    if (breached.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${breached.length} incident${breached.length > 1 ? 's' : ''} past SLA`,
        body: breached
          .slice(0, 10)
          .map((i) => `${i.ticketNumber} · ${i.priority} · ${i.title}`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    if (sig.openProblemsCount > 0) {
      const critical = (sig.openProblemsAgeDaysP95 ?? 0) > 30
      insights.push({
        domain: 'platform',
        title: `${sig.openProblemsCount} unresolved problem record${sig.openProblemsCount > 1 ? 's' : ''}`,
        body: `p95 age ${sig.openProblemsAgeDaysP95 ?? 'n/a'}d — root-cause debt compounds into repeat incidents.`,
        severity: critical ? 'warn' : 'info',
        confidence: 0.8,
        recommendedNextStep: critical ? 'Assign owners and RCA deadlines.' : undefined,
      })
    }

    const ok = burning.length === 0 && slow.length === 0 && openP1.length === 0 && breached.length === 0
    const summary = ok
      ? 'Reliability healthy.'
      : `Reliability: ${burning.length} burning, ${slow.length} slow, ${openP1.length} P1, ${breached.length} SLA breaches.`
    return { summary, insights, actions }
  },
}
