/**
 * Reconciliation Schema
 *
 * Matches invoices, payments, fee events, and refunds to ensure
 * financial integrity. Exceptions are flagged for manual review.
 *
 * Tables:
 *  - reconciliation_runs       — periodic reconciliation executions
 *  - reconciliation_matches    — matched transactions
 *  - reconciliation_exceptions — unmatched / discrepant records
 *
 * @domain platform-economics
 * @layer 5 — Finance Outputs & Reconciliation
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, jsonb, index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const reconciliationRunStatusEnum = pgEnum('reconciliation_run_status', [
  'running',
  'completed',
  'failed',
]);

export const reconciliationMatchTypeEnum = pgEnum('reconciliation_match_type', [
  'invoice_payment',
  'fee_settlement',
  'refund_reversal',
  'adjustment_credit',
]);

export const reconciliationExceptionTypeEnum = pgEnum('reconciliation_exception_type', [
  'unmatched_payment',
  'unmatched_invoice',
  'amount_discrepancy',
  'duplicate_payment',
  'missing_fee_event',
  'orphaned_refund',
]);

export const reconciliationExceptionStatusEnum = pgEnum('reconciliation_exception_status', [
  'open',
  'under_review',
  'resolved',
  'written_off',
]);

// ============================================================================
// RECONCILIATION RUNS
// ============================================================================

export const reconciliationRuns = pgTable('reconciliation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'restrict' }),
  billingPeriodId: uuid('billing_period_id'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  status: reconciliationRunStatusEnum('status').notNull().default('running'),
  totalInvoices: integer('total_invoices').notNull().default(0),
  totalPayments: integer('total_payments').notNull().default(0),
  totalMatches: integer('total_matches').notNull().default(0),
  totalExceptions: integer('total_exceptions').notNull().default(0),
  invoiceAmountCad: decimal('invoice_amount_cad', { precision: 14, scale: 2 }).default('0.00'),
  paymentAmountCad: decimal('payment_amount_cad', { precision: 14, scale: 2 }).default('0.00'),
  varianceCad: decimal('variance_cad', { precision: 14, scale: 2 }).default('0.00'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  runBy: varchar('run_by', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('reconciliation_runs_org_idx').on(t.organizationId),
  statusIdx: index('reconciliation_runs_status_idx').on(t.status),
  periodIdx: index('reconciliation_runs_period_idx').on(t.periodStart, t.periodEnd),
}));

// ============================================================================
// RECONCILIATION MATCHES
// ============================================================================

export const reconciliationMatches = pgTable('reconciliation_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => reconciliationRuns.id, { onDelete: 'cascade' }),
  matchType: reconciliationMatchTypeEnum('match_type').notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: uuid('source_id').notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: uuid('target_id').notNull(),
  sourceAmountCad: decimal('source_amount_cad', { precision: 14, scale: 2 }).notNull(),
  targetAmountCad: decimal('target_amount_cad', { precision: 14, scale: 2 }).notNull(),
  varianceCad: decimal('variance_cad', { precision: 14, scale: 2 }).notNull().default('0.00'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  runIdx: index('reconciliation_matches_run_idx').on(t.runId),
  sourceIdx: index('reconciliation_matches_source_idx').on(t.sourceType, t.sourceId),
  targetIdx: index('reconciliation_matches_target_idx').on(t.targetType, t.targetId),
}));

// ============================================================================
// RECONCILIATION EXCEPTIONS
// ============================================================================

export const reconciliationExceptions = pgTable('reconciliation_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => reconciliationRuns.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'restrict' }),
  exceptionType: reconciliationExceptionTypeEnum('exception_type').notNull(),
  status: reconciliationExceptionStatusEnum('exception_status').notNull().default('open'),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: uuid('source_id').notNull(),
  expectedAmountCad: decimal('expected_amount_cad', { precision: 14, scale: 2 }),
  actualAmountCad: decimal('actual_amount_cad', { precision: 14, scale: 2 }),
  varianceCad: decimal('variance_cad', { precision: 14, scale: 2 }),
  description: text('description').notNull(),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  runIdx: index('reconciliation_exceptions_run_idx').on(t.runId),
  orgIdx: index('reconciliation_exceptions_org_idx').on(t.organizationId),
  statusIdx: index('reconciliation_exceptions_status_idx').on(t.status),
  typeIdx: index('reconciliation_exceptions_type_idx').on(t.exceptionType),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;
export type NewReconciliationRun = typeof reconciliationRuns.$inferInsert;
export type ReconciliationMatch = typeof reconciliationMatches.$inferSelect;
export type NewReconciliationMatch = typeof reconciliationMatches.$inferInsert;
export type ReconciliationException = typeof reconciliationExceptions.$inferSelect;
export type NewReconciliationException = typeof reconciliationExceptions.$inferInsert;
