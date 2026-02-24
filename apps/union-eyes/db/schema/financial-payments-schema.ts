/**
 * Financial Payments Schema
 * 
 * Comprehensive schema for payment tracking, processing, and reconciliation
 * Includes tables for:
 * - Payment tracking and status
 * - Payment methods and reconciliation
 * - Payment cycles and collection
 * - Stripe webhook events and reconciliation
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  decimal,
  _integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../schema-organizations";
import { profiles } from "./profiles-schema";

// ============================================================================
// ENUMS
// ============================================================================

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded",
  "disputed",
  "unmatched", // For bank remittance reconciliation
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "stripe",
  "bank_transfer",
  "check",
  "cash",
  "direct_debit",
  "payroll_deduction",
  "ewallet",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "dues",
  "strike_fund",
  "subscription",
  "stipend",
  "honorarium",
  "rebate",
  "other",
]);

export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "unreconciled",
  "pending_review",
  "reconciled",
  "orphaned",
  "disputed",
]);

// ============================================================================
// MAIN TABLES
// ============================================================================

/**
 * Payments table - tracks all payment transactions
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: varchar("member_id", { length: 255 }).references(() => profiles.userId, { onDelete: "set null" }),
    
    // Payment details
    amount: decimal("amount", { precision: 19, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("CAD"),
    type: paymentTypeEnum("type").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    method: paymentMethodEnum("method").notNull(),
    
    // External references
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    stripePriceId: varchar("stripe_price_id"),
    stripeInvoiceId: varchar("stripe_invoice_id"),
    bankDepositId: varchar("bank_deposit_id"),
    checkNumber: varchar("check_number"),
    referenceNumber: varchar("reference_number"), // For bank transfers
    
    // Payment cycle
    paymentCycleId: uuid("payment_cycle_id").references(() => paymentCycles.id),
    dueDate: timestamp("due_date"),
    paidDate: timestamp("paid_date"),
    
    // Reconciliation
    reconciliationStatus: reconciliationStatusEnum("reconciliation_status").default("unreconciled"),
    reconciliationDate: timestamp("reconciliation_date"),
    
    // Manual notes
    notes: text("notes"),
    failureReason: text("failure_reason"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
    updatedBy: varchar("updated_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("payments_org_idx").on(t.organizationId),
    memberIdx: index("payments_member_idx").on(t.memberId),
    statusIdx: index("payments_status_idx").on(t.status),
    methodIdx: index("payments_method_idx").on(t.method),
    stripeIdx: index("payments_stripe_idx").on(t.stripePaymentIntentId),
    reconciliationIdx: index("payments_reconciliation_idx").on(t.reconciliationStatus),
  })
);

/**
 * Payment cycles - tracks billing periods
 */
export const paymentCycles = pgTable(
  "payment_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Cycle details
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    cycleType: varchar("cycle_type", { length: 50 }), // monthly, quarterly, annual
    
    // Dates
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    dueDate: timestamp("due_date").notNull(),
    
    // Status
    isActive: boolean("is_active").default(true),
    isClosed: boolean("is_closed").default(false),
    closedAt: timestamp("closed_at"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("payment_cycles_org_idx").on(t.organizationId),
    statusIdx: index("payment_cycles_status_idx").on(t.isActive),
  })
);

/**
 * Payment methods - stores payment method details securely
 */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: varchar("member_id", { length: 255 })
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    
    // Method type
    type: paymentMethodEnum("type").notNull(),
    isDefault: boolean("is_default").default(false),
    isActive: boolean("is_active").default(true),
    
    // Stripe
    stripePaymentMethodId: varchar("stripe_payment_method_id"),
    stripeBillingDetails: jsonb("stripe_billing_details"), // JSON: { name, email, phone, address }
    
    // Bank
    bankAccountToken: varchar("bank_account_token"), // Tokenized, not stored plaintext
    bankAccountLast4: varchar("bank_account_last_4", { length: 4 }),
    
    // Expiry for card/bank methods
    expiresAt: timestamp("expires_at"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgMemberIdx: index("payment_methods_org_member_idx").on(t.organizationId, t.memberId),
    stripeIdx: index("payment_methods_stripe_idx").on(t.stripePaymentMethodId),
  })
);

/**
 * Bank reconciliation - matches bank transactions to payments
 */
export const bankReconciliation = pgTable(
  "bank_reconciliation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Bank statement details
    bankStatementDate: timestamp("bank_statement_date").notNull(),
    bankDepositId: varchar("bank_deposit_id").notNull(),
    depositAmount: decimal("deposit_amount", { precision: 19, scale: 2 }).notNull(),
    depositCurrency: varchar("deposit_currency", { length: 3 }).default("CAD"),
    
    // Reconciliation
    status: reconciliationStatusEnum("status").default("unreconciled"),
    reconciledAmount: decimal("reconciled_amount", { precision: 19, scale: 2 }),
    unmatchedAmount: decimal("unmatched_amount", { precision: 19, scale: 2 }),
    
    // Matched payments
    matchedPaymentIds: uuid("matched_payment_ids").array(), // Array of payment IDs
    unmatchedPaymentIds: uuid("unmatched_payment_ids").array(),
    
    // Metadata
    notes: text("notes"),
    reconciliationNotes: text("reconciliation_notes"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    reconciledBy: varchar("reconciled_by", { length: 255 }),
    reconciledAt: timestamp("reconciled_at"),
  },
  (t) => ({
    orgIdx: index("bank_reconciliation_org_idx").on(t.organizationId),
    statusIdx: index("bank_reconciliation_status_idx").on(t.status),
    depositIdx: index("bank_reconciliation_deposit_idx").on(t.bankDepositId),
  })
);

/**
 * Payment disputes - tracks payment issues and resolutions
 */
export const paymentDisputes = pgTable(
  "payment_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    
    // Dispute details
    reason: text("reason").notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).notNull(), // pending, resolved, won, lost
    
    // Resolution
    resolvedAmount: decimal("resolved_amount", { precision: 19, scale: 2 }),
    resolutionNotes: text("resolution_notes"),
    resolvedAt: timestamp("resolved_at"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    filedBy: varchar("filed_by", { length: 255 }),
    resolvedBy: varchar("resolved_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("payment_disputes_org_idx").on(t.organizationId),
    paymentIdx: index("payment_disputes_payment_idx").on(t.paymentId),
    statusIdx: index("payment_disputes_status_idx").on(t.status),
  })
);

/**
 * Stripe webhook events - for reconciliation and audit trail
 */
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Event details
    stripeEventId: varchar("stripe_event_id").notNull().unique(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    
    // Associated objects
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    stripeCustomerId: varchar("stripe_customer_id"),
    
    // Event data
    eventData: jsonb("event_data").notNull(),
    processed: boolean("processed").default(false),
    
    // Processing
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("stripe_webhook_events_org_idx").on(t.organizationId),
    stripeEventIdx: index("stripe_webhook_events_stripe_idx").on(t.stripeEventId),
    processedIdx: index("stripe_webhook_events_processed_idx").on(t.processed),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  member: one(profiles, {
    fields: [payments.memberId],
    references: [profiles.userId],
  }),
  cycle: one(paymentCycles, {
    fields: [payments.paymentCycleId],
    references: [paymentCycles.id],
  }),
  disputes: many(paymentDisputes),
}));

export const paymentCyclesRelations = relations(paymentCycles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [paymentCycles.organizationId],
    references: [organizations.id],
  }),
  payments: many(payments),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentMethods.organizationId],
    references: [organizations.id],
  }),
  member: one(profiles, {
    fields: [paymentMethods.memberId],
    references: [profiles.userId],
  }),
}));

export const bankReconciliationRelations = relations(bankReconciliation, ({ one }) => ({
  organization: one(organizations, {
    fields: [bankReconciliation.organizationId],
    references: [organizations.id],
  }),
}));

export const paymentDisputesRelations = relations(paymentDisputes, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentDisputes.organizationId],
    references: [organizations.id],
  }),
  payment: one(payments, {
    fields: [paymentDisputes.paymentId],
    references: [payments.id],
  }),
}));

export const stripeWebhookEventsRelations = relations(stripeWebhookEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [stripeWebhookEvents.organizationId],
    references: [organizations.id],
  }),
}));

