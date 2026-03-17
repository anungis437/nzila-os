/**
 * Flow — Production Jobs (Spec §3K)
 *
 * Tracks production lifecycle for each order.
 * Linked to orders, optionally to purchase orders and vendors.
 */
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { orgs } from '../orgs'
import { commerceOrders, commercePurchaseOrders, commerceSuppliers } from '../commerce'
import { flowProductionJobStatusEnum } from './enums'

export const flowProductionJobs = pgTable('flow_production_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  orderId: uuid('order_id')
    .notNull()
    .references(() => commerceOrders.id),
  purchaseOrderId: uuid('purchase_order_id').references(() => commercePurchaseOrders.id),
  status: flowProductionJobStatusEnum('status').notNull().default('pending_proof'),
  assignedVendorId: uuid('assigned_vendor_id').references(() => commerceSuppliers.id),
  proofRequired: boolean('proof_required').notNull().default(false),
  proofSentAt: timestamp('proof_sent_at', { withTimezone: true }),
  proofApprovedAt: timestamp('proof_approved_at', { withTimezone: true }),
  productionStartedAt: timestamp('production_started_at', { withTimezone: true }),
  qualityCheckedAt: timestamp('quality_checked_at', { withTimezone: true }),
  blockedReason: text('blocked_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
