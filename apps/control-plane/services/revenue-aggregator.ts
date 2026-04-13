/**
 * Revenue Aggregator — control-plane service.
 *
 * Wraps @nzila/platform-revenue to provide dashboard-ready
 * revenue summaries for the system brain.
 */
import {
  createInMemoryRevenueService,
  computeAppRevenueBreakdown,
  type RevenueService,
  type RevenueEvent,
} from '@nzila/platform-revenue'

export interface RevenueOverview {
  totalRevenue: number
  byApp: Record<string, { total: number; count: number }>
  eventCount: number
  service: RevenueService
}

/**
 * Initialise a revenue overview instance.
 * Production: seed from database; dev/test: empty in-memory.
 */
export function getRevenueOverview(events: RevenueEvent[] = []): RevenueOverview {
  const service = createInMemoryRevenueService()
  for (const e of events) {
    service.recordEvent(e)
  }

  const byApp = computeAppRevenueBreakdown(events)
  const totalRevenue = Object.values(byApp).reduce((s, a) => s + a.total, 0)

  return {
    totalRevenue,
    byApp,
    eventCount: events.length,
    service,
  }
}
