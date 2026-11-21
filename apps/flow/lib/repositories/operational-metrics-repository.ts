import {
  db,
  commerceOrders,
  commerceQuotes,
  flowPayments,
  commercePurchaseOrders,
  flowProductionJobs,
  flowShipments,
} from '@nzila/db'
import { sql, eq } from 'drizzle-orm'

export const operationalMetricsRepository = {
  countUndeliveredOrders: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceOrders)
      .where(sql`${commerceOrders.status} NOT IN ('delivered', 'closed', 'cancelled')`),
  countOverduePayments: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(flowPayments)
      .where(eq(flowPayments.status, 'overdue')),
  countProductionBacklog: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(flowProductionJobs)
      .where(sql`${flowProductionJobs.status} IN ('pending_proof', 'proof_sent', 'blocked')`),
  countLatePurchaseOrders: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commercePurchaseOrders)
      .where(
        sql`${commercePurchaseOrders.expectedDeliveryDate} < now() AND ${commercePurchaseOrders.status} NOT IN ('received', 'cancelled')`,
      ),
  countOrders: () => db.select({ count: sql<number>`count(*)` }).from(commerceOrders),
  countQuotes: () => db.select({ count: sql<number>`count(*)` }).from(commerceQuotes),
  countAcceptedQuotes: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceQuotes)
      .where(eq(commerceQuotes.status, 'accepted' as never)),
  averageOrderValue: () =>
    db
      .select({ avg: sql<number>`coalesce(avg(${commerceOrders.total}::numeric), 0)` })
      .from(commerceOrders),
  countActiveOrders: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceOrders)
      .where(sql`${commerceOrders.status} NOT IN ('completed', 'cancelled')`),
  countPaymentBlockedOrders: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceOrders)
      .where(sql`${commerceOrders.paymentStatus} IN ('pending_deposit', 'overdue')`),
  countPendingPurchaseOrders: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commercePurchaseOrders)
      .where(sql`${commercePurchaseOrders.status} IN ('draft', 'sent')`),
  countProductionJobsInProgress: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(flowProductionJobs)
      .where(eq(flowProductionJobs.status, 'in_production')),
  countBlockedProductionJobs: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(flowProductionJobs)
      .where(eq(flowProductionJobs.status, 'blocked')),
  countShipmentsInTransit: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(flowShipments)
      .where(eq(flowShipments.status, 'in_transit')),
  countDeliveredOrders: () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceOrders)
      .where(eq(commerceOrders.status, 'delivered')),
}
