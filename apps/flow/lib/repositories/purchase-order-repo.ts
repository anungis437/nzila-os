/**
 * Flow — Purchase Order Repository
 *
 * Drizzle-backed, org-scoped PO read/write operations.
 */
import {
  db,
  commercePurchaseOrders,
  commercePurchaseOrderLines,
} from '@nzila/db'
import { eq, and, desc, sql } from 'drizzle-orm'

export const purchaseOrderRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commercePurchaseOrders)
      .where(and(eq(commercePurchaseOrders.id, id), eq(commercePurchaseOrders.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(commercePurchaseOrders)
      .where(eq(commercePurchaseOrders.orgId, orgId))
      .orderBy(desc(commercePurchaseOrders.createdAt))
  },

  async findByOrder(orderId: string, orgId: string) {
    return db
      .select()
      .from(commercePurchaseOrders)
      .where(and(
        eq(commercePurchaseOrders.orderId, orderId),
        eq(commercePurchaseOrders.orgId, orgId),
      ))
  },

  async findByStatus(orgId: string, status: string) {
    return db
      .select()
      .from(commercePurchaseOrders)
      .where(and(
        eq(commercePurchaseOrders.orgId, orgId),
        eq(commercePurchaseOrders.status, status as never),
      ))
  },

  async create(input: typeof commercePurchaseOrders.$inferInsert) {
    const [row] = await db.insert(commercePurchaseOrders).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof commercePurchaseOrders.$inferInsert>) {
    const [row] = await db
      .update(commercePurchaseOrders)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(commercePurchaseOrders.id, id), eq(commercePurchaseOrders.orgId, orgId)))
      .returning()
    return row ?? null
  },

  async countOverdue(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commercePurchaseOrders)
      .where(and(
        eq(commercePurchaseOrders.orgId, orgId),
        sql`${commercePurchaseOrders.expectedDeliveryDate} < now()`,
        sql`${commercePurchaseOrders.status} NOT IN ('received', 'cancelled')`,
      ))
    return result?.count ?? 0
  },

  // ── Lines ─────────────────────────────────────────────────────────────

  async findLines(purchaseOrderId: string) {
    return db
      .select()
      .from(commercePurchaseOrderLines)
      .where(eq(commercePurchaseOrderLines.purchaseOrderId, purchaseOrderId))
      .orderBy(commercePurchaseOrderLines.sortOrder)
  },

  async insertLines(lines: (typeof commercePurchaseOrderLines.$inferInsert)[]) {
    if (lines.length === 0) return []
    return db.insert(commercePurchaseOrderLines).values(lines).returning()
  },
}
