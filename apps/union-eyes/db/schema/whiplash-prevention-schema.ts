import { pgTable, text, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";

/**
 * Whiplash Prevention Schema
 * Separates strike fund payments from regular operations using Stripe Connect
 * Ensures strike payments are isolated and cannot be commingled with operational funds
 * Compliance: Strike fund trust account separation requirements
 */

// Stripe Connect account registry
export const stripeConnectAccounts = pgTable("stripe_connect_accounts", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  accountType: text("account_type").notNull(), // "operational", "strike_fund", "legal_defense", "education_fund"
  accountPurpose: text("account_purpose").notNull(),
  stripeAccountId: text("stripe_account_id").notNull().unique(), // Stripe Connect Account ID (acct_xxx)
  accountStatus: text("account_status").notNull().default("active"), // "active", "restricted", "disabled"
  accountEmail: text("account_email").notNull(),
  accountName: text("account_name").notNull(),
  country: text("country").notNull().default("CA"),
  currency: text("currency").notNull().default("CAD"),
  separateAccount: boolean("separate_account").notNull().default(true), // Must be separate for strike fund
  trustAccountDesignation: boolean("trust_account_designation").default(false), // Is this a designated trust account?
  bankAccountLast4: text("bank_account_last4"), // Last 4 digits of connected bank account
  bankName: text("bank_name"),
  accountVerified: boolean("account_verified").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment classification policy
export const paymentClassificationPolicy = pgTable("payment_classification_policy", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  policyName: text("policy_name").notNull(), // e.g., "Strike Fund Separation Policy"
  policyDescription: text("policy_description"),
  effectiveDate: timestamp("effective_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  enforceStrictSeparation: boolean("enforce_strict_separation").notNull().default(true), // Strike payments must use separate account
  allowOperationalFallback: boolean("allow_operational_fallback").notNull().default(false), // Can never use operational account for strike payments
  requireTrustAccount: boolean("require_trust_account").notNull().default(true), // Strike fund must be in trust account
  automaticClassification: boolean("automatic_classification").notNull().default(true), // Auto-detect payment type and route to correct account
  approvedBy: text("approved_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment routing rules (which account for which payment type)
export const paymentRoutingRules = pgTable("payment_routing_rules", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  paymentType: text("payment_type").notNull(), // "strike_payment", "dues_payment", "donation", "service_fee", "legal_fee"
  paymentCategory: text("payment_category").notNull(), // "strike_fund", "operational", "legal_defense", "education"
  destinationAccountId: uuid("destination_account_id").references(() => stripeConnectAccounts.id).notNull(),
  destinationAccountType: text("destination_account_type").notNull(), // "operational", "strike_fund"
  routingMandatory: boolean("routing_mandatory").notNull().default(true), // Must use this account
  fallbackAccountId: uuid("fallback_account_id").references(() => stripeConnectAccounts.id),
  allowFallback: boolean("allow_fallback").notNull().default(false), // Can use fallback if primary fails?
  routingPriority: text("routing_priority").notNull().default("1"), // Priority order (1 = highest)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment transaction log with routing enforcement
export const separatedPaymentTransactions = pgTable("separated_payment_transactions", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  transactionDate: timestamp("transaction_date").notNull().defaultNow(),
  paymentType: text("payment_type").notNull(), // "strike_payment", "operational", "dues"
  paymentCategory: text("payment_category").notNull(),
  paymentAmount: text("payment_amount").notNull(), // In cents
  paymentCurrency: text("payment_currency").notNull().default("CAD"),
  payerId: text("payer_id").notNull(),
  payerEmail: text("payer_email").notNull(),
  payeeId: text("payee_id"),
  payeeName: text("payee_name"),
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe Payment Intent ID (pi_xxx)
  stripeChargeId: text("stripe_charge_id"), // Stripe Charge ID (ch_xxx)
  routedToAccountId: uuid("routed_to_account_id").references(() => stripeConnectAccounts.id).notNull(),
  routedToAccountType: text("routed_to_account_type").notNull(),
  routingRuleId: uuid("routing_rule_id").references(() => paymentRoutingRules.id),
  separationEnforced: boolean("separation_enforced").notNull().default(true), // Was separation enforced?
  correctAccountUsed: boolean("correct_account_used").notNull().default(true),
  paymentStatus: text("payment_status").notNull().default("pending"), // "pending", "completed", "failed", "refunded"
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"), // Additional payment details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Whiplash violation detection (payments routed to wrong account)
export const whiplashViolations = pgTable("whiplash_violations", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  violationDate: timestamp("violation_date").notNull().defaultNow(),
  violationType: text("violation_type").notNull(), // "strike_payment_to_operational", "commingled_funds", "incorrect_routing"
  severity: text("severity").notNull(), // "critical", "high", "medium", "low"
  transactionId: uuid("transaction_id").references(() => separatedPaymentTransactions.id),
  paymentType: text("payment_type").notNull(),
  expectedAccountId: uuid("expected_account_id").references(() => stripeConnectAccounts.id),
  actualAccountId: uuid("actual_account_id").references(() => stripeConnectAccounts.id),
  violationDescription: text("violation_description").notNull(),
  amountInvolved: text("amount_involved"), // How much money was misrouted
  correctionRequired: boolean("correction_required").notNull().default(true),
  correctionAction: text("correction_action"), // "payment_reversed", "manual_transfer", "policy_updated"
  violationStatus: text("violation_status").notNull().default("open"), // "open", "investigating", "resolved"
  detectedBy: text("detected_by"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Strike fund payment audit
export const strikeFundPaymentAudit = pgTable("strike_fund_payment_audit", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  auditDate: timestamp("audit_date").notNull().defaultNow(),
  auditPeriod: text("audit_period").notNull(), // "Q1-2025", "2024"
  totalStrikePayments: text("total_strike_payments").notNull(),
  totalStrikeAmount: text("total_strike_amount").notNull(),
  strikePaymentsToCorrectAccount: text("strike_payments_to_correct_account").notNull(),
  strikePaymentsToWrongAccount: text("strike_payments_to_wrong_account").notNull(),
  totalOperationalPayments: text("total_operational_payments").notNull(),
  totalOperationalAmount: text("total_operational_amount").notNull(),
  separationComplianceRate: text("separation_compliance_rate").notNull(), // % of payments routed correctly
  totalViolations: text("total_violations").notNull(),
  criticalViolations: text("critical_violations").notNull(),
  amountMisrouted: text("amount_misrouted"), // Total amount sent to wrong accounts
  recommendedActions: text("recommended_actions"),
  auditedBy: text("audited_by").notNull(),
  auditReport: text("audit_report"), // Link to full report
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Account balance reconciliation
export const accountBalanceReconciliation = pgTable("account_balance_reconciliation", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  reconciliationDate: timestamp("reconciliation_date").notNull().defaultNow(),
  accountId: uuid("account_id").references(() => stripeConnectAccounts.id).notNull(),
  accountType: text("account_type").notNull(),
  stripeReportedBalance: text("stripe_reported_balance").notNull(), // Balance according to Stripe
  systemCalculatedBalance: text("system_calculated_balance").notNull(), // Balance according to our records
  balanceMatch: boolean("balance_match").notNull(),
  discrepancyAmount: text("discrepancy_amount"), // Difference if balances don't match
  discrepancyReason: text("discrepancy_reason"),
  reconciliationStatus: text("reconciliation_status").notNull().default("pending"), // "pending", "reconciled", "discrepancy"
  reconciledBy: text("reconciled_by"),
  reconciliationNotes: text("reconciliation_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Whiplash prevention audit log
export const whiplashPreventionAudit = pgTable("whiplash_prevention_audit", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  auditDate: timestamp("audit_date").notNull().defaultNow(),
  actionType: text("action_type").notNull(), // "payment_routed", "account_created", "violation_detected", "correction_applied"
  actionDescription: text("action_description").notNull(),
  accountId: uuid("account_id").references(() => stripeConnectAccounts.id),
  transactionId: uuid("transaction_id").references(() => separatedPaymentTransactions.id),
  performedBy: text("performed_by").notNull(),
  complianceImpact: text("compliance_impact"), // "none", "low", "medium", "high", "critical"
  metadata: jsonb("metadata"),
});

