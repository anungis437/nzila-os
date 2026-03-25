/**
 * Commercial Contracts & Entitlements Schema
 *
 * Binds organizations to specific feature sets, licensing terms, SLAs,
 * and usage limits. This closes the "Contract & Feature License" gap
 * identified in the MIL audit.
 *
 * Tables:
 *  - commercial_contracts       — master contract per org
 *  - contract_line_items        — feature/module line items on a contract
 *  - org_entitlements           — runtime feature access (derived from contract)
 *  - entitlement_usage_log      — per-use consumption records
 *
 * @domain platform-economics
 * @layer 1.5 — Contracts & Entitlements
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { orgSubscriptions, billingAccounts } from './platform-billing';

// ============================================================================
// ENUMS
// ============================================================================

export const contractStatusEnum = pgEnum('commercial_contract_status', [
  'draft',
  'pending_approval',
  'active',
  'expired',
  'terminated',
  'superseded',
]);

export const contractLineTypeEnum = pgEnum('contract_line_type', [
  'module_license',
  'feature_access',
  'usage_quota',
  'seat_allocation',
  'support_level',
  'sla_commitment',
  'custom',
]);

export const entitlementStatusEnum = pgEnum('org_entitlement_status', [
  'active',
  'suspended',
  'expired',
  'revoked',
]);

// ============================================================================
// COMMERCIAL CONTRACTS
// ============================================================================

export const commercialContracts = pgTable('commercial_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  billingAccountId: uuid('billing_account_id')
    .notNull()
    .references(() => billingAccounts.id, { onDelete: 'restrict' }),
  subscriptionId: uuid('subscription_id')
    .references(() => orgSubscriptions.id, { onDelete: 'restrict' }),
  contractNumber: varchar('contract_number', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: contractStatusEnum('status').notNull().default('draft'),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }).notNull(),
  autoRenew: boolean('auto_renew').notNull().default(false),
  renewalTermMonths: integer('renewal_term_months').default(12),
  terminationNoticeDays: integer('termination_notice_days').default(30),
  totalContractValue: decimal('total_contract_value', { precision: 14, scale: 2 }),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  signedBy: varchar('signed_by', { length: 255 }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  supersededById: uuid('superseded_by_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('commercial_contracts_org_idx').on(t.organizationId),
  billingIdx: index('commercial_contracts_billing_idx').on(t.billingAccountId),
  statusIdx: index('commercial_contracts_status_idx').on(t.status),
  expirationIdx: index('commercial_contracts_expiration_idx').on(t.expirationDate),
}));

// ============================================================================
// CONTRACT LINE ITEMS
// ============================================================================

export const contractLineItems = pgTable('contract_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => commercialContracts.id, { onDelete: 'cascade' }),
  lineType: contractLineTypeEnum('line_type').notNull(),
  featureKey: varchar('feature_key', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: integer('quantity').default(1),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 14, scale: 2 }),
  usageLimit: integer('usage_limit'),           // null = unlimited
  usagePeriod: varchar('usage_period', { length: 20 }), // 'monthly', 'annual', null
  slaTarget: varchar('sla_target', { length: 100 }),     // e.g. "99.9% uptime"
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  contractIdx: index('contract_line_items_contract_idx').on(t.contractId),
  featureIdx: index('contract_line_items_feature_idx').on(t.featureKey),
}));

// ============================================================================
// ORG ENTITLEMENTS  (runtime access — derived from contracts)
// ============================================================================

export const orgEntitlements = pgTable('org_entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  contractLineItemId: uuid('contract_line_item_id')
    .references(() => contractLineItems.id, { onDelete: 'set null' }),
  featureKey: varchar('feature_key', { length: 100 }).notNull(),
  status: entitlementStatusEnum('status').notNull().default('active'),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  usageLimit: integer('usage_limit'),           // null = unlimited
  usagePeriod: varchar('usage_period', { length: 20 }),
  currentUsage: integer('current_usage').notNull().default(0),
  usagePeriodStart: timestamp('usage_period_start', { withTimezone: true }),
  lastResetAt: timestamp('last_reset_at', { withTimezone: true }),
  grantedBy: varchar('granted_by', { length: 255 }),
  revokedBy: varchar('revoked_by', { length: 255 }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokeReason: text('revoke_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgFeatureIdx: uniqueIndex('org_entitlements_org_feature_idx').on(t.organizationId, t.featureKey),
  statusIdx: index('org_entitlements_status_idx').on(t.status),
  expiresIdx: index('org_entitlements_expires_idx').on(t.expiresAt),
}));

// ============================================================================
// ENTITLEMENT USAGE LOG  (immutable event stream)
// ============================================================================

export const entitlementUsageLog = pgTable('entitlement_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entitlementId: uuid('entitlement_id')
    .notNull()
    .references(() => orgEntitlements.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  userId: varchar('user_id', { length: 255 }).notNull(),
  featureKey: varchar('feature_key', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  entitlementIdx: index('entitlement_usage_log_entitlement_idx').on(t.entitlementId),
  orgIdx: index('entitlement_usage_log_org_idx').on(t.organizationId),
  createdIdx: index('entitlement_usage_log_created_idx').on(t.createdAt),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CommercialContract = typeof commercialContracts.$inferSelect;
export type NewCommercialContract = typeof commercialContracts.$inferInsert;
export type ContractLineItem = typeof contractLineItems.$inferSelect;
export type NewContractLineItem = typeof contractLineItems.$inferInsert;
export type OrgEntitlement = typeof orgEntitlements.$inferSelect;
export type NewOrgEntitlement = typeof orgEntitlements.$inferInsert;
export type EntitlementUsageLogEntry = typeof entitlementUsageLog.$inferSelect;
