/**
 * Usage Metering Schema
 *
 * Tracks API/resource consumption per org for usage-based billing.
 * Aggregates raw events into billable usage per billing period.
 *
 * Tables:
 *  - usage_meters            — meter definitions (e.g. "api_calls", "storage_gb")
 *  - usage_events            — raw event stream (append-only)
 *  - usage_aggregates        — period-level summaries for invoicing
 *
 * @domain platform-economics
 * @layer 1.5 — Usage Metering
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { billingPeriods } from './platform-billing';

// ============================================================================
// ENUMS
// ============================================================================

export const meterTypeEnum = pgEnum('usage_meter_type', [
  'counter',    // monotonically increasing (api_calls)
  'gauge',      // current value (storage_gb, active_seats)
  'cumulative', // sum over period (data_transfer_gb)
]);

export const aggregateStatusEnum = pgEnum('usage_aggregate_status', [
  'open',       // period in progress, accumulating
  'closed',     // period ended, ready for invoicing
  'invoiced',   // attached to an invoice line
]);

// ============================================================================
// USAGE METERS  (meter catalogue)
// ============================================================================

export const usageMeters = pgTable('usage_meters', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  meterType: meterTypeEnum('meter_type').notNull(),
  unit: varchar('unit', { length: 30 }).notNull(),           // "calls", "GB", "seats"
  pricePerUnit: decimal('price_per_unit', { precision: 12, scale: 6 }),
  includedQuantity: integer('included_quantity').default(0),  // free tier
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// USAGE EVENTS  (append-only event stream)
// ============================================================================

export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  meterId: uuid('meter_id')
    .notNull()
    .references(() => usageMeters.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  userId: varchar('user_id', { length: 255 }),
  quantity: decimal('quantity', { precision: 14, scale: 4 }).notNull(),
  eventTime: timestamp('event_time', { withTimezone: true }).defaultNow().notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  meterOrgIdx: index('usage_events_meter_org_idx').on(t.meterId, t.organizationId),
  eventTimeIdx: index('usage_events_event_time_idx').on(t.eventTime),
  idempotencyIdx: uniqueIndex('usage_events_idempotency_idx').on(t.idempotencyKey),
}));

// ============================================================================
// USAGE AGGREGATES  (period-level summaries)
// ============================================================================

export const usageAggregates = pgTable('usage_aggregates', {
  id: uuid('id').primaryKey().defaultRandom(),
  meterId: uuid('meter_id')
    .notNull()
    .references(() => usageMeters.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  billingPeriodId: uuid('billing_period_id')
    .notNull()
    .references(() => billingPeriods.id, { onDelete: 'restrict' }),
  totalQuantity: decimal('total_quantity', { precision: 14, scale: 4 }).notNull().default('0'),
  includedQuantity: integer('included_quantity').notNull().default(0),
  billableQuantity: decimal('billable_quantity', { precision: 14, scale: 4 }).notNull().default('0'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 6 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  status: aggregateStatusEnum('status').notNull().default('open'),
  invoiceLineItemId: uuid('invoice_line_item_id'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  meterOrgPeriodIdx: uniqueIndex('usage_aggregates_meter_org_period_idx')
    .on(t.meterId, t.organizationId, t.billingPeriodId),
  statusIdx: index('usage_aggregates_status_idx').on(t.status),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UsageMeter = typeof usageMeters.$inferSelect;
export type NewUsageMeter = typeof usageMeters.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
export type UsageAggregate = typeof usageAggregates.$inferSelect;
export type NewUsageAggregate = typeof usageAggregates.$inferInsert;
