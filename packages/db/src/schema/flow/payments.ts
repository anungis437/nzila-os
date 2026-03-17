/**
 * Flow — Payments (Spec §3M)
 *
 * Order-linked payments with deposit support.
 * Distinct from commerce_payments (which is invoice-linked).
 */
import { pgTable, uuid, text, timestamp, numeric, varchar, boolean, jsonb, index } from 'drizzle-orm/pg-core'
import { orgs } from '../orgs'
import { commerceOrders, commerceCustomers } from '../commerce'
import { flowPaymentStatusEnum } from './enums'

export const flowPayments = pgTable('flow_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  orderId: uuid('order_id')
    .notNull()
    .references(() => commerceOrders.id),
  customerId: uuid('customer_id').references(() => commerceCustomers.id),
  status: flowPaymentStatusEnum('status').notNull().default('pending_deposit'),
  provider: text('provider'),
  providerRef: text('provider_ref'),
  amountDue: numeric('amount_due', { precision: 18, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  depositRequired: boolean('deposit_required').notNull().default(false),
  depositPercent: numeric('deposit_percent', { precision: 5, scale: 2 }),
  dueBeforeProduction: boolean('due_before_production').notNull().default(false),
  recordedAt: timestamp('recorded_at', { withTimezone: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  metadataJson: jsonb('metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
},
  (table) => [
    index('flow_payments_org_id_idx').on(table.orgId),
    index('flow_payments_order_id_idx').on(table.orderId),
    index('flow_payments_status_idx').on(table.status),
    index('flow_payments_provider_ref_idx').on(table.providerRef),
  ],
)
