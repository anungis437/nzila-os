/**
 * Wage Benchmarks Schema
 * 
 * Stores Statistics Canada wage data for CBA enrichment and comparison.
 * Enables wage benchmarking against industry/occupation standards.
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  numeric, 
  integer, 
  timestamp, 
  text, 
  index,
  boolean 
} from "drizzle-orm/pg-core";

// =============================================================================
// ENUMS
// =============================================================================

export const geographyTypeEnum = {
  NATIONAL: 'national',
  PROVINCIAL: 'provincial',
  REGIONAL: 'regional',
} as const;

export const wageUnitEnum = {
  HOURLY: 'hourly',
  ANNUAL: 'annual',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
} as const;

export const educationLevelEnum = {
  LESS_THAN_GRADE_10: 'lt_grade_10',
  GRADE_10_11: 'grade_10_11',
  GRADE_12: 'grade_12',
  NON_UNIVERSITY_CERTIFICATE: 'non_uni_cert',
  UNIVERSITY_CERTIFICATE: 'uni_cert',
  UNIVERSITY_DEGREE: 'uni_degree',
  GRADUATE_DEGREE: 'graduate',
} as const;

export const sexEnum = {
  MALE: 'M',
  FEMALE: 'F',
  BOTH: 'B',
} as const;

// =============================================================================
// TABLES
// =============================================================================

/**
 * Wage Benchmarks Table
 * 
 * Stores wage data from Statistics Canada for various NOC codes,
 * geographies, and demographics. Used for CBA wage comparison.
 */
export const wageBenchmarks = pgTable("wage_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),

  // NOC Classification
  nocCode: varchar("noc_code", { length: 10 }).notNull(),
  nocName: varchar("noc_name", { length: 255 }).notNull(),
  nocCategory: varchar("noc_category", { length: 100 }), // e.g., "Trades, transport and equipment operators"

  // Geography
  geographyCode: varchar("geography_code", { length: 10 }).notNull(), // StatCan code (01=Canada, 35=Ontario, etc.)
  geographyName: varchar("geography_name", { length: 255 }).notNull(),
  geographyType: varchar("geography_type", { length: 20 }).notNull().default('national'),

  // Industry (NAICS)
  naicsCode: varchar("naics_code", { length: 10 }),
  naicsName: varchar("naics_name", { length: 255 }),

  // Wage Data
  wageValue: numeric("wage_value", { precision: 12, scale: 2 }).notNull(),
  wageUnit: varchar("wage_unit", { length: 20 }).notNull().default('hourly'),
  wageType: varchar("wage_type", { length: 50 }).notNull(), // median, average, p10, p25, p75, p90

  // Demographics
  sex: varchar("sex", { length: 1 }).notNull().default('B'),
  ageGroup: varchar("age_group", { length: 50 }),
  ageGroupName: varchar("age_group_name", { length: 100 }),
  educationLevel: varchar("education_level", { length: 50 }),

  // Statistics
  statisticsType: varchar("statistics_type", { length: 100 }),
  dataType: varchar("data_type", { length: 100 }),

  // Reference Information
  refDate: varchar("ref_date", { length: 20 }).notNull(), // YYYY-MM format
  surveyYear: integer("survey_year").notNull(),
  source: varchar("source", { length: 100 }).notNull().default('Statistics Canada'),
  
  // Data Quality
  dataQualitySymbol: varchar("data_quality_symbol", { length: 10 }),
  isTerminated: boolean("is_terminated").default(false),
  decimals: integer("decimals").default(2),

  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }), // ID for tracking sync batches

}, (table) => [
  // Indexes for common queries
  index("idx_wage_benchmarks_noc").on(table.nocCode),
  index("idx_wage_benchmarks_geography").on(table.geographyCode),
  index("idx_wage_benchmarks_noc_geo").on(table.nocCode, table.geographyCode),
  index("idx_wage_benchmarks_ref_date").on(table.refDate),
  index("idx_wage_benchmarks_sync").on(table.syncId),
  index("idx_wage_benchmarks_composite").on(
    table.nocCode, 
    table.geographyCode, 
    table.sex, 
    table.refDate
  ),
]);

/**
 * Union Density Table
 * 
 * Stores union density and coverage rates by industry, occupation,
 * and geography for benchmarking union strength.
 */
export const unionDensity = pgTable("union_density", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Geography
  geographyCode: varchar("geography_code", { length: 10 }).notNull(),
  geographyName: varchar("geography_name", { length: 255 }).notNull(),

  // Classification
  naicsCode: varchar("naics_code", { length: 10 }),
  naicsName: varchar("naics_name", { length: 255 }),
  nocCode: varchar("noc_code", { length: 10 }),
  nocName: varchar("noc_name", { length: 255 }),

  // Demographics
  sex: varchar("sex", { length: 1 }).notNull().default('B'),
  ageGroup: varchar("age_group", { length: 50 }),
  ageGroupName: varchar("age_group_name", { length: 100 }),
  citizenship: varchar("citizenship", { length: 50 }),
  citizenshipName: varchar("citizenship_name", { length: 100 }),

  // Union Data
  unionStatus: varchar("union_status", { length: 50 }).notNull(), // union_member, union_covered
  unionStatusName: varchar("union_status_name", { length: 100 }).notNull(),
  densityValue: numeric("density_value", { precision: 5, scale: 2 }).notNull(), // Percentage

  // Reference Information
  refDate: varchar("ref_date", { length: 20 }).notNull(),
  surveyYear: integer("survey_year").notNull(),
  source: varchar("source", { length: 100 }).notNull().default('Statistics Canada'),

  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }),

}, (table) => [
  index("idx_union_density_noc").on(table.nocCode),
  index("idx_union_density_naics").on(table.naicsCode),
  index("idx_union_density_geo").on(table.geographyCode),
  index("idx_union_density_ref").on(table.refDate),
]);

/**
 * Cost of Living / Inflation Data Table
 * 
 * Stores CPI and inflation rates for COLA calculations in CBAs.
 */
export const costOfLivingData = pgTable("cost_of_living_data", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Geography
  geographyCode: varchar("geography_code", { length: 10 }).notNull(),
  geographyName: varchar("geography_name", { length: 255 }).notNull(),

  // CPI Data
  cpiValue: numeric("cpi_value", { precision: 10, scale: 2 }).notNull(),
  cpiVector: varchar("cpi_vector", { length: 50 }),

  // Inflation Rates
  inflationRate: numeric("inflation_rate", { precision: 5, scale: 2 }).notNull(),
  year: integer("year").notNull(),

  // Reference
  refDate: varchar("ref_date", { length: 20 }).notNull(),
  source: varchar("source", { length: 100 }).notNull().default('Statistics Canada'),

  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }),

}, (table) => [
  index("idx_col_data_geo").on(table.geographyCode),
  index("idx_col_data_year").on(table.year),
]);

/**
 * Contribution Rates Table
 * 
 * Stores EI and CPP contribution rates for benefit calculations.
 */
export const contributionRates = pgTable("contribution_rates", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Rate Type
  rateType: varchar("rate_type", { length: 50 }).notNull(), // ei_employee, ei_employer, cpp_employee, cpp_employer
  rateTypeName: varchar("rate_type_name", { length: 100 }),

  // Rates
  rate: numeric("rate", { precision: 5, scale: 4 }).notNull(), // Percentage as decimal (0.063 = 6.3%)
  
  // Limits
  maxInsurableEarnings: numeric("max_insurable_earnings", { precision: 12, scale: 2 }),
  exemptionLimit: numeric("exemption_limit", { precision: 12, scale: 2 }),
  maximumContribution: numeric("maximum_contribution", { precision: 12, scale: 2 }),

  // Year
  year: integer("year").notNull(),
  effectiveDate: varchar("effective_date", { length: 20 }),
  source: varchar("source", { length: 100 }).notNull().default('Canada Revenue Agency'),

  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }),

}, (table) => [
  index("idx_contribution_rates_type").on(table.rateType),
  index("idx_contribution_rates_year").on(table.year),
]);

/**
 * External Data Sync Log
 * 
 * Tracks sync operations for external data sources.
 */
export const externalDataSyncLog = pgTable("external_data_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Source Information
  source: varchar("source", { length: 100 }).notNull(), // statcan, lrb_on, lrb_bc, clc
  sourceType: varchar("source_type", { length: 50 }).notNull(), // api, scraper, bulk_download

  // Sync Details
  syncId: varchar("sync_id", { length: 100 }).notNull().unique(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default('running'), // running, completed, failed

  // Statistics
  recordsProcessed: integer("records_processed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),

  // Error Handling
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),

  // Metadata
  initiatedBy: varchar("initiated_by", { length: 100 }),
  syncType: varchar("sync_type", { length: 50 }).notNull().default('manual'), // manual, scheduled, on_demand
  parameters: text("parameters"), // JSON string of sync parameters

}, (table) => [
  index("idx_sync_log_source").on(table.source),
  index("idx_sync_log_status").on(table.status),
  index("idx_sync_log_started").on(table.startedAt),
]);

// =============================================================================
// TYPES
// =============================================================================

export type WageBenchmark = typeof wageBenchmarks.$inferSelect;
export type WageBenchmarkInsert = typeof wageBenchmarks.$inferInsert;

export type UnionDensity = typeof unionDensity.$inferSelect;
export type UnionDensityInsert = typeof unionDensity.$inferInsert;

export type CostOfLivingData = typeof costOfLivingData.$inferSelect;
export type CostOfLivingDataInsert = typeof costOfLivingData.$inferInsert;

export type ContributionRate = typeof contributionRates.$inferSelect;
export type ContributionRateInsert = typeof contributionRates.$inferInsert;

export type ExternalDataSyncLog = typeof externalDataSyncLog.$inferSelect;
export type ExternalDataSyncLogInsert = typeof externalDataSyncLog.$inferInsert;

