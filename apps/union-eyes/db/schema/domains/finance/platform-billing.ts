/**
 * Platform Billing Schema
 * 
 * Org-level billing entities for the Dues-Aware Platform Ledger (DAPL).
 * This is Layer 1 of the 5-layer finance architecture.
 * 
 * Entities:
 * - billing_accounts: org billing profiles
 * - subscription_plans: available plans
 * - org_subscriptions: org ↔ plan bindings
 * - billing_periods: canonical time buckets
 * - platform_invoices: org-level invoices
 * - invoice_line_items: itemised charges
 * - platform_payments: payments against invoices
 * - payment_allocations: payment ↔ invoice mappings
 * - billing_adjustments: credits / write-offs
 * - billing_terms: net-30 etc.
 * 
 * @domain platform-economics
 * @layer 1 — Platform Billing
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const billingAccountStatusEnum = pgEnum('billing_account_status', [
  'active', 'suspended', 'closed', 'pending',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active', 'trialing', 'past_due', 'cancelled', 'paused',
]);

export const invoiceStatusEnum = pgEnum('platform_invoice_status', [
  'draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off',
]);

export const platformPaymentStatusEnum = pgEnum('platform_payment_status', [
  'pending', 'processing', 'completed', 'failed', 'refunded',
]);

export const adjustmentTypeEnum = pgEnum('billing_adjustment_type', [
  'credit', 'debit', 'write_off', 'subsidy', 'discount', 'refund',
]);

export const pricingModelEnum = pgEnum('pricing_model', [
  'flat', 'per_local', 'per_seat', 'per_module', 'tiered', 'hybrid',
]);

// ============================================================================
// BILLING ACCOUNTS
// ============================================================================

export const billingAccounts = pgTable('billing_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' })
    .unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  billingEmail: varchar('billing_email', { length: 320 }).notNull(),
  billingContactName: varchar('billing_contact_name', { length: 255 }),
  billingPhone: varchar('billing_phone', { length: 30 }),
  billingAddress: jsonb('billing_address').$type<{
    line1: string; line2?: string; city: string;
    province: string; postalCode: string; country: string;
  }>(),
  taxId: varchar('tax_id', { length: 50 }),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  status: billingAccountStatusEnum('status').notNull().default('active'),
  netTermsDays: integer('net_terms_days').notNull().default(30),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: uniqueIndex('billing_accounts_org_idx').on(t.organizationId),
  statusIdx: index('billing_accounts_status_idx').on(t.status),
}));

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  pricingModel: pricingModelEnum('pricing_model').notNull(),
  baseFee: decimal('base_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  perLocalFee: decimal('per_local_fee', { precision: 10, scale: 2 }).default('0'),
  perSeatFee: decimal('per_seat_fee', { precision: 10, scale: 2 }).default('0'),
  perModuleFee: decimal('per_module_fee', { precision: 10, scale: 2 }).default('0'),
  onboardingFee: decimal('onboarding_fee', { precision: 10, scale: 2 }).default('0'),
  supportFee: decimal('support_fee', { precision: 10, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  billingInterval: varchar('billing_interval', { length: 20 }).notNull().default('monthly'),
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// ORG SUBSCRIPTIONS
// ============================================================================

export const orgSubscriptions = pgTable('org_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  billingAccountId: uuid('billing_account_id')
    .notNull()
    .references(() => billingAccounts.id, { onDelete: 'restrict' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  trialEndDate: timestamp('trial_end_date', { withTimezone: true }),
  localCount: integer('local_count').default(0),
  seatCount: integer('seat_count').default(0),
  moduleList: jsonb('module_list').$type<string[]>().default([]),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  subsidyAmount: decimal('subsidy_amount', { precision: 12, scale: 2 }).default('0'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  billingIdx: index('org_subscriptions_billing_idx').on(t.billingAccountId),
  orgIdx: index('org_subscriptions_org_idx').on(t.organizationId),
  statusIdx: index('org_subscriptions_status_idx').on(t.status),
}));

// ============================================================================
// BILLING PERIODS
// ============================================================================

export const billingPeriods = pgTable('billing_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  label: varchar('label', { length: 50 }).notNull(), // e.g. "2026-03"
  isClosed: boolean('is_closed').notNull().default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: varchar('closed_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgPeriodIdx: uniqueIndex('billing_periods_org_label_idx').on(t.organizationId, t.label),
}));

// ============================================================================
// PLATFORM INVOICES
// ============================================================================

export const platformInvoices = pgTable('platform_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  billingAccountId: uuid('billing_account_id')
    .notNull()
    .references(() => billingAccounts.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  billingPeriodId: uuid('billing_period_id')
    .references(() => billingPeriods.id, { onDelete: 'restrict' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  subtotal: decimal('subtotal', { precision: 14, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 14, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('platform_invoices_org_idx').on(t.organizationId),
  billingAcctIdx: index('platform_invoices_billing_acct_idx').on(t.billingAccountId),
  statusIdx: index('platform_invoices_status_idx').on(t.status),
  periodIdx: index('platform_invoices_period_idx').on(t.billingPeriodId),
}));

// ============================================================================
// INVOICE LINE ITEMS
// ============================================================================

export const platformInvoiceLineItems = pgTable('platform_invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => platformInvoices.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }).notNull(),
  costType: varchar('cost_type', { length: 50 }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  ledgerEntryId: uuid('ledger_entry_id'), // FK added at migration level
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  invoiceIdx: index('platform_line_items_invoice_idx').on(t.invoiceId),
}));

// ============================================================================
// PLATFORM PAYMENTS
// ============================================================================

export const platformPayments = pgTable('platform_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  billingAccountId: uuid('billing_account_id')
    .notNull()
    .references(() => billingAccounts.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  status: platformPaymentStatusEnum('status').notNull().default('pending'),
  method: varchar('method', { length: 50 }).notNull(), // stripe, wire, cheque
  externalReference: varchar('external_reference', { length: 255 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('platform_payments_org_idx').on(t.organizationId),
  billingAcctIdx: index('platform_payments_billing_acct_idx').on(t.billingAccountId),
  statusIdx: index('platform_payments_status_idx').on(t.status),
}));

// ============================================================================
// PAYMENT ALLOCATIONS
// ============================================================================

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => platformPayments.id, { onDelete: 'restrict' }),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => platformInvoices.id, { onDelete: 'restrict' }),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  paymentIdx: index('payment_allocations_payment_idx').on(t.paymentId),
  invoiceIdx: index('payment_allocations_invoice_idx').on(t.invoiceId),
}));

// ============================================================================
// BILLING ADJUSTMENTS
// ============================================================================

export const billingAdjustments = pgTable('billing_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  billingAccountId: uuid('billing_account_id')
    .notNull()
    .references(() => billingAccounts.id, { onDelete: 'restrict' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  invoiceId: uuid('invoice_id')
    .references(() => platformInvoices.id, { onDelete: 'restrict' }),
  type: adjustmentTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  reason: text('reason').notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  approvedBy: varchar('approved_by', { length: 255 }),
  ledgerEntryId: uuid('ledger_entry_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  orgIdx: index('billing_adjustments_org_idx').on(t.organizationId),
  billingAcctIdx: index('billing_adjustments_billing_acct_idx').on(t.billingAccountId),
}));

// ============================================================================
// BILLING TERMS
// ============================================================================

export const billingTerms = pgTable('billing_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 30 }).notNull().unique(), // NET-30, NET-60
  name: varchar('name', { length: 100 }).notNull(),
  dueDays: integer('due_days').notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountDays: integer('discount_days').default(0),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type BillingAccount = typeof billingAccounts.$inferSelect;
export type NewBillingAccount = typeof billingAccounts.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type OrgSubscription = typeof orgSubscriptions.$inferSelect;
export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type PlatformInvoice = typeof platformInvoices.$inferSelect;
export type PlatformInvoiceLineItem = typeof platformInvoiceLineItems.$inferSelect;
export type PlatformPayment = typeof platformPayments.$inferSelect;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type BillingAdjustment = typeof billingAdjustments.$inferSelect;
export type BillingTerm = typeof billingTerms.$inferSelect;
