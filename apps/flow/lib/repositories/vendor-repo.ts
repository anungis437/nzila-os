/**
 * Flow — Vendor Repository
 *
 * Drizzle-backed, org-scoped vendor read/write operations.
 * Vendors are stored in commerce_suppliers.
 */
import { db, commerceSuppliers, flowVendorProductLinks } from '@nzila/db'
import { eq, and, desc, sql } from 'drizzle-orm'

export const vendorRepo = {
  async findById(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(commerceSuppliers)
      .where(and(eq(commerceSuppliers.id, id), eq(commerceSuppliers.orgId, orgId)))
      .limit(1)
    return row ?? null
  },

  async findAll(orgId: string) {
    return db
      .select()
      .from(commerceSuppliers)
      .where(eq(commerceSuppliers.orgId, orgId))
      .orderBy(desc(commerceSuppliers.createdAt))
  },

  async create(input: typeof commerceSuppliers.$inferInsert) {
    const [row] = await db.insert(commerceSuppliers).values(input).returning()
    return row!
  },

  async update(id: string, orgId: string, patch: Partial<typeof commerceSuppliers.$inferInsert>) {
    const [row] = await db
      .update(commerceSuppliers)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(commerceSuppliers.id, id), eq(commerceSuppliers.orgId, orgId)))
      .returning()
    return row ?? null
  },

  // ── Product Links ─────────────────────────────────────────────────────

  async findProductLinks(vendorId: string, orgId: string) {
    return db
      .select()
      .from(flowVendorProductLinks)
      .where(and(
        eq(flowVendorProductLinks.vendorId, vendorId),
        eq(flowVendorProductLinks.orgId, orgId),
      ))
  },

  async findVendorsForProduct(productId: string, orgId: string) {
    return db
      .select()
      .from(flowVendorProductLinks)
      .where(and(
        eq(flowVendorProductLinks.productId, productId),
        eq(flowVendorProductLinks.orgId, orgId),
      ))
      .orderBy(flowVendorProductLinks.preferenceRank)
  },

  async linkProduct(input: typeof flowVendorProductLinks.$inferInsert) {
    const [row] = await db.insert(flowVendorProductLinks).values(input).returning()
    return row!
  },

  async count(orgId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commerceSuppliers)
      .where(eq(commerceSuppliers.orgId, orgId))
    return result?.count ?? 0
  },
}
