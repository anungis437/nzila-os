import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, decimal } from "drizzle-orm/pg-core";

/**
 * Joint-Trust Fund Fair Market Value (FMV) Schema
 * FMV benchmarking, CPI escalator, 3-bid procurement process
 */

// Fair Market Value Policy (global settings)
export const fmvPolicy = pgTable("fmv_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Policy settings
  policyEnabled: boolean("policy_enabled").notNull().default(true),
  fmvVerificationRequired: boolean("fmv_verification_required").notNull().default(true),
  
  // Procurement thresholds
  competitiveBiddingThreshold: decimal("competitive_bidding_threshold", { precision: 15, scale: 2 }).notNull().default("10000.00"), // >$10k requires 3 bids
  minimumBidsRequired: varchar("minimum_bids_required", { length: 2 }).notNull().default("3"), // 3-bid minimum
  
  // CPI escalator
  cpiEscalatorEnabled: boolean("cpi_escalator_enabled").notNull().default(true),
  cpiUpdateFrequency: varchar("cpi_update_frequency", { length: 20 }).notNull().default("monthly"), // "monthly", "quarterly", "annually"
  cpiBaseYear: varchar("cpi_base_year", { length: 4 }).notNull().default("2002"), // Statistics Canada CPI base year
  
  // Independent appraisal
  appraisalRequired: boolean("appraisal_required").notNull().default(true),
  appraisalThreshold: decimal("appraisal_threshold", { precision: 15, scale: 2 }).notNull().default("50000.00"), // >$50k requires independent appraisal
  
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
});

// CPI (Consumer Price Index) data from Statistics Canada
export const cpiData = pgTable("cpi_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Period
  periodYear: varchar("period_year", { length: 4 }).notNull(),
  periodMonth: varchar("period_month", { length: 2 }).notNull(), // "01" to "12"
  periodDate: timestamp("period_date").notNull(), // First day of month
  
  // CPI value
  cpiValue: decimal("cpi_value", { precision: 10, scale: 4 }).notNull(), // e.g., 160.5432
  cpiChange: decimal("cpi_change", { precision: 6, scale: 4 }), // Percentage change from previous month
  cpiYearOverYear: decimal("cpi_year_over_year", { precision: 6, scale: 4 }), // Percentage change from same month last year
  
  // Base year reference
  baseYear: varchar("base_year", { length: 4 }).notNull().default("2002"),
  
  // Data source
  source: varchar("source", { length: 50 }).notNull().default("statistics_canada"),
  dataQuality: varchar("data_quality", { length: 20 }).notNull().default("official"), // "official", "preliminary", "estimated"
  
  // Import metadata
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  importedBy: varchar("imported_by", { length: 255 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// FMV Benchmarks (market value references)
export const fmvBenchmarks = pgTable("fmv_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Item/service details
  itemCategory: varchar("item_category", { length: 50 }).notNull(), // "legal_services", "office_space", "equipment", "software"
  itemDescription: text("item_description").notNull(),
  itemSpecifications: jsonb("item_specifications"), // Detailed specs
  
  // FMV range
  fmvLow: decimal("fmv_low", { precision: 15, scale: 2 }).notNull(),
  fmvHigh: decimal("fmv_high", { precision: 15, scale: 2 }).notNull(),
  fmvMedian: decimal("fmv_median", { precision: 15, scale: 2 }).notNull(),
  
  // Geographic region
  region: varchar("region", { length: 50 }).notNull(), // "ontario", "quebec", "bc", "national"
  city: varchar("city", { length: 100 }),
  
  // Time period
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  
  // Data sources
  dataSources: jsonb("data_sources"), // Array of sources used to establish FMV
  comparableTransactions: jsonb("comparable_transactions"), // Similar transactions
  
  // CPI adjustment
  cpiAdjusted: boolean("cpi_adjusted").notNull().default(false),
  originalFMV: decimal("original_fmv", { precision: 15, scale: 2 }),
  cpiAdjustmentFactor: decimal("cpi_adjustment_factor", { precision: 10, scale: 6 }),
  
  // Review
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Procurement requests (3-bid process)
export const procurementRequests = pgTable("procurement_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Request details
  requestNumber: varchar("request_number", { length: 50 }).notNull().unique(),
  requestTitle: text("request_title").notNull(),
  requestDescription: text("request_description").notNull(),
  
  // Requester
  requestedBy: varchar("requested_by", { length: 255 }).notNull(),
  requestedByDepartment: varchar("requested_by_department", { length: 100 }),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  
  // Budget
  estimatedValue: decimal("estimated_value", { precision: 15, scale: 2 }).notNull(),
  budgetApproved: boolean("budget_approved").notNull().default(false),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  
  // Procurement type
  procurementType: varchar("procurement_type", { length: 50 }).notNull(), // "goods", "services", "construction", "consulting"
  procurementMethod: varchar("procurement_method", { length: 50 }).notNull().default("competitive_bidding"), // "competitive_bidding", "sole_source", "emergency"
  
  // 3-bid requirement
  minimumBidsRequired: varchar("minimum_bids_required", { length: 2 }).notNull().default("3"),
  bidsReceived: varchar("bids_received", { length: 2 }).notNull().default("0"),
  biddingDeadline: timestamp("bidding_deadline"),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("draft"), // "draft", "open_bidding", "evaluating", "awarded", "cancelled"
  
  // Award
  awardedTo: varchar("awarded_to", { length: 255 }),
  awardedAmount: decimal("awarded_amount", { precision: 15, scale: 2 }),
  awardedAt: timestamp("awarded_at"),
  awardJustification: text("award_justification"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Procurement bids
export const procurementBids = pgTable("procurement_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Associated procurement request
  procurementRequestId: uuid("procurement_request_id").notNull(),
  
  // Bidder details
  bidderName: text("bidder_name").notNull(),
  bidderContact: text("bidder_contact").notNull(),
  bidderEmail: varchar("bidder_email", { length: 255 }),
  bidderPhone: varchar("bidder_phone", { length: 20 }),
  
  // Bid amount
  bidAmount: decimal("bid_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Bid details
  bidDocuments: jsonb("bid_documents"), // Array of document URLs
  bidNotes: text("bid_notes"),
  bidValidUntil: timestamp("bid_valid_until"),
  
  // FMV comparison
  fmvBenchmarkId: uuid("fmv_benchmark_id"),
  withinFMVRange: boolean("within_fmv_range").notNull().default(false),
  fmvVariancePercentage: decimal("fmv_variance_percentage", { precision: 6, scale: 2 }), // +/- percentage from FMV median
  
  // Evaluation
  evaluationScore: decimal("evaluation_score", { precision: 5, scale: 2 }), // Out of 100
  evaluationNotes: text("evaluation_notes"),
  evaluatedBy: varchar("evaluated_by", { length: 255 }),
  evaluatedAt: timestamp("evaluated_at"),
  
  // Status
  bidStatus: varchar("bid_status", { length: 20 }).notNull().default("submitted"), // "submitted", "under_review", "accepted", "rejected"
  
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Independent appraisals (for high-value items)
export const independentAppraisals = pgTable("independent_appraisals", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Item being appraised
  itemType: varchar("item_type", { length: 50 }).notNull(), // "real_estate", "equipment", "intellectual_property"
  itemDescription: text("item_description").notNull(),
  itemSpecifications: jsonb("item_specifications"),
  
  // Associated procurement (if applicable)
  procurementRequestId: uuid("procurement_request_id"),
  
  // Appraiser
  appraiserName: text("appraiser_name").notNull(),
  appraiserCompany: text("appraiser_company"),
  appraiserCredentials: text("appraiser_credentials"), // Professional designations
  appraiserContact: text("appraiser_contact"),
  
  // Appraisal
  appraisedValue: decimal("appraised_value", { precision: 15, scale: 2 }).notNull(),
  appraisalMethod: varchar("appraisal_method", { length: 50 }).notNull(), // "comparable_sales", "cost_approach", "income_approach"
  appraisalDate: timestamp("appraisal_date").notNull(),
  appraisalValidUntil: timestamp("appraisal_valid_until"),
  
  // Documentation
  appraisalReport: text("appraisal_report"), // URL/path to full report
  appraisalNotes: text("appraisal_notes"),
  
  // Review
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// CPI-adjusted pricing (auto-escalation)
export const cpiAdjustedPricing = pgTable("cpi_adjusted_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Item/contract
  itemId: uuid("item_id").notNull(),
  itemDescription: text("item_description").notNull(),
  contractId: uuid("contract_id"),
  
  // Original pricing
  originalPrice: decimal("original_price", { precision: 15, scale: 2 }).notNull(),
  originalPriceDate: timestamp("original_price_date").notNull(),
  originalCPI: decimal("original_cpi", { precision: 10, scale: 4 }).notNull(),
  
  // Adjusted pricing
  adjustedPrice: decimal("adjusted_price", { precision: 15, scale: 2 }).notNull(),
  adjustmentDate: timestamp("adjustment_date").notNull(),
  currentCPI: decimal("current_cpi", { precision: 10, scale: 4 }).notNull(),
  
  // Adjustment calculation
  cpiChangePercentage: decimal("cpi_change_percentage", { precision: 6, scale: 4 }).notNull(),
  adjustmentAmount: decimal("adjustment_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Review
  adjustmentApproved: boolean("adjustment_approved").notNull().default(false),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// FMV compliance violations
export const fmvViolations = pgTable("fmv_violations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Violation details
  violationType: varchar("violation_type", { length: 50 }).notNull(), // "no_competitive_bidding", "insufficient_bids", "no_fmv_verification", "no_appraisal"
  violationDescription: text("violation_description").notNull(),
  
  // Associated orgs
  procurementRequestId: uuid("procurement_request_id"),
  transactionId: uuid("transaction_id"),
  
  // Severity
  severity: varchar("severity", { length: 20 }).notNull().default("medium"), // "low", "medium", "high", "critical"
  
  // Resolution
  status: varchar("status", { length: 20 }).notNull().default("pending"), // "pending", "under_review", "resolved", "exception_granted"
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  resolvedAt: timestamp("resolved_at"),
  
  // Detected
  detectedBy: varchar("detected_by", { length: 255 }),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// FMV audit log
export const fmvAuditLog = pgTable("fmv_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // "benchmark_created", "procurement_initiated", "bid_submitted", "appraisal_completed", "cpi_adjusted"
  actionDescription: text("action_description").notNull(),
  
  // Related orgs
  procurementRequestId: uuid("procurement_request_id"),
  bidId: uuid("bid_id"),
  appraisalId: uuid("appraisal_id"),
  
  // Actor
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Compliance impact
  complianceImpact: varchar("compliance_impact", { length: 20 }), // "none", "low", "medium", "high", "critical"
  
  // Metadata
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

