import { pgTable, uuid, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/pg-core";

/**
 * Strike Fund Tax Compliance Schema
 * CRA requirements: T4A/RL-1 slips for strike pay >$500/week
 * Federal: T4A (Box 028 - Other Income)
 * Quebec: RL-1 (Box O - Other Income)
 */

// Strike fund disbursements tracking
export const strikeFundDisbursements = pgTable("strike_fund_disbursements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  
  // Strike details
  strikeId: uuid("strike_id"),
  strikeName: text("strike_name"),
  strikeStartDate: timestamp("strike_start_date"),
  strikeEndDate: timestamp("strike_end_date"),
  
  // Payment details
  paymentDate: timestamp("payment_date").notNull(),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // "direct_deposit", "cheque", "e_transfer"
  paymentReference: varchar("payment_reference", { length: 100 }),
  
  // Tax year tracking
  taxYear: varchar("tax_year", { length: 4 }).notNull(),
  taxMonth: varchar("tax_month", { length: 2 }).notNull(),
  
  // Weekly threshold tracking ($500/week CRA threshold)
  weekNumber: varchar("week_number", { length: 10 }).notNull(), // "2025-W01", "2025-W02", etc.
  weeklyTotal: decimal("weekly_total", { precision: 10, scale: 2 }).notNull(), // Running total for week
  exceedsThreshold: boolean("exceeds_threshold").notNull().default(false), // >$500/week
  
  // Tax slip generation
  requiresTaxSlip: boolean("requires_tax_slip").notNull().default(false),
  t4aGenerated: boolean("t4a_generated").notNull().default(false),
  t4aGeneratedAt: timestamp("t4a_generated_at"),
  rl1Generated: boolean("rl1_generated").notNull().default(false), // Quebec only
  rl1GeneratedAt: timestamp("rl1_generated_at"),
  
  // Member location (for Quebec RL-1)
  province: varchar("province", { length: 2 }).notNull(),
  isQuebecResident: boolean("is_quebec_resident").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// T4A tax slips (Federal)
export const t4aTaxSlips = pgTable("t4a_tax_slips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxYear: varchar("tax_year", { length: 4 }).notNull(),
  
  // Payer information (Union)
  payerName: text("payer_name").notNull(),
  payerBusinessNumber: varchar("payer_business_number", { length: 15 }).notNull(), // BN15
  payerAddress: text("payer_address").notNull(),
  payerCity: varchar("payer_city", { length: 100 }).notNull(),
  payerProvince: varchar("payer_province", { length: 2 }).notNull(),
  payerPostalCode: varchar("payer_postal_code", { length: 10 }).notNull(),
  
  // Recipient information (Member)
  recipientName: text("recipient_name").notNull(),
  recipientSin: varchar("recipient_sin", { length: 11 }), // Encrypted SIN
  recipientAddress: text("recipient_address").notNull(),
  recipientCity: varchar("recipient_city", { length: 100 }).notNull(),
  recipientProvince: varchar("recipient_province", { length: 2 }).notNull(),
  recipientPostalCode: varchar("recipient_postal_code", { length: 10 }).notNull(),
  
  // T4A amounts
  box028OtherIncome: decimal("box_028_other_income", { precision: 10, scale: 2 }).notNull(), // Strike pay
  box022IncomeTaxDeducted: decimal("box_022_income_tax_deducted", { precision: 10, scale: 2 }).notNull().default("0.00"),
  
  // Generation details
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  generatedBy: varchar("generated_by", { length: 255 }).notNull(),
  
  // Filing status
  filedWithCRA: boolean("filed_with_cra").notNull().default(false),
  craFilingDate: timestamp("cra_filing_date"),
  craConfirmationNumber: varchar("cra_confirmation_number", { length: 50 }),
  
  // Delivery to member
  deliveredToMember: boolean("delivered_to_member").notNull().default(false),
  deliveryMethod: varchar("delivery_method", { length: 50 }), // "email", "mail", "my_cra_account"
  deliveredAt: timestamp("delivered_at"),
  
  // PDF storage
  pdfUrl: text("pdf_url"),
  xmlUrl: text("xml_url"), // T619 XML format for CRA filing
  
  // Amendments
  isAmendment: boolean("is_amendment").notNull().default(false),
  originalSlipId: uuid("original_slip_id"),
  amendmentReason: text("amendment_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// RL-1 tax slips (Quebec)
export const rl1TaxSlips = pgTable("rl1_tax_slips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxYear: varchar("tax_year", { length: 4 }).notNull(),
  
  // Payer information (Union)
  payerName: text("payer_name").notNull(),
  payerQuebecEnterpriseNumber: varchar("payer_quebec_enterprise_number", { length: 10 }).notNull(), // NEQ
  payerAddress: text("payer_address").notNull(),
  payerCity: varchar("payer_city", { length: 100 }).notNull(),
  payerPostalCode: varchar("payer_postal_code", { length: 10 }).notNull(),
  
  // Recipient information (Member)
  recipientName: text("recipient_name").notNull(),
  recipientSin: varchar("recipient_sin", { length: 11 }), // Encrypted SIN
  recipientAddress: text("recipient_address").notNull(),
  recipientCity: varchar("recipient_city", { length: 100 }).notNull(),
  recipientPostalCode: varchar("recipient_postal_code", { length: 10 }).notNull(),
  
  // RL-1 amounts
  boxOOtherIncome: decimal("box_o_other_income", { precision: 10, scale: 2 }).notNull(), // Strike pay
  boxEQuebecIncomeTaxDeducted: decimal("box_e_quebec_income_tax_deducted", { precision: 10, scale: 2 }).notNull().default("0.00"),
  
  // Generation details
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  generatedBy: varchar("generated_by", { length: 255 }).notNull(),
  
  // Filing status (Revenu Québec)
  filedWithRevenuQuebec: boolean("filed_with_revenu_quebec").notNull().default(false),
  revenuQuebecFilingDate: timestamp("revenu_quebec_filing_date"),
  revenuQuebecConfirmationNumber: varchar("revenu_quebec_confirmation_number", { length: 50 }),
  
  // Delivery to member
  deliveredToMember: boolean("delivered_to_member").notNull().default(false),
  deliveryMethod: varchar("delivery_method", { length: 50 }), // "email", "mail", "my_account_revenu_quebec"
  deliveredAt: timestamp("delivered_at"),
  
  // PDF storage
  pdfUrl: text("pdf_url"),
  xmlUrl: text("xml_url"), // XML format for Revenu Québec filing
  
  // Amendments
  isAmendment: boolean("is_amendment").notNull().default(false),
  originalSlipId: uuid("original_slip_id"),
  amendmentReason: text("amendment_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Year-end tax processing status
export const taxYearEndProcessing = pgTable("tax_year_end_processing", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxYear: varchar("tax_year", { length: 4 }).notNull().unique(),
  
  // Processing timeline
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  
  // T4A summary (Federal)
  t4aSlipsGenerated: varchar("t4a_slips_generated", { length: 10 }).notNull().default("0"),
  t4aTotalAmount: decimal("t4a_total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  t4aFilingDeadline: timestamp("t4a_filing_deadline").notNull(), // Feb 28
  t4aFiledAt: timestamp("t4a_filed_at"),
  t4aFilingConfirmed: boolean("t4a_filing_confirmed").notNull().default(false),
  
  // RL-1 summary (Quebec)
  rl1SlipsGenerated: varchar("rl1_slips_generated", { length: 10 }).notNull().default("0"),
  rl1TotalAmount: decimal("rl1_total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  rl1FilingDeadline: timestamp("rl1_filing_deadline").notNull(), // Feb 28
  rl1FiledAt: timestamp("rl1_filed_at"),
  rl1FilingConfirmed: boolean("rl1_filing_confirmed").notNull().default(false),
  
  // Delivery status
  memberDeliveryStartedAt: timestamp("member_delivery_started_at"),
  memberDeliveryCompletedAt: timestamp("member_delivery_completed_at"),
  slipsDeliveredToMembers: varchar("slips_delivered_to_members", { length: 10 }).notNull().default("0"),
  
  // Compliance status
  complianceStatus: varchar("compliance_status", { length: 20 }).notNull().default("pending"), // "pending", "in_progress", "completed", "overdue"
  deadlineMissed: boolean("deadline_missed").notNull().default(false),
  
  // Audit trail
  processedBy: varchar("processed_by", { length: 255 }),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Weekly threshold tracking (for $500/week monitoring)
export const weeklyThresholdTracking = pgTable("weekly_threshold_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taxYear: varchar("tax_year", { length: 4 }).notNull(),
  weekNumber: varchar("week_number", { length: 10 }).notNull(), // "2025-W01"
  
  // Week details
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  
  // Payments in week
  paymentCount: varchar("payment_count", { length: 10 }).notNull().default("0"),
  weeklyTotal: decimal("weekly_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  
  // Threshold status
  exceedsThreshold: boolean("exceeds_threshold").notNull().default(false), // >$500
  thresholdAmount: decimal("threshold_amount", { precision: 10, scale: 2 }).notNull().default("500.00"),
  
  // Tax slip requirements
  requiresT4A: boolean("requires_t4a").notNull().default(false),
  requiresRL1: boolean("requires_rl1").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

