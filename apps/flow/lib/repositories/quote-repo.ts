/**
 * Flow — Quote Repository
 *
 * Drizzle-backed, org-scoped quote read/write operations.
 * Wraps commerce_quotes and commerce_quote_lines.
 */
import {
  db,
  commerceQuotes,
  commerceQuoteLines,
} from '@nzila/db'
import { eq, and, desc, sql } from 'drizzle-orm'

export const quoteRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commerceQuotes)
      .where(and(eq(commerceQuotes.id, id), eq(commerceQuotes.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(commerceQuotes)
      .where(eq(commerceQuotes.orgId, orgId))
      .orderBy(desc(commerceQuotes.createdAt))
  },

  async findByStatus(orgId: string, status: string) {
    return db
      .select()
      .from(commerceQuotes)
      .where(and(eq(commerceQuotes.orgId, orgId), eq(commerceQuotes.status, status as never)))
  },

  async create(input: typeof commerceQuotes.$inferInsert) {
    const [row] = await db.insert(commerceQuotes).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof commerceQuotes.$inferInsert>) {
    const [row] = await db
      .update(commerceQuotes)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(commerceQuotes.id, id), eq(commerceQuotes.orgId, orgId)))
      .returning()
    return row ?? null
  },

  async count(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commerceQuotes)
      .where(eq(commerceQuotes.orgId, orgId))
    return result?.count ?? 0
  },

  // ── Lines ─────────────────────────────────────────────────────────────

  async findLines(quoteId: string) {
    return db
      .select()
      .from(commerceQuoteLines)
      .where(eq(commerceQuoteLines.quoteId, quoteId))
      .orderBy(commerceQuoteLines.sortOrder)
  },

  async insertLines(lines: (typeof commerceQuoteLines.$inferInsert)[]) {
    if (lines.length === 0) return []
    return db.insert(commerceQuoteLines).values(lines).returning()
  },
}
