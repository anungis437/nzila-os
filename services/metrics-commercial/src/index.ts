import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type CommercialEventType =
  | 'acquisition'
  | 'activation'
  | 'retention'
  | 'feature_usage'
  | 'conversion_signal'

export interface CommercialEvent {
  id: string
  ts: string
  userId: string
  app: string
  type: CommercialEventType
  feature?: string
  metadata?: Record<string, unknown>
}

export interface CommercialDashboard {
  funnel: Array<{ stage: string; users: number; conversionRate: number }>
  retention: Array<{ cohort: string; day1: number; day7: number; day30: number }>
  featureUsage: Array<{ feature: string; events: number }>
  revenueProxy: {
    activeUsers: number
    conversionSignals: number
    weightedProxyScore: number
  }
}

export interface SimulatedEconomicsDashboard {
  orgCount: number
  customerOrgs: number
  acquisitionSpend: number
  monthlyRecurringRevenue: number
  cacProxy: number
  ltvProxy: number
  expansionSignals: number
  generatedAt: string
}

class CommercialStore {
  constructor(private readonly path = join(process.cwd(), 'data', 'commercial-metrics-events.json')) {}

  async append(events: CommercialEvent[]): Promise<void> {
    const existing = await this.list()
    await this.write([...existing, ...events])
  }

  async list(): Promise<CommercialEvent[]> {
    try {
      const raw = await readFile(this.path, 'utf-8')
      return JSON.parse(raw) as CommercialEvent[]
    } catch {
      return []
    }
  }

  private async write(value: unknown): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    await writeFile(this.path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  }
}

export class MetricsCommercialService {
  private readonly store = new CommercialStore()

  async record(event: Omit<CommercialEvent, 'id' | 'ts'> & Partial<Pick<CommercialEvent, 'id' | 'ts'>>): Promise<CommercialEvent> {
    const normalized: CommercialEvent = {
      id: event.id ?? randomUUID(),
      ts: event.ts ?? new Date().toISOString(),
      ...event,
    }
    await this.store.append([normalized])
    return normalized
  }

  async recordBatch(
    events: Array<Omit<CommercialEvent, 'id' | 'ts'> & Partial<Pick<CommercialEvent, 'id' | 'ts'>>>,
  ): Promise<number> {
    const normalized = events.map((event) => ({
      id: event.id ?? randomUUID(),
      ts: event.ts ?? new Date().toISOString(),
      ...event,
    }))

    await this.store.append(normalized)
    return normalized.length
  }

  async getDashboard(windowDays = 90): Promise<CommercialDashboard> {
    const now = Date.now()
    const lower = now - windowDays * 24 * 60 * 60 * 1000
    const events = (await this.store.list()).filter((event) => new Date(event.ts).getTime() >= lower)

    const uniqueUsers = new Set(events.map((event) => event.userId))
    const acquisitions = new Set(events.filter((event) => event.type === 'acquisition').map((event) => event.userId))
    const activations = new Set(events.filter((event) => event.type === 'activation').map((event) => event.userId))
    const conversionSignals = new Set(events.filter((event) => event.type === 'conversion_signal').map((event) => event.userId))

    const funnelUsers = [
      { stage: 'Acquisition', users: acquisitions.size },
      { stage: 'Activation', users: activations.size },
      { stage: 'Conversion Signal', users: conversionSignals.size },
    ]

    const funnel = funnelUsers.map((entry, index) => {
      const base = funnelUsers[0]?.users || 1
      const prev = index === 0 ? base : funnelUsers[index - 1]?.users || 1
      const conversionRate = index === 0 ? 1 : Number((entry.users / prev).toFixed(4))
      return { ...entry, conversionRate }
    })

    const cohortMap = new Map<string, { d1: Set<string>; d7: Set<string>; d30: Set<string> }>()
    for (const event of events) {
      const cohort = event.ts.slice(0, 7)
      const bucket = cohortMap.get(cohort) ?? { d1: new Set(), d7: new Set(), d30: new Set() }
      if (event.type === 'retention') {
        const day = Number(event.metadata?.['day'] ?? 0)
        if (day === 1) bucket.d1.add(event.userId)
        if (day === 7) bucket.d7.add(event.userId)
        if (day === 30) bucket.d30.add(event.userId)
      }
      cohortMap.set(cohort, bucket)
    }

    const retention = [...cohortMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cohort, bucket]) => ({
      cohort,
      day1: bucket.d1.size,
      day7: bucket.d7.size,
      day30: bucket.d30.size,
    }))

    const usage = new Map<string, number>()
    for (const event of events.filter((entry) => entry.type === 'feature_usage')) {
      const key = event.feature ?? 'unspecified'
      usage.set(key, (usage.get(key) ?? 0) + 1)
    }

    const featureUsage = [...usage.entries()]
      .map(([feature, count]) => ({ feature, events: count }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 12)

    const weightedProxyScore = Number(((conversionSignals.size * 1.5 + activations.size * 1.1 + uniqueUsers.size * 0.4) / 10).toFixed(2))

    return {
      funnel,
      retention,
      featureUsage,
      revenueProxy: {
        activeUsers: uniqueUsers.size,
        conversionSignals: conversionSignals.size,
        weightedProxyScore,
      },
    }
  }

  async getSimulatedEconomics(windowDays = 90): Promise<SimulatedEconomicsDashboard> {
    const now = Date.now()
    const lower = now - windowDays * 24 * 60 * 60 * 1000
    const events = (await this.store.list()).filter((event) => new Date(event.ts).getTime() >= lower)

    const orgs = new Set<string>()
    const customerOrgs = new Set<string>()
    let acquisitionSpend = 0
    let monthlyRecurringRevenue = 0
    let expansionSignals = 0
    let lifetimeMonthsTotal = 0
    let lifetimeSamples = 0

    for (const event of events) {
      const orgId = String(event.metadata?.['orgId'] ?? 'unknown')
      orgs.add(orgId)

      if (event.type === 'acquisition') {
        acquisitionSpend += Number(event.metadata?.['acquisitionCost'] ?? 0)
      }

      if (event.type === 'conversion_signal') {
        customerOrgs.add(orgId)
        monthlyRecurringRevenue += Number(event.metadata?.['mrr'] ?? 0)
        const lifetimeMonths = Number(event.metadata?.['lifetimeMonths'] ?? 12)
        lifetimeMonthsTotal += lifetimeMonths
        lifetimeSamples += 1
        if (Boolean(event.metadata?.['expansion'])) expansionSignals += 1
      }

      if (event.type === 'feature_usage' && Boolean(event.metadata?.['expansionIntent'])) {
        expansionSignals += 1
      }
    }

    const customerCount = customerOrgs.size || 1
    const avgLifetimeMonths = lifetimeSamples > 0 ? lifetimeMonthsTotal / lifetimeSamples : 12
    const cacProxy = Number((acquisitionSpend / customerCount).toFixed(2))
    const arpu = Number((monthlyRecurringRevenue / customerCount).toFixed(2))
    const ltvProxy = Number((arpu * avgLifetimeMonths).toFixed(2))

    return {
      orgCount: orgs.size,
      customerOrgs: customerOrgs.size,
      acquisitionSpend: Number(acquisitionSpend.toFixed(2)),
      monthlyRecurringRevenue: Number(monthlyRecurringRevenue.toFixed(2)),
      cacProxy,
      ltvProxy,
      expansionSignals,
      generatedAt: new Date().toISOString(),
    }
  }
}

let singleton: MetricsCommercialService | null = null

export function getMetricsCommercialService(): MetricsCommercialService {
  if (!singleton) singleton = new MetricsCommercialService()
  return singleton
}
