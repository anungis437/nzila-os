/**
 * Flow — Vendors & Vendor-Product Links (Spec §3G, §3H)
 *
 * Vendors are stored in commerce_suppliers (shared schema).
 * This module adds the vendor↔product many-to-many link table.
 */
import { pgTable, uuid, text, timestamp, numeric, integer } from 'drizzle-orm/pg-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { orgs } from '../orgs'
import { commerceSuppliers, commerceProducts } from '../commerce'

// Type aliases for Flow-specific vendor access
export type FlowVendor = InferSelectModel<typeof commerceSuppliers>
export type FlowVendorInsert = InferInsertModel<typeof commerceSuppliers>

// ── Vendor-Product Links (Spec §3H) ───────────────────────────────────────

export const flowVendorProductLinks = pgTable('flow_vendor_product_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => commerceSuppliers.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => commerceProducts.id),
  vendorSku: text('vendor_sku'),
  vendorCost: numeric('vendor_cost', { precision: 18, scale: 2 }),
  leadTimeDays: integer('lead_time_days'),
  preferenceRank: integer('preference_rank'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
