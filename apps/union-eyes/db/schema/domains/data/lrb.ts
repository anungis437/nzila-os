/**
 * LRB Agreements Schema
 * 
 * Stores collective agreement data from Provincial Labour Relations Boards:
 * - Ontario LRB (Ontario Labour Relations Board)
 * - BC LRB (BC Labour Relations Board)
 * - Federal (Canada Labour Board)
 */

import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

// =============================================================================
// ENUMS
// =============================================================================

export const lrbSourceEnum = {
  ONTARIO: 'ontario_lrb',
  BC: 'bc_lrb',
  FEDERAL: 'federal_lrb',
} as const;

export const agreementStatusEnum = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  PENDING: 'pending',
  TERMINATED: 'terminated',
  RENEWED: 'renewed',
} as const;

export const sectorEnum = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  PUBLIC_SERVICE: 'public_service',
  PARAPUBLIC: 'parapublic',
} as const;

// =============================================================================
// TABLES
// =============================================================================

/**
 * LRB Agreements Table
 * 
 * Stores collective agreements from various Labour Relations Boards.
 */
export const lrbAgreements = pgTable("lrb_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Source Identification
  source: varchar("source", { length: 50 }).notNull(), // ontario_lrb, bc_lrb, federal_lrb
  sourceId: varchar("source_id", { length: 100 }).notNull(), // Original LRB file number
  
  // Parties
  employerName: varchar("employer_name", { length: 500 }).notNull(),
  employerAddress: text("employer_address"),
  unionName: varchar("union_name", { length: 500 }).notNull(),
  unionCode: varchar("union_code", { length: 50 }),
  
  // Bargaining Unit
  bargainingUnit: varchar("bargaining_unit", { length: 500 }),
  bargainingUnitSize: integer("bargaining_unit_size"),
  
  // Dates
  agreementDate: varchar("agreement_date", { length: 20 }), // YYYY-MM or YYYY
  effectiveDate: timestamp("effective_date", { withTimezone: true }),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  ratificationDate: timestamp("ratification_date", { withTimezone: true }),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default('active'),
  
  // Sector and Industry
  sector: varchar("sector", { length: 50 }),
  industryCode: varchar("industry_code", { length: 20 }), // NAICS code
  industryName: varchar("industry_name", { length: 255 }),
  geographicScope: varchar("geographic_scope", { length: 100 }), // Provincial, Local, National
  
  // Jurisdiction
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull(), // ON, BC, AB, etc.
  
  // Wage Information
  hourlyWageRange: varchar("hourly_wage_range", { length: 100 }),
  annualSalaryRange: varchar("annual_salary_range", { length: 100 }),
  
  // Document URLs
  pdfUrl: varchar("pdf_url", { length: 1000 }),
  htmlUrl: varchar("html_url", { length: 1000 }),
  jsonUrl: varchar("json_url", { length: 1000 }),
  
  // Extracted Content (for AI analysis)
  extractedContent: text("extracted_content"),
  keyTerms: jsonb("key_terms"),
  
  // Search and Classification
  searchKeywords: text("search_keywords"), // Comma-separated for full-text search
  nocCodes: text("noc_codes"), // Comma-separated NOC codes
  occupationCategory: varchar("occupation_category", { length: 100 }),
  
  // AI/ML Processing
  embeddingVector: text("embedding_vector"), // pgvector embedding for semantic search
  aiSummary: text("ai_summary"),
  sentimentScore: integer("sentiment_score"), // -100 to 100
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncId: varchar("sync_id", { length: 100 }),
});

/**
 * LRB Employers Table
 * 
 * Tracks employers that appear in LRB agreements.
 */
export const lrbEmployers = pgTable("lrb_employers", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Employer Information
  employerName: varchar("employer_name", { length: 500 }).notNull(),
  employerNameAlt: varchar("employer_name_alt", { length: 500 }), // AKA names
  
  // Location
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull(),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  
  // Industry
  industryCode: varchar("industry_code", { length: 20 }),
  industryName: varchar("industry_name", { length: 255 }),
  
  // Statistics
  totalAgreements: integer("total_agreements").default(0),
  activeAgreements: integer("active_agreements").default(0),
  
  // Last Seen
  lastAgreementDate: varchar("last_agreement_date", { length: 20 }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

/**
 * LRB Unions Table
 * 
 * Tracks unions that appear in LRB agreements.
 */
export const lrbUnions = pgTable("lrb_unions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Union Information
  unionName: varchar("union_name", { length: 500 }).notNull(),
  unionCode: varchar("union_code", { length: 50 }),
  acronym: varchar("acronym", { length: 20 }),
  
  // Affiliation
  parentOrganization: varchar("parent_organization", { length: 500 }),
  affiliationLevel: varchar("affiliation_level", { length: 50 }), // National, Provincial, Local
  
  // Jurisdiction
  primaryJurisdiction: varchar("primary_jurisdiction", { length: 10 }),
  
  // Statistics
  totalAgreements: integer("total_agreements").default(0),
  activeAgreements: integer("active_agreements").default(0),
  totalMembers: integer("total_members"), // Approximate
  
  // Last Seen
  lastAgreementDate: varchar("last_agreement_date", { length: 20 }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

/**
 * LRB Sync Log Table
 * 
 * Tracks sync operations for LRB data sources.
 */
export const lrbSyncLog = pgTable("lrb_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Sync Information
  source: varchar("source", { length: 50 }).notNull(),
  syncId: varchar("sync_id", { length: 100 }).notNull().unique(),
  
  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default('running'),
  
  // Statistics
  pagesProcessed: integer("pages_processed").default(0),
  agreementsFound: integer("agreements_found").default(0),
  agreementsInserted: integer("agreements_inserted").default(0),
  agreementsUpdated: integer("agreements_updated").default(0),
  agreementsFailed: integer("agreements_failed").default(0),
  
  // Error Handling
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),
  
  // Parameters
  syncType: varchar("sync_type", { length: 50 }).notNull().default('full'), // full, incremental, manual
  parameters: text("parameters"), // JSON string
  
  // Metadata
  initiatedBy: varchar("initiated_by", { length: 100 }),
});

// =============================================================================
// TYPES
// =============================================================================

export type LRBSource = typeof lrbSourceEnum[keyof typeof lrbSourceEnum];
export type AgreementStatus = typeof agreementStatusEnum[keyof typeof agreementStatusEnum];
export type Sector = typeof sectorEnum[keyof typeof sectorEnum];

export type LRBAgreement = typeof lrbAgreements.$inferSelect;
export type LRBAgreementInsert = typeof lrbAgreements.$inferInsert;

export type LRBEmployer = typeof lrbEmployers.$inferSelect;
export type LRBEmployerInsert = typeof lrbEmployers.$inferInsert;

export type LRBUnion = typeof lrbUnions.$inferSelect;
export type LRBUnionInsert = typeof lrbUnions.$inferInsert;

export type LRBSyncLog = typeof lrbSyncLog.$inferSelect;
export type LRBSyncLogInsert = typeof lrbSyncLog.$inferInsert;

