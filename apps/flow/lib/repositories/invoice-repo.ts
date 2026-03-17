/**
 * Flow — Invoice Repository
 *
 * Drizzle-backed, org-scoped invoice read/write operations.
 */
import {
  db,
  commerceInvoices,
  commerceInvoiceLines,
} from '@nzila/db'
import { eq, and, desc, sql } from 'drizzle-orm'

export const invoiceRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commerceInvoices)
      .where(and(eq(commerceInvoices.id, id), eq(commerceInvoices.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(commerceInvoices)
      .where(eq(commerceInvoices.orgId, orgId))
      .orderBy(desc(commerceInvoices.createdAt))
  },

  async findByOrder(orderId: string, orgId: string) {
    return db
      .select()
      .from(commerceInvoices)
      .where(and(
        eq(commerceInvoices.orderId, orderId),
        eq(commerceInvoices.orgId, orgId),
      ))
  },

  async findByStatus(orgId: string, status: string) {
    return db
      .select()
      .from(commerceInvoices)
      .where(and(
        eq(commerceInvoices.orgId, orgId),
        eq(commerceInvoices.status, status as never),
      ))
  },

  async create(input: typeof commerceInvoices.$inferInsert) {
    const [row] = await db.insert(commerceInvoices).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof commerceInvoices.$inferInsert>) {
    const [row] = await db
      .update(commerceInvoices)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(commerceInvoices.id, id), eq(commerceInvoices.orgId, orgId)))
      .returning()
    return row ?? null
  },

  async countOverdue(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commerceInvoices)
      .where(and(
        eq(commerceInvoices.orgId, orgId),
        eq(commerceInvoices.status, 'overdue'),
      ))
    return result?.count ?? 0
  },

  // ── Lines ─────────────────────────────────────────────────────────────

  async findLines(invoiceId: string) {
    return db
      .select()
      .from(commerceInvoiceLines)
      .where(eq(commerceInvoiceLines.invoiceId, invoiceId))
      .orderBy(commerceInvoiceLines.sortOrder)
  },

  async insertLines(lines: (typeof commerceInvoiceLines.$inferInsert)[]) {
    if (lines.length === 0) return []
    return db.insert(commerceInvoiceLines).values(lines).returning()
  },
}
