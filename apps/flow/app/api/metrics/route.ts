/**
 * Flow — /api/metrics
 *
 * Exposes Flow-specific commerce KPIs:
 * - order_count, quote_conversion_rate, avg_order_value
 * - production_cycle_time, payment_blocked_orders, vendor_delay_count
 * - request_count, error_rate, latency_ms
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { db, commerceOrders, commerceQuotes, flowPayments, commercePurchaseOrders, flowProductionJobs, flowShipments } from '@nzila/db'
import { sql, eq } from 'drizzle-orm'

// ── Runtime counters (in-process, kept for request-level metrics) ──────────────────────────────────────────

let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0
let orderCount = 0
let quoteCount = 0
let convertedQuotes = 0
let orderValueSum = 0
let paymentBlockedOrders = 0
let vendorDelayCount = 0
let productionCycleSum = 0
let productionCycleCount = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount++
  totalLatencyMs += latencyMs
  if (isError) errorCount++
}

export function recordOrder(value: number) {
  orderCount++
  orderValueSum += value
}

export function recordQuote(converted: boolean) {
  quoteCount++
  if (converted) convertedQuotes++
}

export function recordPaymentBlock() {
  paymentBlockedOrders++
}

export function recordVendorDelay() {
  vendorDelayCount++
}

export function recordProductionCycle(daysElapsed: number) {
  productionCycleSum += daysElapsed
  productionCycleCount++
}

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.metrics.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      // DB-backed business metrics with in-process fallback
      let dbOrderCount = orderCount
      let dbQuoteTotal = quoteCount
      let dbQuoteConverted = convertedQuotes
      let dbAvgOrderValue = orderCount > 0 ? orderValueSum / orderCount : 0
      let dbPaymentBlocked = paymentBlockedOrders
      let dbVendorDelays = vendorDelayCount
  let dbActiveOrders = 0
  let dbBlockedByPayment = 0
  let dbPOPending = 0
  let dbProductionInProgress = 0
  let dbProductionBlocked = 0
  let dbShipmentsInTransit = 0
  let dbDeliveredOrders = 0

      try {
        const [oc] = await db.select({ count: sql<number>`count(*)` }).from(commerceOrders)
        dbOrderCount = oc?.count ?? 0
        const [qt] = await db.select({ count: sql<number>`count(*)` }).from(commerceQuotes)
        dbQuoteTotal = qt?.count ?? 0
        const [qc] = await db.select({ count: sql<number>`count(*)` }).from(commerceQuotes).where(eq(commerceQuotes.status, 'accepted' as never))
        dbQuoteConverted = qc?.count ?? 0
        const [av] = await db.select({ avg: sql<number>`coalesce(avg(${commerceOrders.total}::numeric), 0)` }).from(commerceOrders)
        dbAvgOrderValue = Number(av?.avg ?? 0)
        const [pb] = await db.select({ count: sql<number>`count(*)` }).from(flowPayments).where(eq(flowPayments.status, 'overdue'))
        dbPaymentBlocked = pb?.count ?? 0
        const [vd] = await db.select({ count: sql<number>`count(*)` }).from(commercePurchaseOrders).where(sql`${commercePurchaseOrders.expectedDeliveryDate} < now() AND ${commercePurchaseOrders.status} NOT IN ('received', 'cancelled')`)
        dbVendorDelays = vd?.count ?? 0
        const [ao] = await db.select({ count: sql<number>`count(*)` }).from(commerceOrders).where(sql`${commerceOrders.status} NOT IN ('completed', 'cancelled')`)
        dbActiveOrders = ao?.count ?? 0
        const [bpm] = await db.select({ count: sql<number>`count(*)` }).from(commerceOrders).where(sql`${commerceOrders.paymentStatus} IN ('pending_deposit', 'overdue')`)
        dbBlockedByPayment = bpm?.count ?? 0
        const [pp] = await db.select({ count: sql<number>`count(*)` }).from(commercePurchaseOrders).where(sql`${commercePurchaseOrders.status} IN ('draft', 'sent')`)
        dbPOPending = pp?.count ?? 0
        const [pji] = await db.select({ count: sql<number>`count(*)` }).from(flowProductionJobs).where(eq(flowProductionJobs.status, 'in_production'))
        dbProductionInProgress = pji?.count ?? 0
        const [pjb] = await db.select({ count: sql<number>`count(*)` }).from(flowProductionJobs).where(eq(flowProductionJobs.status, 'blocked'))
        dbProductionBlocked = pjb?.count ?? 0
        const [sit] = await db.select({ count: sql<number>`count(*)` }).from(flowShipments).where(eq(flowShipments.status, 'in_transit'))
        dbShipmentsInTransit = sit?.count ?? 0
        const [dc] = await db.select({ count: sql<number>`count(*)` }).from(commerceOrders).where(eq(commerceOrders.status, 'delivered'))
        dbDeliveredOrders = dc?.count ?? 0
      } catch {
        // Fallback to in-process counters if DB unavailable
      }

      return NextResponse.json({
        service: 'flow',
        order_count: dbOrderCount,
        quote_count: dbQuoteTotal,
        quote_conversion_rate: dbQuoteTotal > 0
          ? Math.round((dbQuoteConverted / dbQuoteTotal) * 10000) / 100
          : 0,
        avg_order_value: Math.round(dbAvgOrderValue * 100) / 100,
        active_orders_count: dbActiveOrders,
        delivered_orders_count: dbDeliveredOrders,
        blocked_orders_by_payment_count: dbBlockedByPayment,
        payment_blocked_orders: dbPaymentBlocked,
        purchase_orders_pending_count: dbPOPending,
        purchase_orders_overdue_count: dbVendorDelays,
        vendor_delay_count: dbVendorDelays,
        production_jobs_in_progress_count: dbProductionInProgress,
        production_jobs_blocked_count: dbProductionBlocked,
        production_cycle_time: productionCycleCount > 0
          ? Math.round((productionCycleSum / productionCycleCount) * 100) / 100
          : 0,
        shipments_in_transit_count: dbShipmentsInTransit,
        request_count: requestCount,
        error_rate: requestCount > 0
          ? Math.round((errorCount / requestCount) * 10000) / 100
          : 0,
        latency_ms: requestCount > 0
          ? Math.round(totalLatencyMs / requestCount)
          : 0,
        generated_at: new Date().toISOString(),
      })
    }),
  )
}
