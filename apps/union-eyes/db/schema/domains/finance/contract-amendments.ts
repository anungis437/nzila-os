/**
 * Contract Amendments, Rate Cards & Covered Orgs Schema
 *
 * Extends the contracts domain with:
 *  - contract_rate_cards     — negotiated per-module rates on a contract
 *  - contract_amendments     — versioned changes to active contracts
 *  - contract_covered_orgs   — which locals/divisions a contract covers
 *
 * @domain platform-economics
 * @layer 1.5 — Contracts & Entitlements (extension)
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { commercialContracts } from './contracts';

// ============================================================================
// ENUMS
// ============================================================================

export const amendmentStatusEnum = pgEnum('contract_amendment_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'superseded',
]);

export const coveredOrgRoleEnum = pgEnum('covered_org_role', [
  'local',
  'division',
  'region',
  'employer',
]);

// ============================================================================
// CONTRACT RATE CARDS
// ============================================================================

export const contractRateCards = pgTable('contract_rate_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => commercialContracts.id, { onDelete: 'cascade' }),
  moduleKey: varchar('module_key', { length: 100 }).notNull(),
  moduleName: varchar('module_name', { length: 255 }).notNull(),
  basePriceCad: decimal('base_price_cad', { precision: 14, scale: 2 }).notNull(),
  negotiatedPriceCad: decimal('negotiated_price_cad', { precision: 14, scale: 2 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0.00'),
  transactionFeeOverride: decimal('transaction_fee_override', { precision: 8, scale: 6 }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  contractIdx: index('contract_rate_cards_contract_idx').on(t.contractId),
  moduleIdx: index('contract_rate_cards_module_idx').on(t.moduleKey),
  contractModuleIdx: uniqueIndex('contract_rate_cards_contract_module_idx')
    .on(t.contractId, t.moduleKey),
}));

// ============================================================================
// CONTRACT AMENDMENTS
// ============================================================================

export const contractAmendments = pgTable('contract_amendments', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => commercialContracts.id, { onDelete: 'cascade' }),
  amendmentNumber: varchar('amendment_number', { length: 50 }).notNull(),
  version: integer('version').notNull().default(1),
  status: amendmentStatusEnum('status').notNull().default('draft'),
  summary: text('summary').notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull(),
  previousValues: jsonb('previous_values').$type<Record<string, unknown>>(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  requestedBy: varchar('requested_by', { length: 255 }).notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedBy: varchar('rejected_by', { length: 255 }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  contractIdx: index('contract_amendments_contract_idx').on(t.contractId),
  statusIdx: index('contract_amendments_status_idx').on(t.status),
  amendmentNumIdx: uniqueIndex('contract_amendments_number_idx')
    .on(t.contractId, t.amendmentNumber),
}));

// ============================================================================
// CONTRACT COVERED ORGS
// ============================================================================

export const contractCoveredOrgs = pgTable('contract_covered_orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => commercialContracts.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  role: coveredOrgRoleEnum('role').notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  contractIdx: index('contract_covered_orgs_contract_idx').on(t.contractId),
  orgIdx: index('contract_covered_orgs_org_idx').on(t.organizationId),
  contractOrgIdx: uniqueIndex('contract_covered_orgs_contract_org_idx')
    .on(t.contractId, t.organizationId),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ContractRateCard = typeof contractRateCards.$inferSelect;
export type NewContractRateCard = typeof contractRateCards.$inferInsert;
export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type NewContractAmendment = typeof contractAmendments.$inferInsert;
export type ContractCoveredOrg = typeof contractCoveredOrgs.$inferSelect;
export type NewContractCoveredOrg = typeof contractCoveredOrgs.$inferInsert;
