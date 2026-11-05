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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// TABLE 1: analytics_scheduled_reports
// =============================================================================

// Indexes for analytics_scheduled_reports
export const analyticsScheduledReportsIndexes = [
  { name: "idx_scheduled_reports_organization", columns: ["organization_id"] },
  { name: "idx_scheduled_reports_next_run", columns: ["next_run_at"], where: "is_active = true" },
  { name: "idx_scheduled_reports_type", columns: ["report_type"] },
  { name: "idx_scheduled_reports_created_by", columns: ["created_by"] },
  { name: "idx_scheduled_reports_active", columns: ["organization_id", "is_active"] },
];

// Types for analytics_scheduled_reports

// =============================================================================
// TABLE 2: report_delivery_history
// =============================================================================

// Indexes for report_delivery_history
export const reportDeliveryHistoryIndexes = [
  { name: "idx_report_delivery_organization", columns: ["organization_id"] },
  { name: "idx_report_delivery_scheduled_report", columns: ["scheduled_report_id"] },
  { name: "idx_report_delivery_status", columns: ["status"] },
  { name: "idx_report_delivery_created_at", columns: ["created_at"] },
  { name: "idx_report_delivery_expires_at", columns: ["expires_at"], where: "status = 'delivered'" },
  { name: "idx_report_delivery_triggered_by", columns: ["triggered_by"] },
];

// Types for report_delivery_history

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
export const benchmarkCategoriesRelations = relations(benchmarkCategories, () => ({
}));

// Types for benchmark_categories
export type BenchmarkCategory = typeof benchmarkCategories.$inferSelect;
export type NewBenchmarkCategory = typeof benchmarkCategories.$inferInsert;

// =============================================================================
// TABLE 4: benchmark_data
// =============================================================================

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

// Types for benchmark_data

// =============================================================================
// TABLE 5: organization_benchmark_snapshots
// =============================================================================

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

// Types for organization_benchmark_snapshots

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

