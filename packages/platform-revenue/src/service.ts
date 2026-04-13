/**
 * @nzila/platform-revenue — Revenue Service
 *
 * Cross-app revenue aggregation, billing hooks, and reporting.
 * CFO app consumes this for financial oversight.
 * Flow can interact with revenue workflows.
 */
import {
  type RevenueEvent,
  type RevenueSummary,
  type UsageMetric,
  type BillingHook,
  type RevenueEventType,
  type UnifiedRevenueRecord,
  RevenueEventType as ET,
  RevenueEventSchema,
  UnifiedRevenueRecordSchema,
} from './types.js'

export interface RevenueService {
  recordEvent(event: RevenueEvent): void
  registerHook(hook: BillingHook): void
  getEvents(orgId: string, from?: string, to?: string): RevenueEvent[]
  summarize(orgId: string, period: string): RevenueSummary
}

/**
 * Emit and validate a unified revenue record.
 * Apps (Zonga, CFO, Flow) call this to feed the platform revenue ledger.
 */
export function emitRevenueEvent(
  service: RevenueService,
  record: UnifiedRevenueRecord,
): RevenueEvent {
  const validated = UnifiedRevenueRecordSchema.parse(record)
  const event: RevenueEvent = {
    id: validated.id,
    orgId: validated.entityId,
    eventType: mapRevenueTypeToEventType(validated.revenueType, validated.appSource),
    amount: validated.grossAmount,
    currency: validated.currency,
    appId: validated.appSource,
    metadata: {
      ...validated.metadata,
      platformFee: validated.platformFee,
      netAmount: validated.netAmount,
      status: validated.status,
    },
    occurredAt: validated.timestamp,
  }
  service.recordEvent(event)
  return event
}

function mapRevenueTypeToEventType(
  revenueType: string,
  appSource: string,
): RevenueEventType {
  if (appSource === 'zonga') return ET.ZONGA_REVENUE
  if (revenueType === 'subscription') return ET.SUBSCRIPTION_STARTED
  if (revenueType === 'transaction') return ET.COMMERCE_REVENUE
  return ET.ONE_TIME_PAYMENT
}

/**
 * In-memory revenue service for development and testing.
 * Production implementations should persist to database.
 */
export function createInMemoryRevenueService(): RevenueService {
  const events: RevenueEvent[] = []
  const hooks: BillingHook[] = []

  return {
    recordEvent(event: RevenueEvent): void {
      const validated = RevenueEventSchema.parse(event)
      events.push(validated)
      for (const hook of hooks) {
        if (hook.event === validated.eventType) {
          void hook.handler(validated)
        }
      }
    },

    registerHook(hook: BillingHook): void {
      hooks.push(hook)
    },

    getEvents(orgId: string, from?: string, to?: string): RevenueEvent[] {
      return events.filter(e => {
        if (e.orgId !== orgId) return false
        if (from && e.occurredAt < from) return false
        if (to && e.occurredAt > to) return false
        return true
      })
    },

    summarize(orgId: string, period: string): RevenueSummary {
      const orgEvents = events.filter(e => e.orgId === orgId)

      const byApp: Record<string, number> = {}
      const byEventType = {} as Record<RevenueEventType, number>
      let subscriptionRevenue = 0
      let usageRevenue = 0
      let transactionRevenue = 0

      for (const e of orgEvents) {
        byEventType[e.eventType] = (byEventType[e.eventType] ?? 0) + e.amount
        if (e.appId) {
          byApp[e.appId] = (byApp[e.appId] ?? 0) + e.amount
        }
        if (e.eventType.startsWith('subscription_')) subscriptionRevenue += e.amount
        else if (e.eventType === 'usage_overage_billed') usageRevenue += e.amount
        else transactionRevenue += e.amount
      }

      return {
        orgId,
        period,
        subscriptionRevenue,
        usageRevenue,
        transactionRevenue,
        totalRevenue: subscriptionRevenue + usageRevenue + transactionRevenue,
        byApp,
        byEventType,
      }
    },
  }
}

/**
 * Compute revenue-per-app breakdown from usage metrics.
 * Used by CFO dashboard and Flow revenue workflows.
 */
export function computeAppRevenueBreakdown(
  events: RevenueEvent[],
): Record<string, { total: number; count: number }> {
  const result: Record<string, { total: number; count: number }> = {}
  for (const e of events) {
    const app = e.appId ?? 'platform'
    if (!result[app]) result[app] = { total: 0, count: 0 }
    result[app].total += e.amount
    result[app].count++
  }
  return result
}
