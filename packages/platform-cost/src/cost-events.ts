/**
 * Nzila OS — Platform Cost Events
 *
 * Org-scoped cost telemetry primitives for denial-of-wallet controls
 * and cost envelope observability.
 *
 * @module @nzila/platform-cost
 */
import { z } from 'zod'

// ── Cost Categories ─────────────────────────────────────────────────────────

export const COST_CATEGORIES = [
  'compute_ms',
  'db_query_ms',
  'egress_kb',
  'integration_call',
  'ai_token',
] as const

export type CostCategory = (typeof COST_CATEGORIES)[number]

// ── Schemas ─────────────────────────────────────────────────────────────────

export const CostEventSchema = z.object({
  orgId: z.guid(),
  appId: z.string().min(1),
  category: z.enum(COST_CATEGORIES),
  units: z.number().nonnegative(),
  estCostUsd: z.number().nonnegative(),
  ts: z.coerce.date(),
  correlationId: z.guid().optional(),
  route: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CostEvent = z.infer<typeof CostEventSchema>

export const CostRollupSchema = z.object({
  orgId: z.guid(),
  appId: z.string().min(1),
  category: z.enum(COST_CATEGORIES),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalUnits: z.number().nonnegative(),
  totalEstCostUsd: z.number().nonnegative(),
  eventCount: z.number().int().nonnegative(),
})

export type CostRollup = z.infer<typeof CostRollupSchema>

// ── Ports (dependency injection) ────────────────────────────────────────────

export interface CostStorePorts {
  insertCostEvent(event: CostEvent): Promise<{ id: string }>
  queryCostEvents(opts: {
    orgId: string
    from: Date
    to: Date
    category?: CostCategory
    appId?: string
    limit?: number
  }): Promise<CostEvent[]>
  upsertDailyRollup(rollup: CostRollup): Promise<void>
  queryDailyRollups(opts: {
    orgId: string
    from: string
    to: string
    category?: CostCategory
    appId?: string
  }): Promise<CostRollup[]>
  queryOrgTotalCost(opts: {
    orgId: string
    from: string
    to: string
  }): Promise<{ totalEstCostUsd: number; eventCount: number }>
  queryGlobalRollups(opts: {
    from: string
    to: string
    category?: CostCategory
  }): Promise<(CostRollup & { orgId: string })[]>
}

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Validate and record a cost event (org-scoped).
 */
export async function recordCostEvent(
  event: CostEvent,
  ports: Pick<CostStorePorts, 'insertCostEvent'>,
): Promise<{ id: string }> {
  const validated = CostEventSchema.parse(event)
  return ports.insertCostEvent(validated)
}

/**
 * Compute daily rollups for a given date range.
 * Groups cost events by (orgId, appId, category, day) and upserts rollups.
 */
export async function computeDailyRollups(
  opts: { orgId: string; day: string },
  ports: Pick<CostStorePorts, 'queryCostEvents' | 'upsertDailyRollup'>,
): Promise<CostRollup[]> {
  const dayStart = new Date(`${opts.day}T00:00:00Z`)
  const dayEnd = new Date(`${opts.day}T23:59:59.999Z`)

  const events = await ports.queryCostEvents({
    orgId: opts.orgId,
    from: dayStart,
    to: dayEnd,
  })

  const buckets = new Map<string, CostRollup>()

  for (const ev of events) {
    const key = `${ev.orgId}:${ev.appId}:${ev.category}`
    const existing = buckets.get(key)
    if (existing) {
      existing.totalUnits += ev.units
      existing.totalEstCostUsd += ev.estCostUsd
      existing.eventCount += 1
    } else {
      buckets.set(key, {
        orgId: ev.orgId,
        appId: ev.appId,
        category: ev.category,
        day: opts.day,
        totalUnits: ev.units,
        totalEstCostUsd: ev.estCostUsd,
        eventCount: 1,
      })
    }
  }

  const rollups = Array.from(buckets.values())
  for (const rollup of rollups) {
    await ports.upsertDailyRollup(rollup)
  }

  return rollups
}

/**
 * Get cost summary for an org over a date range.
 */
export async function getOrgCostSummary(
  opts: { orgId: string; from: string; to: string },
  ports: Pick<CostStorePorts, 'queryDailyRollups' | 'queryOrgTotalCost'>,
): Promise<{
  orgId: string
  totalEstCostUsd: number
  eventCount: number
  byCategory: Record<CostCategory, number>
  byApp: Record<string, number>
  dailyTrend: { day: string; totalEstCostUsd: number }[]
}> {
  const [rollups, totals] = await Promise.all([
    ports.queryDailyRollups({ orgId: opts.orgId, from: opts.from, to: opts.to }),
    ports.queryOrgTotalCost({ orgId: opts.orgId, from: opts.from, to: opts.to }),
  ])

  const byCategory = {} as Record<CostCategory, number>
  const byApp = {} as Record<string, number>
  const dailyMap = new Map<string, number>()

  for (const cat of COST_CATEGORIES) byCategory[cat] = 0

  for (const r of rollups) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.totalEstCostUsd
    byApp[r.appId] = (byApp[r.appId] ?? 0) + r.totalEstCostUsd
    dailyMap.set(r.day, (dailyMap.get(r.day) ?? 0) + r.totalEstCostUsd)
  }

  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, totalEstCostUsd]) => ({ day, totalEstCostUsd }))

  return {
    orgId: opts.orgId,
    totalEstCostUsd: totals.totalEstCostUsd,
    eventCount: totals.eventCount,
    byCategory,
    byApp,
    dailyTrend,
  }
}

/**
 * Project monthly burn based on recent daily averages.
 */
export function projectMonthlyBurn(
  dailyTrend: { day: string; totalEstCostUsd: number }[],
  windowDays: 7 | 30 = 7,
): { projectedMonthlyUsd: number; avgDailyUsd: number; windowDays: number } {
  const recent = dailyTrend.slice(-windowDays)
  if (recent.length === 0) {
    return { projectedMonthlyUsd: 0, avgDailyUsd: 0, windowDays }
  }
  const totalUsd = recent.reduce((sum, d) => sum + d.totalEstCostUsd, 0)
  const avgDailyUsd = totalUsd / recent.length
  return {
    projectedMonthlyUsd: Math.round(avgDailyUsd * 30 * 100) / 100,
    avgDailyUsd: Math.round(avgDailyUsd * 100) / 100,
    windowDays,
  }
}

/**
 * Get top cost drivers (route/integration) for an org.
 */
export async function getTopCostDrivers(
  opts: { orgId: string; from: string; to: string; limit?: number },
  ports: Pick<CostStorePorts, 'queryDailyRollups'>,
): Promise<{ appId: string; category: CostCategory; totalEstCostUsd: number }[]> {
  const rollups = await ports.queryDailyRollups({
    orgId: opts.orgId,
    from: opts.from,
    to: opts.to,
  })

  const drivers = new Map<string, { appId: string; category: CostCategory; totalEstCostUsd: number }>()

  for (const r of rollups) {
    const key = `${r.appId}:${r.category}`
    const existing = drivers.get(key)
    if (existing) {
      existing.totalEstCostUsd += r.totalEstCostUsd
    } else {
      drivers.set(key, { appId: r.appId, category: r.category, totalEstCostUsd: r.totalEstCostUsd })
    }
  }

  return Array.from(drivers.values())
    .sort((a, b) => b.totalEstCostUsd - a.totalEstCostUsd)
    .slice(0, opts.limit ?? 10)
}
