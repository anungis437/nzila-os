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
import { db, commerceOrders, commerceQuotes, flowPayments, commercePurchaseOrders } from '@nzila/db'
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
      } catch {
        // Fallback to in-process counters if DB unavailable
      }

      return NextResponse.json({
        service: 'flow',
        order_count: dbOrderCount,
        quote_conversion_rate: dbQuoteTotal > 0
          ? Math.round((dbQuoteConverted / dbQuoteTotal) * 10000) / 100
          : 0,
        avg_order_value: Math.round(dbAvgOrderValue * 100) / 100,
        production_cycle_time: productionCycleCount > 0
          ? Math.round((productionCycleSum / productionCycleCount) * 100) / 100
          : 0,
        payment_blocked_orders: dbPaymentBlocked,
        vendor_delay_count: dbVendorDelays,
        request_count: requestCount,
        error_rate: requestCount > 0
          ? Math.round((errorCount / requestCount) * 10000) / 100
          : 0,
        latency_ms: requestCount > 0
          ? Math.round(totalLatencyMs / requestCount)
          : 0,
        timestamp: new Date().toISOString(),
      })
    }),
  )
}
