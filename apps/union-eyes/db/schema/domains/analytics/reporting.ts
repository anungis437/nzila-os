/**
 * =============================================================================
 * PHASE 8: ANALYTICS & REPORTING ENHANCEMENTS - DRIZZLE SCHEMA
 * =============================================================================
 * Purpose: TypeScript schema definitions for analytics and reporting tables
 * Tables: scheduled_reports, report_delivery_history, benchmark_categories,
 *         benchmark_data, organization_benchmark_snapshots
 * Features: Scheduled report delivery, benchmark comparisons, analytics tracking
 * =============================================================================
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  decimal,
  date,
  bigint,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";

// =============================================================================
// TABLE 1: analytics_scheduled_reports
// =============================================================================

export const analyticsScheduledReports = pgTable("analytics_scheduled_reports", {
  // Primary key
  id: uuid("id").primaryKey().defaultRandom(),

  // Multi-tenancy
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  // Report configuration
  reportName: text("report_name").notNull(),
  reportType: text("report_type").notNull(), // 'executive_dashboard', 'communication_analytics', 'engagement_metrics', etc.
  reportDescription: text("report_description"),

  // Report parameters (JSON for flexibility)
  reportParameters: jsonb("report_parameters").default({}).notNull(),

  // Schedule configuration
  scheduleType: text("schedule_type").default("cron").notNull(), // 'cron', 'one_time', 'manual_only'
  cronExpression: text("cron_expression"), // e.g., '0 6 * * 1' (every Monday at 6 AM)
  timezone: text("timezone").default("America/Toronto"),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),

  // Delivery configuration
  recipients: jsonb("recipients").default([]).notNull(), // Array of email addresses
  deliveryFormat: text("delivery_format").default("pdf").notNull(), // 'pdf', 'excel', 'csv', 'all'
  includeAttachments: boolean("include_attachments").default(true),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),

  // Status and metadata
  isActive: boolean("is_active").default(true),
  runCount: integer("run_count").default(0),
  lastRunStatus: text("last_run_status"), // 'success', 'failed', 'running', 'skipped'
  lastRunError: text("last_run_error"),

  // Audit fields
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Indexes for analytics_scheduled_reports
export const analyticsScheduledReportsIndexes = [
  { name: "idx_scheduled_reports_organization", columns: ["organization_id"] },
  { name: "idx_scheduled_reports_next_run", columns: ["next_run_at"], where: "is_active = true" },
  { name: "idx_scheduled_reports_type", columns: ["report_type"] },
  { name: "idx_scheduled_reports_created_by", columns: ["created_by"] },
  { name: "idx_scheduled_reports_active", columns: ["organization_id", "is_active"] },
];

// Relations for analytics_scheduled_reports
export const analyticsScheduledReportsRelations = relations(analyticsScheduledReports, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [analyticsScheduledReports.organizationId],
    references: [organizations.id],
  }),
  deliveries: many(reportDeliveryHistory),
}));

// Types for analytics_scheduled_reports
export type AnalyticsScheduledReport = typeof analyticsScheduledReports.$inferSelect;
export type NewAnalyticsScheduledReport = typeof analyticsScheduledReports.$inferInsert;

// =============================================================================
// TABLE 2: report_delivery_history
// =============================================================================

export const reportDeliveryHistory = pgTable("report_delivery_history", {
  // Primary key
  id: uuid("id").primaryKey().defaultRandom(),

  // Multi-tenancy
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  // Report reference
  scheduledReportId: uuid("scheduled_report_id").references(() => analyticsScheduledReports.id, {
    onDelete: "set null",
  }),
  reportName: text("report_name").notNull(),
  reportType: text("report_type").notNull(),

  // Delivery details
  deliveryMethod: text("delivery_method").default("email").notNull(), // 'email', 'download', 'api'
  recipients: jsonb("recipients").default([]).notNull(),
  deliveryFormat: text("delivery_format").notNull(), // 'pdf', 'excel', 'csv'

  // File storage
  fileUrl: text("file_url"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  fileHash: text("file_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  // Status tracking
  status: text("status").default("pending").notNull(), // 'pending', 'generating', 'sending', 'delivered', 'failed', 'expired'
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),

  // Email delivery details
  emailSubject: text("email_subject"),
  emailOpened: boolean("email_opened").default(false),
  emailOpenedAt: timestamp("email_opened_at", { withTimezone: true }),
  emailClicked: boolean("email_clicked").default(false),
  emailClickedAt: timestamp("email_clicked_at", { withTimezone: true }),

  // Metrics
  generationTimeMs: integer("generation_time_ms"),
  deliveryTimeMs: integer("delivery_time_ms"),

  // Audit fields
  triggeredBy: varchar("triggered_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Indexes for report_delivery_history
export const reportDeliveryHistoryIndexes = [
  { name: "idx_report_delivery_organization", columns: ["organization_id"] },
  { name: "idx_report_delivery_scheduled_report", columns: ["scheduled_report_id"] },
  { name: "idx_report_delivery_status", columns: ["status"] },
  { name: "idx_report_delivery_created_at", columns: ["created_at"] },
  { name: "idx_report_delivery_expires_at", columns: ["expires_at"], where: "status = 'delivered'" },
  { name: "idx_report_delivery_triggered_by", columns: ["triggered_by"] },
];

// Relations for report_delivery_history
export const reportDeliveryHistoryRelations = relations(reportDeliveryHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [reportDeliveryHistory.organizationId],
    references: [organizations.id],
  }),
  scheduledReport: one(analyticsScheduledReports, {
    fields: [reportDeliveryHistory.scheduledReportId],
    references: [analyticsScheduledReports.id],
  }),
}));

// Types for report_delivery_history
export type ReportDeliveryHistory = typeof reportDeliveryHistory.$inferSelect;
export type NewReportDeliveryHistory = typeof reportDeliveryHistory.$inferInsert;

// =============================================================================
// TABLE 3: benchmark_categories
// =============================================================================

export const benchmarkCategories = pgTable("benchmark_categories", {
  // Primary key
  id: uuid("id").primaryKey().defaultRandom(),

  // Category definition
  categoryName: text("category_name").notNull().unique(), // 'membership_growth', 'dues_collection_rate', etc.
  displayName: text("display_name").notNull(),
  description: text("description"),
  categoryGroup: text("category_group").notNull(), // 'financial', 'operational', 'engagement', etc.

  // Metric configuration
  unitType: text("unit_type").notNull(), // 'percentage', 'count', 'currency', 'hours', 'days', 'score'
  calculationMethod: text("calculation_method"),
  higherIsBetter: boolean("higher_is_better").default(true),

  // Display configuration
  displayOrder: integer("display_order").default(0),
  icon: text("icon"),
  color: text("color"),
  isActive: boolean("is_active").default(true),

  // Audit fields
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Indexes for benchmark_categories
export const benchmarkCategoriesIndexes = [
  { name: "idx_benchmark_categories_group", columns: ["category_group"] },
  { name: "idx_benchmark_categories_active", columns: ["is_active"] },
  { name: "idx_benchmark_categories_display_order", columns: ["display_order"] },
];

// Relations for benchmark_categories
export const benchmarkCategoriesRelations = relations(benchmarkCategories, ({ many }) => ({
  benchmarkData: many(benchmarkData),
  organizationSnapshots: many(organizationBenchmarkSnapshots),
}));

// Types for benchmark_categories
export type BenchmarkCategory = typeof benchmarkCategories.$inferSelect;
export type NewBenchmarkCategory = typeof benchmarkCategories.$inferInsert;

// =============================================================================
// TABLE 4: benchmark_data
// =============================================================================

export const benchmarkData = pgTable("benchmark_data", {
  // Primary key
  id: uuid("id").primaryKey().defaultRandom(),

  // Benchmark segmentation
  benchmarkCategoryId: uuid("benchmark_category_id")
    .notNull()
    .references(() => benchmarkCategories.id, { onDelete: "cascade" }),
  unionType: text("union_type").notNull(), // 'public_sector', 'private_sector', 'building_trades', etc.
  unionSizeBracket: text("union_size_bracket").notNull(), // 'small', 'medium', 'large', 'extra_large', 'all'
  region: text("region").notNull(), // 'BC', 'AB', 'ON', 'National', etc.

  // Time period
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  periodType: text("period_type").default("monthly").notNull(), // 'monthly', 'quarterly', 'annual'

  // Benchmark values
  metricValue: decimal("metric_value", { precision: 15, scale: 2 }).notNull(),
  sampleSize: integer("sample_size").notNull(),
  minValue: decimal("min_value", { precision: 15, scale: 2 }),
  maxValue: decimal("max_value", { precision: 15, scale: 2 }),
  percentile25: decimal("percentile_25", { precision: 15, scale: 2 }),
  percentile50: decimal("percentile_50", { precision: 15, scale: 2 }),
  percentile75: decimal("percentile_75", { precision: 15, scale: 2 }),
  standardDeviation: decimal("standard_deviation", { precision: 15, scale: 2 }),

  // Data quality
  dataQualityScore: integer("data_quality_score").default(100),
  isProjected: boolean("is_projected").default(false),
  confidenceLevel: text("confidence_level").default("high"), // 'high', 'medium', 'low'

  // Audit fields
  dataSource: text("data_source"), // 'internal_aggregate', 'industry_survey', 'government_data'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Indexes for benchmark_data
export const benchmarkDataIndexes = [
  { name: "idx_benchmark_data_category", columns: ["benchmark_category_id"] },
  { name: "idx_benchmark_data_union_type", columns: ["union_type"] },
  { name: "idx_benchmark_data_size", columns: ["union_size_bracket"] },
  { name: "idx_benchmark_data_region", columns: ["region"] },
  { name: "idx_benchmark_data_period", columns: ["period_start", "period_end"] },
  {
    name: "idx_benchmark_data_composite",
    columns: ["benchmark_category_id", "union_type", "union_size_bracket", "region", "period_start"],
  },
];

// Relations for benchmark_data
export const benchmarkDataRelations = relations(benchmarkData, ({ one }) => ({
  category: one(benchmarkCategories, {
    fields: [benchmarkData.benchmarkCategoryId],
    references: [benchmarkCategories.id],
  }),
}));

// Types for benchmark_data
export type BenchmarkData = typeof benchmarkData.$inferSelect;
export type NewBenchmarkData = typeof benchmarkData.$inferInsert;

// =============================================================================
// TABLE 5: organization_benchmark_snapshots
// =============================================================================

export const organizationBenchmarkSnapshots = pgTable("organization_benchmark_snapshots", {
  // Primary key
  id: uuid("id").primaryKey().defaultRandom(),

  // Multi-tenancy
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  // Metric reference
  benchmarkCategoryId: uuid("benchmark_category_id")
    .notNull()
    .references(() => benchmarkCategories.id, { onDelete: "cascade" }),

  // Time period
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  periodType: text("period_type").default("monthly").notNull(),

  // Organization metric value
  metricValue: decimal("metric_value", { precision: 15, scale: 2 }).notNull(),

  // Comparison vs. benchmark
  benchmarkValue: decimal("benchmark_value", { precision: 15, scale: 2 }),
  varianceFromBenchmark: decimal("variance_from_benchmark", { precision: 15, scale: 2 }),
  variancePercentage: decimal("variance_percentage", { precision: 8, scale: 2 }),
  percentileRank: integer("percentile_rank"),
  performanceIndicator: text("performance_indicator"), // 'excellent', 'above_average', 'average', 'below_average'

  // Trend analysis
  previousPeriodValue: decimal("previous_period_value", { precision: 15, scale: 2 }),
  periodOverPeriodChange: decimal("period_over_period_change", { precision: 15, scale: 2 }),
  periodOverPeriodPercentage: decimal("period_over_period_percentage", { precision: 8, scale: 2 }),
  trendDirection: text("trend_direction"), // 'improving', 'stable', 'declining'

  // Data quality
  dataCompletenessPercentage: integer("data_completeness_percentage").default(100),
  calculationNotes: text("calculation_notes"),

  // Audit fields
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Indexes for organization_benchmark_snapshots
export const organizationBenchmarkSnapshotsIndexes = [
  { name: "idx_organization_benchmark_snapshots_organization", columns: ["organization_id"] },
  { name: "idx_organization_benchmark_snapshots_category", columns: ["benchmark_category_id"] },
  { name: "idx_organization_benchmark_snapshots_period", columns: ["period_start", "period_end"] },
  {
    name: "idx_organization_benchmark_snapshots_composite",
    columns: ["organization_id", "benchmark_category_id", "period_start"],
  },
  { name: "idx_organization_benchmark_snapshots_performance", columns: ["performance_indicator"] },
];

// Relations for organization_benchmark_snapshots
export const organizationBenchmarkSnapshotsRelations = relations(organizationBenchmarkSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationBenchmarkSnapshots.organizationId],
    references: [organizations.id],
  }),
  category: one(benchmarkCategories, {
    fields: [organizationBenchmarkSnapshots.benchmarkCategoryId],
    references: [benchmarkCategories.id],
  }),
}));

// Types for organization_benchmark_snapshots
export type OrganizationBenchmarkSnapshot = typeof organizationBenchmarkSnapshots.$inferSelect;
export type NewOrganizationBenchmarkSnapshot = typeof organizationBenchmarkSnapshots.$inferInsert;

// =============================================================================
// TYPE UNIONS & UTILITY TYPES
// =============================================================================

// Report types enum
export const REPORT_TYPES = [
  "executive_dashboard",
  "communication_analytics",
  "engagement_metrics",
  "financial_summary",
  "training_completion",
  "grievance_summary",
  "dues_collection",
  "organizing_progress",
  "benchmark_comparison",
  "custom",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

// Schedule types enum
export const SCHEDULE_TYPES = ["cron", "one_time", "manual_only"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

// Delivery formats enum
export const DELIVERY_FORMATS = ["pdf", "excel", "csv", "all"] as const;
export type DeliveryFormat = (typeof DELIVERY_FORMATS)[number];

// Delivery status enum
export const DELIVERY_STATUSES = [
  "pending",
  "generating",
  "sending",
  "delivered",
  "failed",
  "expired",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// Union types enum
export const UNION_TYPES = [
  "public_sector",
  "private_sector",
  "building_trades",
  "industrial",
  "service",
  "healthcare",
  "education",
  "all",
] as const;
export type UnionType = (typeof UNION_TYPES)[number];

// Union size brackets enum
export const UNION_SIZE_BRACKETS = ["small", "medium", "large", "extra_large", "all"] as const;
export type UnionSizeBracket = (typeof UNION_SIZE_BRACKETS)[number];

// Performance indicators enum
export const PERFORMANCE_INDICATORS = [
  "excellent",
  "above_average",
  "average",
  "below_average",
  "needs_improvement",
] as const;
export type PerformanceIndicator = (typeof PERFORMANCE_INDICATORS)[number];

// Trend directions enum
export const TREND_DIRECTIONS = ["improving", "stable", "declining"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

// Benchmark category groups enum
export const BENCHMARK_CATEGORY_GROUPS = [
  "financial",
  "operational",
  "engagement",
  "training",
  "organizing",
  "membership",
] as const;
export type BenchmarkCategoryGroup = (typeof BENCHMARK_CATEGORY_GROUPS)[number];

// Unit types enum
export const UNIT_TYPES = [
  "percentage",
  "count",
  "currency",
  "hours",
  "days",
  "score",
  "ratio",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// Scheduled report creation payload
export interface CreateScheduledReportPayload {
  reportName: string;
  reportType: ReportType;
  reportDescription?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportParameters?: Record<string, any>;
  scheduleType: ScheduleType;
  cronExpression?: string;
  timezone?: string;
  recipients: string[];
  deliveryFormat: DeliveryFormat;
  includeAttachments?: boolean;
  emailSubject?: string;
  emailBody?: string;
  isActive?: boolean;
}

// Benchmark comparison request
export interface BenchmarkComparisonRequest {
  categoryIds: string[]; // Array of benchmark_category_id
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  comparisonLevels: Array<"local" | "regional" | "national">;
}

// Benchmark comparison response
export interface BenchmarkComparisonResponse {
  categoryName: string;
  displayName: string;
  categoryGroup: BenchmarkCategoryGroup;
  unitType: UnitType;
  organizationValue: number;
  localAverage?: number;
  regionalAverage?: number;
  nationalAverage?: number;
  percentileRank: number;
  performanceIndicator: PerformanceIndicator;
  trendDirection: TrendDirection;
  periodOverPeriodPercentage: number;
}

// Report delivery request
export interface TriggerReportDeliveryPayload {
  scheduledReportId: string;
  deliveryMethod?: "email" | "download" | "api";
  overrideRecipients?: string[];
  overrideFormat?: DeliveryFormat;
}

// Communication analytics summary
export interface CommunicationAnalyticsSummary {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickThroughRate: number;
  optOutRate: number;
  byChannel: {
    email: ChannelMetrics;
    sms: ChannelMetrics;
    push: ChannelMetrics;
  };
  bySegment: Array<{
    segmentName: string;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
  }>;
  timeSeries: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
}

interface ChannelMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickThroughRate: number;
}

// Engagement metrics summary
export interface EngagementMetricsSummary {
  averageScore: number;
  medianScore: number;
  scoreDistribution: Array<{
    bucket: string; // '0-20', '21-40', etc.
    count: number;
    percentage: number;
  }>;
  topEngagedMembers: Array<{
    memberId: string;
    memberName: string;
    engagementScore: number;
    lastActivity: string;
  }>;
  atRiskMembers: Array<{
    memberId: string;
    memberName: string;
    engagementScore: number;
    daysInactive: number;
    churnRisk: "high" | "medium" | "low";
  }>;
  trendData: Array<{
    month: string;
    averageScore: number;
    activeMembers: number;
  }>;
  activityHeatmap: Array<{
    dayOfWeek: string;
    hourOfDay: number;
    activityCount: number;
  }>;
}

// =============================================================================
// Note: All tables, relations, and types are already exported with `export const`
// at their declaration points above, so no additional re-export block is needed.
// =============================================================================

