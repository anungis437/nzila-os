/**
 * Flow — Order Repository
 *
 * Drizzle-backed, org-scoped order read/write operations.
 */
import {
  db,
  commerceOrders,
  commerceOrderLines,
} from '@nzila/db'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'

export const orderRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commerceOrders)
      .where(and(eq(commerceOrders.id, id), eq(commerceOrders.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(commerceOrders)
      .where(eq(commerceOrders.orgId, orgId))
      .orderBy(desc(commerceOrders.createdAt))
  },

  async findByStatus(orgId: string, status: string) {
    return db
      .select()
      .from(commerceOrders)
      .where(and(eq(commerceOrders.orgId, orgId), eq(commerceOrders.status, status as never)))
  },

  async findByPaymentStatus(orgId: string, paymentStatus: string) {
    return db
      .select()
      .from(commerceOrders)
      .where(and(
        eq(commerceOrders.orgId, orgId),
        eq(commerceOrders.paymentStatus, paymentStatus),
      ))
  },

  async create(input: typeof commerceOrders.$inferInsert) {
    const [row] = await db.insert(commerceOrders).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof commerceOrders.$inferInsert>) {
    const [row] = await db
      .update(commerceOrders)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(commerceOrders.id, id), eq(commerceOrders.orgId, orgId)))
      .returning()
    return row ?? null
  },

  async count(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commerceOrders)
      .where(eq(commerceOrders.orgId, orgId))
    return result?.count ?? 0
  },

  async countByStatus(orgId: string, statuses: string[]) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commerceOrders)
      .where(and(
        eq(commerceOrders.orgId, orgId),
        inArray(commerceOrders.status, statuses as never),
      ))
    return result?.count ?? 0
  },

  // ── Lines ─────────────────────────────────────────────────────────────

  async findLines(orderId: string) {
    return db
      .select()
      .from(commerceOrderLines)
      .where(eq(commerceOrderLines.orderId, orderId))
      .orderBy(commerceOrderLines.sortOrder)
  },

  async insertLines(lines: (typeof commerceOrderLines.$inferInsert)[]) {
    if (lines.length === 0) return []
    return db.insert(commerceOrderLines).values(lines).returning()
  },
}
