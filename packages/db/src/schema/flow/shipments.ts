/**
 * Flow — Shipments (Spec §3L)
 *
 * Tracks shipment lifecycle for each order.
 * Optionally linked to production jobs.
 */
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { orgs } from '../orgs'
import { commerceOrders } from '../commerce'
import { flowProductionJobs } from './production'
import { flowShipmentStatusEnum } from './enums'

export const flowShipments = pgTable('flow_shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  orderId: uuid('order_id')
    .notNull()
    .references(() => commerceOrders.id),
  productionJobId: uuid('production_job_id').references(() => flowProductionJobs.id),
  status: flowShipmentStatusEnum('status').notNull().default('pending'),
  carrier: text('carrier'),
  trackingNumber: text('tracking_number'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  shippingAddressJson: jsonb('shipping_address_json'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
