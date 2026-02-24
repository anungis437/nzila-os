/**
 * Dues & Finance Schema
 * 
 * Complete member dues tracking, employer remittance, and reconciliation
 * 
 * Includes:
 * - Member dues ledger (charges, payments, credits, adjustments)
 * - Employer remittance tracking
 * - Reconciliation exceptions
 * - Arrears management
 * - Financial periods
 */

import { pgTable, uuid, text, timestamp, decimal, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// DUES RATES & CONFIGURATIONS
// ============================================================================

export const duesRates = pgTable('dues_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Scope
  organizationId: uuid('organization_id').notNull(),
  localId: uuid('local_id'),
  unitId: uuid('unit_id'),
  
  // Rate Details
  rateName: text('rate_name').notNull(), // e.g., "Standard Monthly", "Initiation Fee"
  rateType: text('rate_type').notNull(), // monthly, initiation, special_assessment, arrears_interest
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  percentage: decimal('percentage', { precision: 5, scale: 2 }), // For percentage-based dues
  
  // Applicability
  employmentType: text('employment_type'), // full_time, part_time, casual, null = all
  classification: text('classification'), // Specific job classification
  
  // Effective Dates
  effectiveFrom: timestamp('effective_from').notNull(),
  effectiveTo: timestamp('effective_to'),
  
  // Status
  status: text('status').notNull().default('active'), // active, superseded, inactive
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by'),
  lastModifiedBy: text('last_modified_by'),
});

// ============================================================================
// MEMBER DUES LEDGER
// ============================================================================

export const memberDuesLedger = pgTable('member_dues_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Transaction Details
  transactionType: text('transaction_type').notNull(), // charge, payment, credit, adjustment, write_off
  transactionDate: timestamp('transaction_date').notNull().defaultNow(),
  effectiveDate: timestamp('effective_date').notNull(), // The period this applies to
  
  // Amounts
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal('balance_before', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  
  // Period
  periodStart: timestamp('period_start'), // For monthly dues charges
  periodEnd: timestamp('period_end'),
  fiscalYear: integer('fiscal_year'),
  fiscalMonth: integer('fiscal_month'),
  
  // Reference
  referenceType: text('reference_type'), // dues_rate, remittance, manual_adjustment
  referenceId: uuid('reference_id'), // ID of the related record
  invoiceNumber: text('invoice_number'),
  receiptNumber: text('receipt_number'),
  
  // Payment Details (for payment transactions)
  paymentMethod: text('payment_method'), // employer_remittance, direct_debit, credit_card, cheque, cash
  paymentReference: text('payment_reference'), // External payment ID
  
  // Description & Notes
  description: text('description').notNull(),
  notes: text('notes'),
  
  // Reversal Tracking
  isReversed: boolean('is_reversed').default(false),
  reversalId: uuid('reversal_id'), // ID of the reversing transaction
  reversedTransactionId: uuid('reversed_transaction_id'), // ID of transaction being reversed
  
  // Status  
  status: text('status').notNull().default('posted'), // posted, pending, reversed, voided
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit (Immutable - no updates allowed)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: text('created_by'),
});

// ============================================================================
// MEMBER ARREARS
// ============================================================================

export const memberArrears = pgTable('member_arrears', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member
  userId: uuid('user_id').notNull().unique(), // One arrears record per member
  organizationId: uuid('organization_id').notNull(),
  
  // Arrears Summary
  totalOwed: decimal('total_owed', { precision: 10, scale: 2 }).notNull().default('0'),
  over30Days: decimal('over_30_days', { precision: 10, scale: 2 }).default('0'),
  over60Days: decimal('over_60_days', { precision: 10, scale: 2 }).default('0'),
  over90Days: decimal('over_90_days', { precision: 10, scale: 2 }).default('0'),
  
  // Grace Period
  inGracePeriod: boolean('in_grace_period').default(false),
  gracePeriodEnds: timestamp('grace_period_ends'),
  
  // Status
  arrearsStatus: text('arrears_status').notNull().default('current'), // current, warning, suspended, bad_debt
  firstArrearsDate: timestamp('first_arrears_date'),
  lastPaymentDate: timestamp('last_payment_date'),
  
  // Actions
  suspensionDate: timestamp('suspension_date'),
  reinstatementDate: timestamp('reinstatement_date'),
  
  // Payment Plan
  hasPaymentPlan: boolean('has_payment_plan').default(false),
  paymentPlanId: uuid('payment_plan_id'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastCalculatedAt: timestamp('last_calculated_at'),
});

// ============================================================================
// EMPLOYER REMITTANCES
// ============================================================================

export const employerRemittances = pgTable('employer_remittances', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Employer & Period
  employerId: uuid('employer_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Period
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalMonth: integer('fiscal_month').notNull(),
  
  // Remittance Details
  remittanceDate: timestamp('remittance_date').notNull(),
  remittanceNumber: text('remittance_number'), // Employer's reference
  
  // Amounts
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  memberCount: integer('member_count').notNull(),
  
  // File
  fileName: text('file_name'),
  fileUrl: text('file_url'),
  fileHash: text('file_hash'), // SHA-256 hash for integrity
  
  // Processing
  processingStatus: text('processing_status').notNull().default('pending'), // pending, processing, completed, failed, requires_review
  processedAt: timestamp('processed_at'),
  processedBy: text('processed_by'),
  
  // Results
  recordsTotal: integer('records_total'),
  recordsProcessed: integer('records_processed'),
  recordsMatched: integer('records_matched'),
  recordsException: integer('records_exception'),
  
  // Reconciliation
  expectedAmount: decimal('expected_amount', { precision: 12, scale: 2 }),
  variance: decimal('variance', { precision: 12, scale: 2 }),
  isReconciled: boolean('is_reconciled').default(false),
  reconciledAt: timestamp('reconciled_at'),
  reconciledBy: text('reconciled_by'),
  
  // Notes
  notes: text('notes'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by'),
  lastModifiedBy: text('last_modified_by'),
});

// ============================================================================
// REMITTANCE LINE ITEMS
// ============================================================================

export const remittanceLineItems = pgTable('remittance_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Remittance
  remittanceId: uuid('remittance_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Employee Details (from remittance file)
  employeeNumber: text('employee_number'),
  employeeName: text('employee_name'),
  employmentType: text('employment_type'),
  
  // Matched Member
  userId: uuid('user_id'), // Matched member, null if not matched
  matchConfidence: integer('match_confidence'), // 0-100
  matchMethod: text('match_method'), // auto, manual, fuzzy
  
  // Amount
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  
  // Period
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  
  // Processing Status
  lineStatus: text('line_status').notNull().default('pending'), // pending, matched, exception, manual_review, processed
  exceptionReason: text('exception_reason'), // member_not_found, amount_mismatch, duplicate, invalid_data
  
  // Resolution
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'),
  resolutionNotes: text('resolution_notes'),
  
  // Applied Transaction
  ledgerTransactionId: uuid('ledger_transaction_id'), // Link to memberDuesLedger
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// REMITTANCE EXCEPTIONS QUEUE
// ============================================================================

export const remittanceExceptions = pgTable('remittance_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Exception Details
  remittanceId: uuid('remittance_id').notNull(),
  lineItemId: uuid('line_item_id'),
  organizationId: uuid('organization_id').notNull(),
  
  // Exception Type
  exceptionType: text('exception_type').notNull(), // member_not_found, amount_mismatch, duplicate_payment, missing_data, invalid_format
  severity: text('severity').notNull().default('medium'), // low, medium, high, critical
  
  // Details
  employeeNumber: text('employee_number'),
  employeeName: text('employee_name'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  expectedAmount: decimal('expected_amount', { precision: 10, scale: 2 }),
  
  // Description
  description: text('description').notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: jsonb('details').$type<Record<string, any>>(),
  
  // Resolution
  status: text('status').notNull().default('open'), // open, in_progress, resolved, escalated, ignored
  assignedTo: text('assigned_to'), // User ID
  priority: integer('priority').default(3), // 1=highest, 5=lowest
  
  // Resolution
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'),
  resolutionAction: text('resolution_action'), // matched_member, adjusted_amount, created_member, ignored
  resolutionNotes: text('resolution_notes'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// PAYMENT PLANS
// ============================================================================

export const paymentPlans = pgTable('payment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Plan Details
  planName: text('plan_name').notNull(),
  totalOwed: decimal('total_owed', { precision: 10, scale: 2 }).notNull(),
  installmentAmount: decimal('installment_amount', { precision: 10, scale: 2 }).notNull(),
  installmentCount: integer('installment_count').notNull(),
  frequency: text('frequency').notNull().default('monthly'), // weekly, bi_weekly, monthly
  
  // Dates
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  
  // Progress
  installmentsPaid: integer('installments_paid').default(0),
  totalPaid: decimal('total_paid', { precision: 10, scale: 2 }).default('0'),
  remainingBalance: decimal('remaining_balance', { precision: 10, scale: 2 }).notNull(),
  
  // Status
  status: text('status').notNull().default('active'), // active, completed, defaulted, cancelled
  lastPaymentDate: timestamp('last_payment_date'),
  nextPaymentDue: timestamp('next_payment_due').notNull(),
  
  // Agreement
  agreementAcceptedAt: timestamp('agreement_accepted_at'),
  agreementAcceptedBy: text('agreement_accepted_by'),
  termsUrl: text('terms_url'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by'),
  lastModifiedBy: text('last_modified_by'),
});

// ============================================================================
// FINANCIAL PERIODS
// ============================================================================

export const financialPeriods = pgTable('financial_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Organization
  organizationId: uuid('organization_id').notNull(),
  localId: uuid('local_id'),
  
  // Period
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalMonth: integer('fiscal_month').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Status
  status: text('status').notNull().default('open'), // open, closed, locked, archived
  
  // Close Details
  closedAt: timestamp('closed_at'),
  closedBy: text('closed_by'),
  lockedAt: timestamp('locked_at'),
  lockedBy: text('locked_by'),
  
  // Summary (cached for performance)
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }),
  totalArrears: decimal('total_arrears', { precision: 12, scale: 2 }),
  memberCount: integer('member_count'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const duesRatesRelations = relations(duesRates, ({ many }) => ({
  ledgerEntries: many(memberDuesLedger),
}));

export const memberDuesLedgerRelations = relations(memberDuesLedger, ({ one }) => ({
  duesRate: one(duesRates, {
    fields: [memberDuesLedger.referenceId],
    references: [duesRates.id],
  }),
}));

export const employerRemittancesRelations = relations(employerRemittances, ({ many }) => ({
  lineItems: many(remittanceLineItems),
  exceptions: many(remittanceExceptions),
}));

export const remittanceLineItemsRelations = relations(remittanceLineItems, ({ one }) => ({
  remittance: one(employerRemittances, {
    fields: [remittanceLineItems.remittanceId],
    references: [employerRemittances.id],
  }),
  ledgerTransaction: one(memberDuesLedger, {
    fields: [remittanceLineItems.ledgerTransactionId],
    references: [memberDuesLedger.id],
  }),
}));

export const remittanceExceptionsRelations = relations(remittanceExceptions, ({ one }) => ({
  remittance: one(employerRemittances, {
    fields: [remittanceExceptions.remittanceId],
    references: [employerRemittances.id],
  }),
  lineItem: one(remittanceLineItems, {
    fields: [remittanceExceptions.lineItemId],
    references: [remittanceLineItems.id],
  }),
}));

export const paymentPlansRelations = relations(paymentPlans, ({ one }) => ({
  arrears: one(memberArrears, {
    fields: [paymentPlans.userId],
    references: [memberArrears.userId],
  }),
}));
