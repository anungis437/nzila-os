/**
 * Flow — Payment Repository
 *
 * Drizzle-backed, org-scoped payment read/write operations.
 * Uses flow_payments (order-linked) — distinct from commerce_payments (invoice-linked).
 */
import { db, flowPayments } from '@nzila/db'
import { eq, and, desc, sql } from 'drizzle-orm'

export const paymentRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(flowPayments)
      .where(and(eq(flowPayments.id, id), eq(flowPayments.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findByOrder(orderId: string, orgId: string) {
    return db
      .select()
      .from(flowPayments)
      .where(and(
        eq(flowPayments.orderId, orderId),
        eq(flowPayments.orgId, orgId),
      ))
      .orderBy(desc(flowPayments.createdAt))
  },

  async findByStatus(orgId: string, status: string) {
    return db
      .select()
      .from(flowPayments)
      .where(and(
        eq(flowPayments.orgId, orgId),
        eq(flowPayments.status, status as never),
      ))
  },

  async create(input: typeof flowPayments.$inferInsert) {
    const [row] = await db.insert(flowPayments).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof flowPayments.$inferInsert>) {
    const [row] = await db
      .update(flowPayments)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(flowPayments.id, id), eq(flowPayments.orgId, orgId)))
      .returning()
    return row ?? null
  },

  async countBlocked(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(flowPayments)
      .where(and(
        eq(flowPayments.orgId, orgId),
        eq(flowPayments.status, 'overdue'),
      ))
    return result?.count ?? 0
  },

  async totalPaidForOrder(orderId: string) {
    const [result] = await db
      .select({ total: sql<string>`coalesce(sum(${flowPayments.amountPaid}), '0')` })
      .from(flowPayments)
      .where(eq(flowPayments.orderId, orderId))
    return Number(result?.total ?? 0)
  },
}
