/**
 * Product Strategy — product health & portfolio signal.
 *
 * - Products with rising incidents (vs baseline or absolute)
 * - Products with high open bugs
 * - Products with no recent health snapshot (stale telemetry)
 * - Zero-shipment products over the window (no deployments shipped)
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export interface ProductHealth {
  product: string
  incidentsThisMonth: number
  supportLoad: number
  deploymentsShipped: number
  openBugs: number
  snapshotDate: string // YYYY-MM
  ageDays: number // from snapshot
}

export interface ProductStrategySignal {
  products: ReadonlyArray<ProductHealth>
  /** Incident count at/above which we warn. Default 5. */
  incidentWarnThreshold?: number
  /** Open bug count at/above which we warn. Default 30. */
  openBugWarnThreshold?: number
  /** Snapshot age beyond which we call telemetry stale. Default 45d. */
  staleSnapshotDays?: number
}

export const productStrategyAgent: ExecutiveAgent<ProductStrategySignal> = {
  key: 'product-strategy',
  name: 'Product Strategy',
  domain: 'portfolio',
  mission: 'Every product ships, runs, and reports. No silent products.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const signal: ProductStrategySignal = req.input ?? { products: [] }
    const incThresh = signal.incidentWarnThreshold ?? 5
    const bugThresh = signal.openBugWarnThreshold ?? 30
    const staleDays = signal.staleSnapshotDays ?? 45

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    const hotIncidents = signal.products.filter((p) => p.incidentsThisMonth >= incThresh)
    if (hotIncidents.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${hotIncidents.length} product${hotIncidents.length === 1 ? '' : 's'} above incident threshold (${incThresh}/mo)`,
        body: hotIncidents
          .slice(0, 8)
          .map((p) => `- ${p.product}: ${p.incidentsThisMonth} incidents`)
          .join('\n'),
        severity: hotIncidents.some((p) => p.incidentsThisMonth >= incThresh * 2) ? 'critical' : 'warn',
        confidence: 0.85,
        evidence: { products: hotIncidents.map((p) => p.product) },
        recommendedNextStep: 'Open a reliability plan; reprioritize roadmap toward stability.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Fund reliability work',
        payload: { products: hotIncidents.map((p) => p.product) },
        requiresApproval: true,
        confidence: 0.8,
        riskLevel: 'medium',
      })
    }

    const buggyProducts = signal.products.filter((p) => p.openBugs >= bugThresh)
    if (buggyProducts.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${buggyProducts.length} product${buggyProducts.length === 1 ? '' : 's'} with >=${bugThresh} open bugs`,
        body: buggyProducts.slice(0, 8).map((p) => `- ${p.product}: ${p.openBugs} bugs`).join('\n'),
        severity: 'warn',
        confidence: 0.8,
        evidence: { products: buggyProducts.map((p) => p.product) },
        recommendedNextStep: 'Declare a bug-bash sprint or triage aggressively.',
      })
    }

    const staleTelemetry = signal.products.filter((p) => p.ageDays > staleDays)
    if (staleTelemetry.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${staleTelemetry.length} product${staleTelemetry.length === 1 ? '' : 's'} with stale health snapshot (>${staleDays}d)`,
        body: staleTelemetry.slice(0, 8).map((p) => `- ${p.product} (last ${p.ageDays}d ago)`).join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { products: staleTelemetry.map((p) => p.product) },
        recommendedNextStep: 'Restore the health-snapshot pipeline for these products.',
      })
    }

    const zeroShipment = signal.products.filter(
      (p) => p.ageDays <= staleDays && p.deploymentsShipped === 0,
    )
    if (zeroShipment.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${zeroShipment.length} product${zeroShipment.length === 1 ? '' : 's'} shipped zero deployments this window`,
        body: zeroShipment.slice(0, 8).map((p) => `- ${p.product}`).join('\n'),
        severity: 'info',
        confidence: 0.8,
        evidence: { products: zeroShipment.map((p) => p.product) },
        recommendedNextStep: 'Verify that "no change" is intentional; otherwise unblock delivery.',
      })
    }

    const summary =
      insights.length === 0
        ? 'Product portfolio healthy.'
        : `${insights.length} product signal${insights.length === 1 ? '' : 's'}.`
    return { summary, insights, actions }
  },
}
