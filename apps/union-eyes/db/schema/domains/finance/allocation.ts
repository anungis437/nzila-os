/**
 * Allocation Engine Schema
 * 
 * Cost allocation rules, versioning, simulation, and chargeback statements.
 * This is Layer 3 of the 5-layer finance architecture.
 * 
 * @domain platform-economics
 * @layer 3 — Allocation Engine
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { billingPeriods } from './platform-billing';

// ============================================================================
// ENUMS
// ============================================================================

export const allocationMethodEnum = pgEnum('allocation_method', [
  'per_member_count',
  'per_active_user',
  'per_case_volume',
  'per_local_flat',
  'weighted_hybrid',
  'manual_override',
  'subsidized',
]);

export const allocationRunStatusEnum = pgEnum('allocation_run_status', [
  'draft',
  'simulated',
  'pending_approval',
  'approved',
  'posted',
  'reversed',
  'failed',
]);

export const chargebackStatusEnum = pgEnum('chargeback_status', [
  'draft', 'issued', 'acknowledged', 'disputed', 'resolved',
]);

// ============================================================================
// ALLOCATION RULES
// ============================================================================

export const allocationRules = pgTable('allocation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('allocation_rules_org_idx').on(t.organizationId),
}));

// ============================================================================
// ALLOCATION RULE VERSIONS
// ============================================================================

export const allocationRuleVersions = pgTable('allocation_rule_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => allocationRules.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  method: allocationMethodEnum('method').notNull(),
  /**
   * Weights for hybrid allocation. Example:
   * { "per_member_count": 50, "per_case_volume": 30, "per_local_flat": 20 }
   */
  weights: jsonb('weights').$type<Record<string, number>>(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  ruleIdx: index('arv_rule_idx').on(t.ruleId),
  effectiveIdx: index('arv_effective_idx').on(t.effectiveFrom, t.effectiveTo),
}));

// ============================================================================
// ALLOCATION RUNS
// ============================================================================

export const allocationRuns = pgTable('allocation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  billingPeriodId: uuid('billing_period_id')
    .notNull()
    .references(() => billingPeriods.id, { onDelete: 'restrict' }),
  ruleVersionId: uuid('rule_version_id')
    .notNull()
    .references(() => allocationRuleVersions.id, { onDelete: 'restrict' }),
  status: allocationRunStatusEnum('status').notNull().default('draft'),
  isSimulation: boolean('is_simulation').notNull().default(false),
  totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull(),
  lineCount: integer('line_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('allocation_runs_org_idx').on(t.organizationId),
  periodIdx: index('allocation_runs_period_idx').on(t.billingPeriodId),
  statusIdx: index('allocation_runs_status_idx').on(t.status),
}));

// ============================================================================
// ALLOCATION RUN LINES
// ============================================================================

export const allocationRunLines = pgTable('allocation_run_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => allocationRuns.id, { onDelete: 'cascade' }),
  localId: uuid('local_id').notNull(),
  localName: varchar('local_name', { length: 255 }),
  method: allocationMethodEnum('method').notNull(),
  basisValue: decimal('basis_value', { precision: 14, scale: 4 }).notNull(), // e.g. member count
  weight: decimal('weight', { precision: 5, scale: 2 }).notNull(), // allocation weight %
  allocatedAmount: decimal('allocated_amount', { precision: 14, scale: 2 }).notNull(),
  costType: varchar('cost_type', { length: 50 }).notNull(),
  ledgerEntryId: uuid('ledger_entry_id'), // FK to platform_cost_ledger_entries
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  runIdx: index('arl_run_idx').on(t.runId),
  localIdx: index('arl_local_idx').on(t.localId),
}));

// ============================================================================
// ALLOCATION BASIS SNAPSHOTS
// ============================================================================

export const allocationBasisSnapshots = pgTable('allocation_basis_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => allocationRuns.id, { onDelete: 'cascade' }),
  localId: uuid('local_id').notNull(),
  memberCount: integer('member_count').notNull().default(0),
  activeUserCount: integer('active_user_count').notNull().default(0),
  caseVolume: integer('case_volume').notNull().default(0),
  remittanceSummary: decimal('remittance_summary', { precision: 14, scale: 2 }).default('0'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  runIdx: index('abs_run_idx').on(t.runId),
  localIdx: index('abs_local_idx').on(t.localId),
}));

// ============================================================================
// CHARGEBACK STATEMENTS
// ============================================================================

export const chargebackStatements = pgTable('chargeback_statements', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  localId: uuid('local_id').notNull(),
  billingPeriodId: uuid('billing_period_id')
    .notNull()
    .references(() => billingPeriods.id, { onDelete: 'restrict' }),
  allocationRunId: uuid('allocation_run_id')
    .notNull()
    .references(() => allocationRuns.id, { onDelete: 'restrict' }),
  totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  status: chargebackStatusEnum('status').notNull().default('draft'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: varchar('acknowledged_by', { length: 255 }),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('chargeback_org_idx').on(t.organizationId),
  localIdx: index('chargeback_local_idx').on(t.localId),
  periodIdx: index('chargeback_period_idx').on(t.billingPeriodId),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AllocationRule = typeof allocationRules.$inferSelect;
export type AllocationRuleVersion = typeof allocationRuleVersions.$inferSelect;
export type AllocationRun = typeof allocationRuns.$inferSelect;
export type AllocationRunLine = typeof allocationRunLines.$inferSelect;
export type AllocationBasisSnapshot = typeof allocationBasisSnapshots.$inferSelect;
export type ChargebackStatement = typeof chargebackStatements.$inferSelect;
