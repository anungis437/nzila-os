/**
 * Transaction Fee Schema
 *
 * Captures platform fee revenue on eligible transaction flows.
 * Fee models: percentage, flat, hybrid, waived, subsidized,
 * contract-specific, module-specific, flow-specific.
 *
 * Tables:
 *  - transaction_fee_rules      — configurable fee rules per org/contract/module
 *  - transaction_fee_events     — per-transaction fee capture records
 *  - fee_settlement_batches     — batch settlement tracking
 *  - fee_settlement_lines       — per-fee-event settlement assignment
 *  - fee_adjustments            — reversals, waivers, corrections
 *
 * @domain platform-economics
 * @layer 1.5 — Transaction Fees
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { commercialContracts } from './contracts';

// ============================================================================
// ENUMS
// ============================================================================

export const feeModelEnum = pgEnum('fee_model', [
  'percentage',
  'flat',
  'hybrid',
  'waived',
  'subsidized',
]);

export const feeRuleStatusEnum = pgEnum('fee_rule_status', [
  'active',
  'inactive',
  'expired',
]);

export const feeEventStatusEnum = pgEnum('fee_event_status', [
  'captured',
  'reversed',
  'settled',
  'disputed',
  'waived',
]);

export const settlementBatchStatusEnum = pgEnum('settlement_batch_status', [
  'open',
  'closed',
  'reconciled',
]);

export const feeAdjustmentTypeEnum = pgEnum('fee_adjustment_type', [
  'reversal',
  'partial_reversal',
  'waiver',
  'correction',
  'dispute_credit',
]);

// ============================================================================
// TRANSACTION FEE RULES
// ============================================================================

export const transactionFeeRules = pgTable('transaction_fee_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'restrict' }),
  contractId: uuid('contract_id')
    .references(() => commercialContracts.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  feeModel: feeModelEnum('fee_model').notNull(),
  percentageRate: decimal('percentage_rate', { precision: 8, scale: 6 }),
  flatFeeCad: decimal('flat_fee_cad', { precision: 14, scale: 2 }),
  minimumFeeCad: decimal('minimum_fee_cad', { precision: 14, scale: 2 }),
  maximumFeeCad: decimal('maximum_fee_cad', { precision: 14, scale: 2 }),
  flowType: varchar('flow_type', { length: 100 }).notNull(),
  moduleKey: varchar('module_key', { length: 100 }),
  status: feeRuleStatusEnum('status').notNull().default('active'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  priority: integer('priority').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('txn_fee_rules_org_idx').on(t.organizationId),
  contractIdx: index('txn_fee_rules_contract_idx').on(t.contractId),
  flowIdx: index('txn_fee_rules_flow_idx').on(t.flowType),
  statusIdx: index('txn_fee_rules_status_idx').on(t.status),
}));

// ============================================================================
// TRANSACTION FEE EVENTS
// ============================================================================

export const transactionFeeEvents = pgTable('transaction_fee_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => transactionFeeRules.id, { onDelete: 'restrict' }),
  contractId: uuid('contract_id')
    .references(() => commercialContracts.id, { onDelete: 'set null' }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
  sourceTransactionId: varchar('source_transaction_id', { length: 255 }).notNull(),
  sourceTransactionType: varchar('source_transaction_type', { length: 100 }).notNull(),
  grossAmountCad: decimal('gross_amount_cad', { precision: 14, scale: 2 }).notNull(),
  feeAmountCad: decimal('fee_amount_cad', { precision: 14, scale: 2 }).notNull(),
  netAmountCad: decimal('net_amount_cad', { precision: 14, scale: 2 }).notNull(),
  feeModel: feeModelEnum('fee_model_applied').notNull(),
  percentageRateApplied: decimal('percentage_rate_applied', { precision: 8, scale: 6 }),
  flatFeeApplied: decimal('flat_fee_applied', { precision: 14, scale: 2 }),
  status: feeEventStatusEnum('status').notNull().default('captured'),
  billingPeriodId: uuid('billing_period_id'),
  settlementBatchId: uuid('settlement_batch_id')
    .references(() => feeSettlementBatches.id, { onDelete: 'set null' }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('txn_fee_events_org_idx').on(t.organizationId),
  ruleIdx: index('txn_fee_events_rule_idx').on(t.ruleId),
  idempotencyIdx: uniqueIndex('txn_fee_events_idempotency_idx').on(t.idempotencyKey),
  sourceIdx: index('txn_fee_events_source_idx').on(t.sourceTransactionId),
  statusIdx: index('txn_fee_events_status_idx').on(t.status),
  capturedIdx: index('txn_fee_events_captured_idx').on(t.capturedAt),
}));

// ============================================================================
// FEE SETTLEMENT BATCHES
// ============================================================================

export const feeSettlementBatches = pgTable('fee_settlement_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchNumber: varchar('batch_number', { length: 50 }).notNull().unique(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  totalGrossCad: decimal('total_gross_cad', { precision: 14, scale: 2 }).notNull(),
  totalFeesCad: decimal('total_fees_cad', { precision: 14, scale: 2 }).notNull(),
  totalNetCad: decimal('total_net_cad', { precision: 14, scale: 2 }).notNull(),
  eventCount: integer('event_count').notNull().default(0),
  status: settlementBatchStatusEnum('status').notNull().default('open'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: varchar('closed_by', { length: 255 }),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// FEE SETTLEMENT LINES
// ============================================================================

export const feeSettlementLines = pgTable('fee_settlement_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => feeSettlementBatches.id, { onDelete: 'restrict' }),
  feeEventId: uuid('fee_event_id')
    .notNull()
    .references(() => transactionFeeEvents.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  grossAmountCad: decimal('gross_amount_cad', { precision: 14, scale: 2 }).notNull(),
  feeAmountCad: decimal('fee_amount_cad', { precision: 14, scale: 2 }).notNull(),
  netAmountCad: decimal('net_amount_cad', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  batchIdx: index('fee_settlement_lines_batch_idx').on(t.batchId),
  eventIdx: index('fee_settlement_lines_event_idx').on(t.feeEventId),
  orgIdx: index('fee_settlement_lines_org_idx').on(t.organizationId),
}));

// ============================================================================
// FEE ADJUSTMENTS
// ============================================================================

export const feeAdjustments = pgTable('fee_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  feeEventId: uuid('fee_event_id')
    .notNull()
    .references(() => transactionFeeEvents.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  adjustmentType: feeAdjustmentTypeEnum('adjustment_type').notNull(),
  amountCad: decimal('amount_cad', { precision: 14, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  sourceRefundId: varchar('source_refund_id', { length: 255 }),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  eventIdx: index('fee_adjustments_event_idx').on(t.feeEventId),
  orgIdx: index('fee_adjustments_org_idx').on(t.organizationId),
  typeIdx: index('fee_adjustments_type_idx').on(t.adjustmentType),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TransactionFeeRule = typeof transactionFeeRules.$inferSelect;
export type NewTransactionFeeRule = typeof transactionFeeRules.$inferInsert;
export type TransactionFeeEvent = typeof transactionFeeEvents.$inferSelect;
export type NewTransactionFeeEvent = typeof transactionFeeEvents.$inferInsert;
export type FeeSettlementBatch = typeof feeSettlementBatches.$inferSelect;
export type NewFeeSettlementBatch = typeof feeSettlementBatches.$inferInsert;
export type FeeSettlementLine = typeof feeSettlementLines.$inferSelect;
export type FeeAdjustment = typeof feeAdjustments.$inferSelect;
export type NewFeeAdjustment = typeof feeAdjustments.$inferInsert;
