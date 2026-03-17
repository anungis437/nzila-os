/**
 * Flow — /api/ops/summary
 *
 * Operational summary for control-plane visibility.
 * Exposes active orders, blocked orders, production backlog,
 * vendor performance flags.
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { db, commerceOrders, flowProductionJobs, flowPayments, commercePurchaseOrders } from '@nzila/db'
import { sql, eq } from 'drizzle-orm'

// ── In-process counters (kept for backward compat) ──────────────────

let activeOrders = 0
let blockedOrders = 0
let productionBacklog = 0
let vendorDelayFlags = 0

export function setActiveOrders(n: number) {
  activeOrders = n
}
export function setBlockedOrders(n: number) {
  blockedOrders = n
}
export function setProductionBacklog(n: number) {
  productionBacklog = n
}
export function setVendorDelayFlags(n: number) {
  vendorDelayFlags = n
}

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.ops.summary.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      // DB-backed operational metrics with in-process fallback
      let dbActiveOrders = activeOrders
      let dbBlockedOrders = blockedOrders
      let dbProductionBacklog = productionBacklog
      let dbVendorDelayFlags = vendorDelayFlags

      try {
        const [ao] = await db.select({ count: sql<number>`count(*)` }).from(commerceOrders).where(sql`${commerceOrders.status} NOT IN ('delivered', 'closed', 'cancelled')`)
        dbActiveOrders = ao?.count ?? 0
        const [pb] = await db.select({ count: sql<number>`count(*)` }).from(flowPayments).where(eq(flowPayments.status, 'overdue'))
        dbBlockedOrders = pb?.count ?? 0
        const [bl] = await db.select({ count: sql<number>`count(*)` }).from(flowProductionJobs).where(sql`${flowProductionJobs.status} IN ('pending_proof', 'proof_sent', 'blocked')`)
        dbProductionBacklog = bl?.count ?? 0
        const [vd] = await db.select({ count: sql<number>`count(*)` }).from(commercePurchaseOrders).where(sql`${commercePurchaseOrders.expectedDeliveryDate} < now() AND ${commercePurchaseOrders.status} NOT IN ('received', 'cancelled')`)
        dbVendorDelayFlags = vd?.count ?? 0
      } catch {
        // Fallback to in-process counters if DB unavailable
      }

      return NextResponse.json({
        service: 'flow',
        active_orders: dbActiveOrders,
        blocked_orders: dbBlockedOrders,
        production_backlog: dbProductionBacklog,
        vendor_delay_flags: dbVendorDelayFlags,
        timestamp: new Date().toISOString(),
      })
    }),
  )
}
