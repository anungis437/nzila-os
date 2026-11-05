import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, decimal, integer } from "drizzle-orm/pg-core";

/**
 * Transfer Pricing & Currency Enforcement Schema
 * CAD-only transactions, Bank of Canada FX rates, T106 filing for >$1M
 */

// Global currency enforcement policy
export const currencyEnforcementPolicy = pgTable("currency_enforcement_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Policy settings
  enforcementEnabled: boolean("enforcement_enabled").notNull().default(true),
  mandatoryCurrency: varchar("mandatory_currency", { length: 3 }).notNull().default("CAD"),
  
  // Exceptions
  allowForeignCurrency: boolean("allow_foreign_currency").notNull().default(false),
  foreignCurrencyReason: text("foreign_currency_reason"),
  
  // FX rate source
  fxRateSource: varchar("fx_rate_source", { length: 50 }).notNull().default("bank_of_canada"), // "bank_of_canada", "manual"
  fxRateUpdateFrequency: varchar("fx_rate_update_frequency", { length: 20 }).notNull().default("daily"), // "daily", "hourly"
  
  // Compliance
  t106FilingRequired: boolean("t106_filing_required").notNull().default(true), // For transactions >$1M
  t106ThresholdCAD: decimal("t106_threshold_cad", { precision: 15, scale: 2 }).notNull().default("1000000.00"),
  
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
});

// Bank of Canada daily FX rates
export const bankOfCanadaRates = pgTable("bank_of_canada_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Rate details
  rateDate: timestamp("rate_date", { withTimezone: true }).notNull(), // Rate effective date
  currency: varchar("currency", { length: 3 }).notNull(), // USD, EUR, GBP, etc.
  
  // Rates (CAD per 1 unit of foreign currency)
  noonRate: decimal("noon_rate", { precision: 15, scale: 8 }).notNull(), // Official Bank of Canada noon rate
  buyRate: decimal("buy_rate", { precision: 15, scale: 8 }),
  sellRate: decimal("sell_rate", { precision: 15, scale: 8 }),
  
  // Metadata
  source: varchar("source", { length: 50 }).notNull().default("bank_of_canada_api"),
  dataQuality: varchar("data_quality", { length: 20 }).notNull().default("official"), // "official", "estimated", "manual"
  
  // Audit
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  importedBy: varchar("imported_by", { length: 255 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Transaction currency conversions (when foreign currency is allowed)
export const transactionCurrencyConversions = pgTable("transaction_currency_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Transaction details
  transactionId: uuid("transaction_id").notNull().unique(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // "expense", "revenue", "transfer", "procurement"
  
  // Original currency
  originalCurrency: varchar("original_currency", { length: 3 }).notNull(),
  originalAmount: decimal("original_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Converted to CAD
  cadAmount: decimal("cad_amount", { precision: 15, scale: 2 }).notNull(),
  
  // FX rate used
  fxRateUsed: decimal("fx_rate_used", { precision: 15, scale: 8 }).notNull(),
  fxRateDate: timestamp("fx_rate_date").notNull(),
  fxRateSource: varchar("fx_rate_source", { length: 50 }).notNull().default("bank_of_canada"),
  
  // Exception tracking
  exceptionApproved: boolean("exception_approved").notNull().default(false),
  exceptionReason: text("exception_reason"),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  
  // Conversion metadata
  conversionMethod: varchar("conversion_method", { length: 50 }).notNull().default("noon_rate"), // "noon_rate", "buy_rate", "sell_rate"
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// CAD enforcement violations (when non-CAD transactions are attempted)
export const currencyEnforcementViolations = pgTable("currency_enforcement_violations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Violation details
  violationType: varchar("violation_type", { length: 50 }).notNull(), // "foreign_currency_used", "missing_fx_rate", "unauthorized_conversion"
  violationDescription: text("violation_description").notNull(),
  
  // Transaction details
  transactionId: uuid("transaction_id"),
  attemptedCurrency: varchar("attempted_currency", { length: 3 }),
  attemptedAmount: decimal("attempted_amount", { precision: 15, scale: 2 }),
  
  // User who attempted
  attemptedBy: varchar("attempted_by", { length: 255 }).notNull(),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  
  // Resolution
  status: varchar("status", { length: 20 }).notNull().default("pending"), // "pending", "resolved", "exception_granted"
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  resolvedAt: timestamp("resolved_at"),
  
  // Audit
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// T106 filing tracking (>$1M foreign property transactions)
export const t106FilingTracking = pgTable("t106_filing_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Fiscal year
  fiscalYear: varchar("fiscal_year", { length: 4 }).notNull(), // "2024", "2025"
  
  // Transaction summary
  totalForeignTransactions: decimal("total_foreign_transactions", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalCADEquivalent: decimal("total_cad_equivalent", { precision: 15, scale: 2 }).notNull().default("0.00"),
  
  // T106 thresholds
  t106ThresholdExceeded: boolean("t106_threshold_exceeded").notNull().default(false),
  t106FilingRequired: boolean("t106_filing_required").notNull().default(false),
  
  // Reportable transactions
  reportableTransactionCount: varchar("reportable_transaction_count", { length: 10 }).notNull().default("0"),
  reportableTransactionIds: jsonb("reportable_transaction_ids"), // Array of transaction IDs
  
  // Filing status
  filingStatus: varchar("filing_status", { length: 20 }).notNull().default("not_required"), // "not_required", "pending", "filed", "overdue"
  filingDueDate: timestamp("filing_due_date"), // April 30 following fiscal year-end
  filedDate: timestamp("filed_date"),
  confirmationNumber: varchar("confirmation_number", { length: 50 }),
  
  // Responsible parties
  preparedBy: varchar("prepared_by", { length: 255 }),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  filedBy: varchar("filed_by", { length: 255 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Transfer pricing documentation (arms-length transactions)
export const transferPricingDocumentation = pgTable("transfer_pricing_documentation", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Transaction details
  transactionId: uuid("transaction_id").notNull(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // "goods", "services", "intellectual_property", "financial"
  
  // Parties involved
  fromParty: uuid("from_party").notNull(), // Union local, affiliate, etc.
  toParty: uuid("to_party").notNull(),
  
  // Arms-length analysis
  armsLengthRequired: boolean("arms_length_required").notNull().default(true),
  armsLengthConfirmed: boolean("arms_length_confirmed").notNull().default(false),
  armsLengthMethod: varchar("arms_length_method", { length: 50 }), // "comparable_uncontrolled_price", "cost_plus", "resale_price"
  
  // Pricing justification
  cadAmount: decimal("cad_amount", { precision: 15, scale: 2 }).notNull(),
  pricingJustification: text("pricing_justification").notNull(),
  comparableTransactions: jsonb("comparable_transactions"), // Array of comparable transactions
  
  // Documentation
  supportingDocuments: jsonb("supporting_documents"), // Array of document URLs/IDs
  documentedBy: varchar("documented_by", { length: 255 }).notNull(),
  documentedAt: timestamp("documented_at").notNull().defaultNow(),
  
  // Review
  reviewRequired: boolean("review_required").notNull().default(true),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// FX rate audit log
export const fxRateAuditLog = pgTable("fx_rate_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // "rate_imported", "rate_updated", "rate_used", "rate_override"
  actionDescription: text("action_description"),
  
  // Rate details
  currency: varchar("currency", { length: 3 }),
  rateDate: timestamp("rate_date"),
  oldRate: decimal("old_rate", { precision: 15, scale: 8 }),
  newRate: decimal("new_rate", { precision: 15, scale: 8 }),
  
  // Actor
  performedBy: varchar("performed_by", { length: 255 }),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Currency enforcement audit log
export const currencyEnforcementAudit = pgTable("currency_enforcement_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // "policy_updated", "violation_detected", "exception_granted", "t106_filed"
  actionDescription: text("action_description").notNull(),
  
  // Transaction context
  transactionId: uuid("transaction_id"),
  affectedCurrency: varchar("affected_currency", { length: 3 }),
  affectedAmount: decimal("affected_amount", { precision: 15, scale: 2 }),
  
  // Actor
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Compliance
  complianceImpact: varchar("compliance_impact", { length: 20 }), // "none", "low", "medium", "high", "critical"
  
  // Metadata
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Exchange rates cache (for audit trail and rate history)
export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Currency pair
  fromCurrency: varchar("from_currency", { length: 3 }).notNull(), // USD, EUR, GBP, etc.
  toCurrency: varchar("to_currency", { length: 3 }).notNull().default("CAD"),
  
  // Rate details
  exchangeRate: varchar("exchange_rate", { length: 20 }).notNull(), // Stored as string for precision
  rateSource: varchar("rate_source", { length: 50 }).notNull(), // "BOC", "XE", "OANDA"
  effectiveDate: timestamp("effective_date").notNull(),
  rateTimestamp: timestamp("rate_timestamp").notNull(),
  
  // Metadata
  provider: varchar("provider", { length: 100 }),
  dataQuality: varchar("data_quality", { length: 20 }).default("official"), // "official", "estimated", "manual"
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Cross-border transactions (T106 reporting)
export const crossBorderTransactions = pgTable("cross_border_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Transaction details
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
  amountCents: integer("amount_cents").notNull(), // Amount in cents for precision
  originalCurrency: varchar("original_currency", { length: 3 }).default("CAD"),
  cadEquivalentCents: integer("cad_equivalent_cents").notNull(), // CAD amount in cents
  
  // Country information
  fromCountryCode: varchar("from_country_code", { length: 2 }).notNull().default("CA"),
  toCountryCode: varchar("to_country_code", { length: 2 }).notNull(),
  
  // Party types
  fromPartyType: varchar("from_party_type", { length: 50 }).notNull(), // "organization", "individual", "external"
  toPartyType: varchar("to_party_type", { length: 50 }).notNull(), // "organization", "individual", "external"
  
  // CRA compliance
  craReportingStatus: varchar("cra_reporting_status", { length: 50 }).notNull().default("pending"), // "pending", "filed", "not_required", "exempt"
  requiresT106: boolean("requires_t106").notNull().default(false),
  
  // T106 filing status
  t106Filed: boolean("t106_filed").notNull().default(false),
  t106FilingDate: timestamp("t106_filing_date"),
  
  // Metadata
  transactionType: varchar("transaction_type", { length: 50 }), // "service", "goods", "royalty", "interest", "dividend"
  counterpartyName: text("counterparty_name"),
  description: text("description"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

