/**
 * Flow — Customer Repository
 *
 * Drizzle-backed, org-scoped customer read/write operations.
 */
import { db, commerceCustomers } from '@nzila/db'
import { eq, and, desc, ilike } from 'drizzle-orm'

export const customerRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commerceCustomers)
      .where(and(eq(commerceCustomers.id, id), eq(commerceCustomers.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(commerceCustomers)
      .where(eq(commerceCustomers.orgId, orgId))
      .orderBy(desc(commerceCustomers.createdAt))
  },

  async findByEmail(email: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commerceCustomers)
      .where(and(eq(commerceCustomers.email, email), eq(commerceCustomers.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async search(orgId: string, query: string) {
    return db
      .select()
      .from(commerceCustomers)
      .where(and(
        eq(commerceCustomers.orgId, orgId),
        ilike(commerceCustomers.name, `%${query}%`),
      ))
      .orderBy(commerceCustomers.name)
  },

  async create(input: typeof commerceCustomers.$inferInsert) {
    const [row] = await db.insert(commerceCustomers).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof commerceCustomers.$inferInsert>) {
    const [row] = await db
      .update(commerceCustomers)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(commerceCustomers.id, id), eq(commerceCustomers.orgId, orgId)))
      .returning()
    return row ?? null
  },
}
