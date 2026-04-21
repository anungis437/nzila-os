/**
 * Portfolio Allocator — initiative/venture balance.
 *
 * - Too many in-progress initiatives per venture → focus loss
 * - Initiatives without owner → accountability gap
 * - Zone imbalance: >N initiatives in one zone, zero in another required zone
 * - Overdue in-progress initiatives → critical
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract'

export type InitiativeStatus = 'not-started' | 'in-progress' | 'done'

export interface InitiativeRecord {
  id: string
  title: string
  venture: string | null
  zone: string | null
  owner: string | null
  status: InitiativeStatus
  dueDate: string | null // ISO date
  urgent: boolean
  ageDays: number
}

export interface PortfolioSignal {
  initiatives: ReadonlyArray<InitiativeRecord>
  /** Zones that must have at least 1 live initiative. */
  requiredZones?: ReadonlyArray<string>
  /** Max concurrent in-progress per venture before focus-loss warning. */
  maxConcurrentInProgress?: number
}

export const portfolioAllocatorAgent: ExecutiveAgent<PortfolioSignal> = {
  key: 'portfolio-allocator',
  name: 'Portfolio Allocator',
  domain: 'portfolio',
  mission: 'Keep the initiative portfolio balanced, owned, and on schedule.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const now = req.now ?? new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const signal: PortfolioSignal = req.input ?? { initiatives: [] }
    const maxConcurrent = signal.maxConcurrentInProgress ?? 5
    const required = signal.requiredZones ?? []

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    const inProgress = signal.initiatives.filter((i) => i.status === 'in-progress')

    // Overdue in-progress
    const overdue = inProgress.filter(
      (i) => i.dueDate && new Date(i.dueDate).getTime() < today.getTime(),
    )
    if (overdue.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${overdue.length} overdue initiative${overdue.length === 1 ? '' : 's'} still in-progress`,
        body: overdue
          .slice(0, 8)
          .map((i) => `- ${i.title} (due ${i.dueDate}${i.owner ? `, owner ${i.owner}` : ''})`)
          .join('\n'),
        severity: 'critical',
        confidence: 0.95,
        evidence: { initiativeIds: overdue.map((i) => i.id) },
        recommendedNextStep: 'Re-scope, re-date, or close these initiatives in the weekly operating review.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Triage overdue initiatives',
        description: `Decide done / re-date / kill for ${overdue.length} overdue in-progress initiatives.`,
        payload: { initiativeIds: overdue.map((i) => i.id) },
        requiresApproval: true,
        confidence: 0.9,
        riskLevel: 'medium',
      })
    }

    // No owner
    const ownerless = inProgress.filter((i) => !i.owner || i.owner.trim() === '')
    if (ownerless.length > 0) {
      insights.push({
        domain: 'portfolio',
        title: `${ownerless.length} in-progress initiative${ownerless.length === 1 ? '' : 's'} without an owner`,
        body: ownerless.slice(0, 8).map((i) => `- ${i.title}`).join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { initiativeIds: ownerless.map((i) => i.id) },
        recommendedNextStep: 'Assign a directly responsible individual (DRI) to each.',
      })
    }

    // Concurrency per venture
    const byVenture = new Map<string, InitiativeRecord[]>()
    for (const i of inProgress) {
      const k = i.venture ?? '<unassigned>'
      const arr = byVenture.get(k) ?? []
      arr.push(i)
      byVenture.set(k, arr)
    }
    for (const [venture, items] of byVenture) {
      if (items.length > maxConcurrent) {
        insights.push({
          domain: 'portfolio',
          title: `Venture "${venture}" has ${items.length} concurrent in-progress initiatives (cap ${maxConcurrent})`,
          body: `Focus-loss risk. Pick top ${maxConcurrent}; park the rest.`,
          severity: 'warn',
          confidence: 0.8,
          evidence: { venture, count: items.length, cap: maxConcurrent },
          recommendedNextStep: `Pause or kill ${items.length - maxConcurrent} initiatives in ${venture}.`,
        })
      }
    }

    // Required-zone coverage
    if (required.length > 0) {
      const active = new Set(
        inProgress
          .map((i) => i.zone)
          .filter((z): z is string => !!z),
      )
      const missing = required.filter((z) => !active.has(z))
      if (missing.length > 0) {
        insights.push({
          domain: 'portfolio',
          title: `No in-progress initiatives in required zone(s): ${missing.join(', ')}`,
          body: 'Strategic zones have zero live investment this period.',
          severity: 'warn',
          confidence: 0.85,
          evidence: { zones: missing },
          recommendedNextStep: 'Stand up at least one initiative per required zone.',
        })
      }
    }

    const summary =
      insights.length === 0
        ? 'Portfolio balanced, owned, and on schedule.'
        : `${insights.length} portfolio signal${insights.length === 1 ? '' : 's'}.`

    return { summary, insights, actions }
  },
}
