/**
 * Platform Cost Ledger Schema (DAPL Core)
 * 
 * The Dues-Aware Platform Ledger — canonical source of truth for all
 * platform economics. Immutable, append-only, auditable.
 * 
 * This is Layer 2 of the 5-layer finance architecture.
 * 
 * @domain platform-economics
 * @layer 2 — DAPL Core
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { billingPeriods } from './platform-billing';
import { costCenters } from './accounting';

// ============================================================================
// ENUMS
// ============================================================================

export const costTypeEnum = pgEnum('platform_cost_type', [
  'base_subscription',
  'local_fee',
  'seat_fee',
  'module_fee',
  'usage_fee',
  'onboarding_fee',
  'support_fee',
  'adjustment',
  'credit',
  'subsidy',
  'writeoff',
]);

export const ledgerEventTypeEnum = pgEnum('ledger_event_type', [
  'invoice_generated',
  'payment_received',
  'allocation_run',
  'adjustment_posted',
  'credit_applied',
  'subsidy_applied',
  'writeoff_posted',
  'period_closed',
  'reversal',
]);

export const ledgerSourceTypeEnum = pgEnum('ledger_source_type', [
  'subscription',
  'invoice',
  'payment',
  'adjustment',
  'allocation',
  'manual',
  'system',
]);

export const allocationStatusEnum = pgEnum('allocation_status', [
  'unallocated',
  'pending',
  'allocated',
  'partially_allocated',
  'reversed',
]);

// ============================================================================
// PLATFORM COST LEDGER ENTRIES (DAPL Core)
// ============================================================================

/**
 * The canonical platform cost ledger.
 * 
 * Rules:
 * - Immutable: entries are never updated, only appended
 * - Reversals create new entries with negative amounts
 * - All amounts in CAD
 * - Every entry traces back to a source document
 * - org-scoped with multi-level hierarchy support
 */
export const platformCostLedgerEntries = pgTable('platform_cost_ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ---- Org hierarchy ----
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  parentOrganizationId: uuid('parent_organization_id')
    .references(() => organizations.id, { onDelete: 'restrict' }),
  localId: uuid('local_id'),
  employerId: uuid('employer_id'),
  regionId: uuid('region_id'),
  bargainingUnitId: uuid('bargaining_unit_id'),

  // ---- Period ----
  billingPeriodId: uuid('billing_period_id')
    .references(() => billingPeriods.id, { onDelete: 'restrict' }),

  // ---- Classification ----
  costType: costTypeEnum('cost_type').notNull(),
  eventType: ledgerEventTypeEnum('event_type').notNull(),
  sourceType: ledgerSourceTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id'), // FK to invoice / payment / adjustment

  // ---- Amounts (CAD only) ----
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull().default('1'),
  unitPriceCad: decimal('unit_price_cad', { precision: 12, scale: 2 }).notNull(),
  amountCad: decimal('amount_cad', { precision: 14, scale: 2 }).notNull(),

  // ---- Allocation ----
  costCenterId: uuid('cost_center_id')
    .references(() => costCenters.id, { onDelete: 'restrict' }),
  allocationStatus: allocationStatusEnum('allocation_status').notNull().default('unallocated'),
  allocationRunId: uuid('allocation_run_id'), // FK added at migration level

  // ---- Metadata ----
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // ---- Audit (immutable — no updatedAt) ----
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  auditReference: varchar('audit_reference', { length: 255 }),
}, (t) => ({
  orgIdx: index('pcle_org_idx').on(t.organizationId),
  periodIdx: index('pcle_period_idx').on(t.billingPeriodId),
  costTypeIdx: index('pcle_cost_type_idx').on(t.costType),
  eventTypeIdx: index('pcle_event_type_idx').on(t.eventType),
  sourceIdx: index('pcle_source_idx').on(t.sourceType, t.sourceId),
  allocationIdx: index('pcle_allocation_idx').on(t.allocationStatus),
  createdIdx: index('pcle_created_idx').on(t.createdAt),
  localIdx: index('pcle_local_idx').on(t.localId),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PlatformCostLedgerEntry = typeof platformCostLedgerEntries.$inferSelect;
export type NewPlatformCostLedgerEntry = typeof platformCostLedgerEntries.$inferInsert;
