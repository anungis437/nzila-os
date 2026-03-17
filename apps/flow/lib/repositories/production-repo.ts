/**
 * Flow — Production Job Repository
 *
 * Drizzle-backed, org-scoped production job read/write operations.
 */
import { db, flowProductionJobs } from '@nzila/db'
import { eq, and, desc, sql } from 'drizzle-orm'

export const productionRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(flowProductionJobs)
      .where(and(eq(flowProductionJobs.id, id), eq(flowProductionJobs.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(flowProductionJobs)
      .where(eq(flowProductionJobs.orgId, orgId))
      .orderBy(desc(flowProductionJobs.createdAt))
  },

  async findByOrder(orderId: string, orgId: string) {
    return db
      .select()
      .from(flowProductionJobs)
      .where(and(
        eq(flowProductionJobs.orderId, orderId),
        eq(flowProductionJobs.orgId, orgId),
      ))
  },

  async findByStatus(orgId: string, status: string) {
    return db
      .select()
      .from(flowProductionJobs)
      .where(and(
        eq(flowProductionJobs.orgId, orgId),
        eq(flowProductionJobs.status, status as never),
      ))
  },

  async create(input: typeof flowProductionJobs.$inferInsert) {
    const [row] = await db.insert(flowProductionJobs).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof flowProductionJobs.$inferInsert>) {
    const [row] = await db
      .update(flowProductionJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(flowProductionJobs.id, id), eq(flowProductionJobs.orgId, orgId)))
      .returning()
    return row ?? null
  },

  async countInProgress(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(flowProductionJobs)
      .where(and(
        eq(flowProductionJobs.orgId, orgId),
        eq(flowProductionJobs.status, 'in_production'),
      ))
    return result?.count ?? 0
  },

  async countBlocked(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(flowProductionJobs)
      .where(and(
        eq(flowProductionJobs.orgId, orgId),
        eq(flowProductionJobs.status, 'blocked'),
      ))
    return result?.count ?? 0
  },
}
