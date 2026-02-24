/**
 * CLC Partnership Schema
 * 
 * Stores data from Canadian Labour Congress partnership integration:
 * - Per-capita benchmark data
 * - Union density statistics
 * - Collective bargaining trends
 * - Sector comparisons
 */

import { pgTable, uuid, varchar, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";

// =============================================================================
// ENUMS
// =============================================================================

export const clcDataTypeEnum = {
  PER_CAPITA: 'per_capita',
  UNION_DENSITY: 'union_density',
  BARGAINING_TRENDS: 'bargaining_trends',
  SECTOR_COMPARISON: 'sector_comparison',
  WAGE_BENCHMARK: 'wage_benchmark',
} as const;

export const clcSyncStatusEnum = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// =============================================================================
// TABLES
// =============================================================================

/**
 * CLC Per-Capita Benchmarks Table
 * 
 * Stores benchmark data for per-capita comparisons across unions.
 */
export const clcPerCapitaBenchmarks = pgTable("clc_per_capita_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Organization Identification
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  organizationName: varchar("organization_name", { length: 500 }).notNull(),
  organizationType: varchar("organization_type", { length: 100 }), // national, provincial, local
  
  // Time Period
  fiscalYear: integer("fiscal_year").notNull(),
  quarter: integer("quarter"), // 1-4, null for annual
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  
  // Membership Data
  totalMembers: integer("total_members").notNull(),
  duesPayingMembers: integer("dues_paying_members"),
  activeMembers: integer("active_members"),
  
  // Per-Capita Data
  perCapitaRate: numeric("per_capita_rate", { precision: 10, scale: 4 }),
  totalRemittance: numeric("total_remittance", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default('CAD'),
  
  // Benchmarks
  nationalAverageRate: numeric("national_average_rate", { precision: 10, scale: 4 }),
  provincialAverageRate: numeric("provincial_average_rate", { precision: 10, scale: 4 }),
  percentileRank: integer("percentile_rank"), // 1-100
  
  // Comparisons
  sizeCategoryComparison: varchar("size_category_comparison", { length: 50 }), // small, medium, large
  sectorComparison: varchar("sector_comparison", { length: 50 }),
  
  // Status
  isVerified: boolean("is_verified").default(false),
  verificationDate: timestamp("verification_date", { withTimezone: true }),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }),
  source: varchar("source", { length: 50 }).default('clc_partnership'),
});

/**
 * CLC Union Density Data Table
 * 
 * Stores union density statistics by sector and region.
 */
export const clcUnionDensity = pgTable("clc_union_density", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Classification
  sector: varchar("sector", { length: 100 }).notNull(),
  subSector: varchar("sub_sector", { length: 100 }),
  industryCode: varchar("industry_code", { length: 20 }),
  
  // Geography
  jurisdiction: varchar("jurisdiction", { length: 10 }).notNull(), // National, Provincial codes
  regionName: varchar("region_name", { length: 255 }),
  
  // Time Period
  year: integer("year").notNull(),
  month: integer("month"), // null for annual
  
  // Density Data
  totalWorkforce: integer("total_workforce"),
  unionMembers: integer("union_members"),
  unionCovered: integer("union_covered"),
  densityPercent: numeric("density_percent", { precision: 5, scale: 2 }),
  coveragePercent: numeric("coverage_percent", { precision: 5, scale: 2 }),
  
  // Change Metrics
  yearOverYearChange: numeric("year_over_year_change", { precision: 5, scale: 2 }),
  monthOverMonthChange: numeric("month_over_month_change", { precision: 5, scale: 2 }),
  
  // Benchmarks
  nationalDensity: numeric("national_density", { precision: 5, scale: 2 }),
  provincialDensity: numeric("provincial_density", { precision: 5, scale: 2 }),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }),
  source: varchar("source", { length: 50 }).default('clc_partnership'),
});

/**
 * CLC Bargaining Trends Table
 * 
 * Stores collective bargaining trend data.
 */
export const clcBargainingTrends = pgTable("clc_bargaining_trends", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Classification
  sector: varchar("sector", { length: 100 }).notNull(),
  subSector: varchar("sub_sector", { length: 100 }),
  bargainingUnitSize: varchar("bargaining_unit_size", { length: 50 }), // small, medium, large
  
  // Time Period
  year: integer("year").notNull(),
  quarter: integer("quarter"),
  
  // Bargaining Metrics
  totalAgreements: integer("total_agreements"),
  settledAgreements: integer("settled_agreements"),
  unsettledAgreements: integer("unsettled_agreements"),
  strikesLockouts: integer("strikes_lockouts"),
  
  // Wage Settlements
  averageWageIncrease: numeric("average_wage_increase", { precision: 5, scale: 2 }),
  medianWageIncrease: numeric("median_wage_increase", { precision: 5, scale: 2 }),
  rangeLow: numeric("range_low", { precision: 5, scale: 2 }),
  rangeHigh: numeric("range_high", { precision: 5, scale: 2 }),
  
  // Duration
  averageDurationMonths: integer("average_duration_months"),
  
  // Settlements with COLA: numeric("cola_settlements", { precision: 5, scale: 2 }),
  colaSettlements: numeric("cola_settlements", { precision: 5, scale: 2 }),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  syncId: varchar("sync_id", { length: 100 }),
  source: varchar("source", { length: 50 }).default('clc_partnership'),
});

/**
 * CLC Partnership Sync Log Table
 * 
 * Tracks sync operations for CLC partnership data.
 */
export const clcSyncLog = pgTable("clc_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Sync Information
  syncType: varchar("sync_type", { length: 50 }).notNull(), // per_capita, union_density, trends
  syncId: varchar("sync_id", { length: 100 }).notNull().unique(),
  
  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default('running'),
  
  // Statistics
  recordsProcessed: integer("records_processed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),
  
  // OAuth Status
  accessTokenUsed: varchar("access_token_used", { length: 50 }),
  tokenRefreshed: boolean("token_refreshed").default(false),
  
  // Error Handling
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),
  
  // Parameters
  parameters: text("parameters"), // JSON string
  
  // Metadata
  initiatedBy: varchar("initiated_by", { length: 100 }),
});

/**
 * CLC OAuth Tokens Table
 * 
 * Stores OAuth tokens for CLC API access.
 */
export const clcOAuthTokens = pgTable("clc_oauth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Token Information
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: varchar("token_type", { length: 50 }).default('Bearer'),
  
  // Scopes
  scopes: text("scopes"), // JSON array
  
  // Expiration
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// TYPES
// =============================================================================

export type CLCDataType = typeof clcDataTypeEnum[keyof typeof clcDataTypeEnum];
export type CLCSyncStatus = typeof clcSyncStatusEnum[keyof typeof clcSyncStatusEnum];

export type CLCPerCapitaBenchmark = typeof clcPerCapitaBenchmarks.$inferSelect;
export type CLCPerCapitaBenchmarkInsert = typeof clcPerCapitaBenchmarks.$inferInsert;

export type CLCUnionDensity = typeof clcUnionDensity.$inferSelect;
export type CLCUnionDensityInsert = typeof clcUnionDensity.$inferInsert;

export type CLCBargainingTrend = typeof clcBargainingTrends.$inferSelect;
export type CLCBargainingTrendInsert = typeof clcBargainingTrends.$inferInsert;

export type CLCSyncLog = typeof clcSyncLog.$inferSelect;
export type CLCSyncLogInsert = typeof clcSyncLog.$inferInsert;

export type CLCOAuthToken = typeof clcOAuthTokens.$inferSelect;
export type CLCOAuthTokenInsert = typeof clcOAuthTokens.$inferInsert;

