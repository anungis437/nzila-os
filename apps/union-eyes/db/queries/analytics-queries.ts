/**
 * Analytics Queries Module
 * 
 * Comprehensive query layer for analytics and reporting system.
 * Provides functions to retrieve metrics, trends, and aggregated data
 * from materialized views and base tables.
 * 
 * Created: November 14, 2025
 * Part of: Area 5 - Analytics & Reporting System
 */

import { sql, SQL } from 'drizzle-orm';
import { db } from '@/db/db';
import { safeColumnName } from '@/lib/safe-sql-identifiers';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ExecutiveSummary {
  totalClaims: number;
  openClaims: number;
  resolvedClaims: number;
  avgResolutionDays: number;
  activeMembers: number;
  activeStewards: number;
  onTimeDeadlineRate: number;
  totalClaimValue: number;
  winRate: number;
  periodComparison: {
    claimsGrowth: number;
    resolutionTimeChange: number;
    winRateChange: number;
  };
}

export interface ClaimsAnalytics {
  totalClaims: number;
  claimsByStatus: Record<string, number>;
  claimsByType: Record<string, number>;
  claimsByPriority: Record<string, number>;
  avgResolutionDays: number;
  medianResolutionDays: number;
  resolutionTrend: Array<{ date: string; count: number; avgDays: number }>;
  topStewards: Array<{ id: string; name: string; caseload: number; performanceScore: number }>;
}

export interface MemberAnalytics {
  totalMembers: number;
  activeMembers: number;
  newMembers30Days: number;
  retentionRate: number;
  avgClaimsPerMember: number;
  engagementDistribution: Record<string, number>;
  topMembers: Array<{ id: string; name: string; claimsCount: number; winRate: number }>;
  cohortAnalysis: Array<{ cohortMonth: string; size: number; retentionRate: number }>;
}

export interface DeadlineAnalytics {
  totalDeadlines: number;
  overdueCount: number;
  onTimeRate: number;
  avgDaysOverdue: number;
  criticalOverdueCount: number;
  extensionApprovalRate: number;
  complianceTrend: Array<{ date: string; onTimeRate: number; overdueCount: number }>;
  deadlinesByPriority: Record<string, number>;
}

export interface FinancialAnalytics {
  totalClaimValue: number;
  totalSettlements: number;
  totalLegalCosts: number;
  avgClaimValue: number;
  avgSettlement: number;
  costPerClaim: number;
  recoveryRate: number;
  financialTrend: Array<{ date: string; claimValue: number; settlements: number; costs: number }>;
  outcomeDistribution: Record<string, { count: number; value: number }>;
}

export interface TrendData {
  period: string;
  value: number;
  change: number;
  changePercentage: number;
}

export interface HeatmapData {
  dayOfWeek: number;
  hourOfDay: number;
  activityScore: number;
  claimCount: number;
}

// ============================================================================
// Executive Dashboard Queries
// ============================================================================

/**
 * Get executive summary with KPIs and period comparison
 */
export async function getExecutiveSummary(
  organizationId: string,
  dateRange: DateRange
): Promise<ExecutiveSummary> {
  const { startDate, endDate } = dateRange;
  
  // Get current period metrics
  const currentMetrics = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) AS total_claims,
      COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'open') AS open_claims,
      COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'resolved') AS resolved_claims,
      AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_days,
      COUNT(DISTINCT c.member_id) AS active_members,
      COUNT(DISTINCT c.assigned_to) AS active_stewards,
      SUM(COALESCE((c.metadata->>'claim_value')::numeric, 0)) AS total_claim_value,
      ROUND(100.0 * COUNT(*) FILTER (WHERE c.outcome = 'won') / NULLIF(COUNT(*) FILTER (WHERE c.outcome IS NOT NULL), 0), 1) AS win_rate
    FROM claims c
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${startDate} AND ${endDate}
  `);

  // Get deadline compliance
  const deadlineMetrics = await db.execute(sql`
    SELECT 
      ROUND(100.0 * COUNT(*) FILTER (WHERE cd.status = 'completed' AND cd.completed_at <= cd.current_deadline) / 
            NULLIF(COUNT(*) FILTER (WHERE cd.status IN ('completed', 'overdue')), 0), 1) AS on_time_rate
    FROM claim_deadlines cd
    WHERE cd.organization_id = ${organizationId}
      AND cd.created_at BETWEEN ${startDate} AND ${endDate}
  `);

  // Get previous period for comparison (same length as current period)
  const periodLengthDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(startDate.getTime() - periodLengthDays * 24 * 60 * 60 * 1000);
  const prevEndDate = startDate;

  const prevMetrics = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) AS total_claims,
      AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_days,
      ROUND(100.0 * COUNT(*) FILTER (WHERE c.outcome = 'won') / NULLIF(COUNT(*) FILTER (WHERE c.outcome IS NOT NULL), 0), 1) AS win_rate
    FROM claims c
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${prevStartDate} AND ${prevEndDate}
  `);

  const current = currentMetrics[0];
  const prev = prevMetrics[0];

  return {
    totalClaims: Number(current.total_claims || 0),
    openClaims: Number(current.open_claims || 0),
    resolvedClaims: Number(current.resolved_claims || 0),
    avgResolutionDays: Number(current.avg_resolution_days || 0),
    activeMembers: Number(current.active_members || 0),
    activeStewards: Number(current.active_stewards || 0),
    onTimeDeadlineRate: Number(deadlineMetrics[0]?.on_time_rate || 0),
    totalClaimValue: Number(current.total_claim_value || 0),
    winRate: Number(current.win_rate || 0),
    periodComparison: {
      claimsGrowth: Number(prev.total_claims) > 0 
        ? Math.round(((Number(current.total_claims) - Number(prev.total_claims)) / Number(prev.total_claims)) * 100)
        : 0,
      resolutionTimeChange: Number(prev.avg_resolution_days) > 0
        ? Math.round(((Number(current.avg_resolution_days) - Number(prev.avg_resolution_days)) / Number(prev.avg_resolution_days)) * 100)
        : 0,
      winRateChange: Number(prev.win_rate) > 0
        ? Math.round(((Number(current.win_rate) - Number(prev.win_rate)) / Number(prev.win_rate)) * 100)
        : 0,
    },
  };
}

/**
 * Get monthly trends from materialized view
 */
export async function getMonthlyTrends(
  organizationId: string,
  monthsBack: number = 12
): Promise<TrendData[]> {
  const trends = await db.execute(sql`
    SELECT 
      TO_CHAR(month, 'YYYY-MM') AS period,
      total_claims AS value,
      COALESCE(month_over_month_growth, 0) AS change_percentage
    FROM mv_monthly_trends
    WHERE organization_id = ${organizationId}
      AND month >= NOW() - INTERVAL '${monthsBack} months'
    ORDER BY month DESC
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return trends.map((row: any) => ({
    period: row.period,
    value: Number(row.value),
    change: 0, // Will be calculated from change_percentage
    changePercentage: Number(row.change_percentage || 0),
  }));
}

// ============================================================================
// Claims Analytics Queries
// ============================================================================

/**
 * Get comprehensive claims analytics
 */
export async function getClaimsAnalytics(
  organizationId: string,
  dateRange: DateRange
): Promise<ClaimsAnalytics> {
  const { startDate, endDate } = dateRange;

  // Get aggregate metrics
  const metrics = await db.execute(sql`
    SELECT 
      COUNT(*) AS total_claims,
      AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) 
        FILTER (WHERE c.resolved_at IS NOT NULL) AS median_resolution_days
    FROM claims c
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${startDate} AND ${endDate}
  `);

  // Get claims by status
  const statusBreakdown = await db.execute(sql`
    SELECT c.status, COUNT(*) AS count
    FROM claims c
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY c.status
  `);

  // Get claims by type
  const typeBreakdown = await db.execute(sql`
    SELECT c.claim_type, COUNT(*) AS count
    FROM claims c
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY c.claim_type
  `);

  // Get claims by priority
  const priorityBreakdown = await db.execute(sql`
    SELECT c.priority, COUNT(*) AS count
    FROM claims c
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY c.priority
  `);

  // Get resolution trend (daily)
  const resolutionTrend = await db.execute(sql`
    SELECT 
      TO_CHAR(report_date, 'YYYY-MM-DD') AS date,
      resolved_claims AS count,
      ROUND(avg_resolution_days::numeric, 1) AS avg_days
    FROM mv_claims_daily_summary
    WHERE organization_id = ${organizationId}
      AND report_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY report_date
  `);

  // Get top stewards by performance
  const topStewards = await db.execute(sql`
    SELECT 
      steward_id AS id,
      first_name || ' ' || last_name AS name,
      total_caseload AS caseload,
      ROUND(performance_score::numeric, 1) AS performance_score
    FROM mv_steward_performance
    WHERE organization_id = ${organizationId}
    ORDER BY performance_score DESC NULLS LAST
    LIMIT 10
  `);

  return {
    totalClaims: Number(metrics[0]?.total_claims || 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    claimsByStatus: Object.fromEntries(statusBreakdown.map((r: any) => [r.status, Number(r.count)])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    claimsByType: Object.fromEntries(typeBreakdown.map((r: any) => [r.claim_type, Number(r.count)])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    claimsByPriority: Object.fromEntries(priorityBreakdown.map((r: any) => [r.priority, Number(r.count)])),
    avgResolutionDays: Number(metrics[0]?.avg_resolution_days || 0),
    medianResolutionDays: Number(metrics[0]?.median_resolution_days || 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolutionTrend: resolutionTrend.map((r: any) => ({
      date: r.date,
      count: Number(r.count),
      avgDays: Number(r.avg_days || 0),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topStewards: topStewards.map((r: any) => ({
      id: r.id,
      name: r.name,
      caseload: Number(r.caseload),
      performanceScore: Number(r.performance_score || 0),
    })),
  };
}

/**
 * Get claims by date range with filters
 */
export async function getClaimsByDateRange(
  organizationId: string,
  dateRange: DateRange,
  filters?: {
    status?: string[];
    claimType?: string[];
    priority?: string[];
    assignedTo?: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const { startDate, endDate } = dateRange;
  
  let query = sql`
    SELECT 
      c.id,
      c.claim_number,
      c.claim_type,
      c.status,
      c.priority,
      c.created_at,
      c.resolved_at,
      om.first_name || ' ' || om.last_name AS member_name,
      s.first_name || ' ' || s.last_name AS steward_name,
      EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, NOW()) - c.created_at))/86400.0 AS age_days
    FROM claims c
    LEFT JOIN organization_members om ON om.id = c.member_id AND om.organization_id = c.organization_id
    LEFT JOIN organization_members s ON s.id = c.assigned_to AND s.organization_id = c.organization_id
    WHERE c.organization_id = ${organizationId}
      AND c.created_at BETWEEN ${startDate} AND ${endDate}
  `;

  if (filters?.status && filters.status.length > 0) {
    query = sql`${query} AND c.status = ANY(${filters.status})`;
  }

  if (filters?.claimType && filters.claimType.length > 0) {
    query = sql`${query} AND c.claim_type = ANY(${filters.claimType})`;
  }

  if (filters?.priority && filters.priority.length > 0) {
    query = sql`${query} AND c.priority = ANY(${filters.priority})`;
  }

  if (filters?.assignedTo) {
    query = sql`${query} AND c.assigned_to = ${filters.assignedTo}`;
  }

  query = sql`${query} ORDER BY c.created_at DESC`;

  return await db.execute(query);
}

// ============================================================================
// Member Analytics Queries
// ============================================================================

/**
 * Get comprehensive member analytics
 */
export async function getMemberAnalytics(
  organizationId: string,
  dateRange: DateRange
): Promise<MemberAnalytics> {
  const { _startDate, _endDate } = dateRange;

  // Get member counts
  const memberCounts = await db.execute(sql`
    SELECT 
      COUNT(*) AS total_members,
      COUNT(*) FILTER (WHERE status = 'active') AS active_members,
      COUNT(*) FILTER (WHERE created_at >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}) AS new_members_30_days
    FROM organization_members
    WHERE organization_id = ${organizationId}
  `);

  // Get retention rate from cohorts
  const retention = await db.execute(sql`
    SELECT AVG(retention_rate) AS avg_retention_rate
    FROM mv_member_cohorts
    WHERE organization_id = ${organizationId}
      AND cohort_month >= NOW() - INTERVAL '12 months'
  `);

  // Get engagement distribution
  const engagementDist = await db.execute(sql`
    SELECT 
      CASE 
        WHEN engagement_score >= 75 THEN 'high'
        WHEN engagement_score >= 50 THEN 'medium'
        WHEN engagement_score >= 25 THEN 'low'
        ELSE 'inactive'
      END AS engagement_level,
      COUNT(*) AS count
    FROM mv_member_engagement
    WHERE organization_id = ${organizationId}
    GROUP BY engagement_level
  `);

  // Get avg claims per member
  const avgClaims = await db.execute(sql`
    SELECT AVG(total_claims) AS avg_claims
    FROM mv_member_engagement
    WHERE organization_id = ${organizationId}
  `);

  // Get top members
  const topMembers = await db.execute(sql`
    SELECT 
      member_id AS id,
      first_name || ' ' || last_name AS name,
      total_claims AS claims_count,
      win_rate_percentage AS win_rate
    FROM mv_member_engagement
    WHERE organization_id = ${organizationId}
    ORDER BY total_claims DESC
    LIMIT 10
  `);

  // Get cohort analysis
  const cohortAnalysis = await db.execute(sql`
    SELECT 
      TO_CHAR(cohort_month, 'YYYY-MM') AS cohort_month,
      cohort_size AS size,
      retention_rate
    FROM mv_member_cohorts
    WHERE organization_id = ${organizationId}
      AND cohort_month >= NOW() - INTERVAL '12 months'
    ORDER BY cohort_month DESC
  `);

  return {
    totalMembers: Number(memberCounts[0]?.total_members || 0),
    activeMembers: Number(memberCounts[0]?.active_members || 0),
    newMembers30Days: Number(memberCounts[0]?.new_members_30_days || 0),
    retentionRate: Number(retention[0]?.avg_retention_rate || 0),
    avgClaimsPerMember: Number(avgClaims[0]?.avg_claims || 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    engagementDistribution: Object.fromEntries(engagementDist.map((r: any) => [r.engagement_level, Number(r.count)])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topMembers: topMembers.map((r: any) => ({
      id: r.id,
      name: r.name,
      claimsCount: Number(r.claims_count),
      winRate: Number(r.win_rate || 0),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cohortAnalysis: cohortAnalysis.map((r: any) => ({
      cohortMonth: r.cohort_month,
      size: Number(r.size),
      retentionRate: Number(r.retention_rate || 0),
    })),
  };
}

// ============================================================================
// Deadline Analytics Queries
// ============================================================================

/**
 * Get comprehensive deadline analytics
 */
export async function getDeadlineAnalytics(
  organizationId: string,
  dateRange: DateRange
): Promise<DeadlineAnalytics> {
  const { startDate, endDate } = dateRange;

  // Get deadline metrics
  const metrics = await db.execute(sql`
    SELECT 
      COUNT(*) AS total_deadlines,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
      AVG(days_overdue) FILTER (WHERE status = 'overdue') AS avg_days_overdue,
      COUNT(*) FILTER (WHERE status = 'overdue' AND days_overdue > 7) AS critical_overdue_count,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed' AND completed_at <= current_deadline) / 
            NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'overdue')), 0), 1) AS on_time_rate
    FROM claim_deadlines
    WHERE organization_id = ${organizationId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
  `);

  // Get extension approval rate
  const extensionMetrics = await db.execute(sql`
    SELECT 
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'approved') / NULLIF(COUNT(*), 0), 1) AS approval_rate
    FROM deadline_extensions de
    JOIN claim_deadlines cd ON cd.id = de.deadline_id
    WHERE cd.organization_id = ${organizationId}
      AND de.created_at BETWEEN ${startDate} AND ${endDate}
  `);

  // Get compliance trend
  const complianceTrend = await db.execute(sql`
    SELECT 
      TO_CHAR(report_date, 'YYYY-MM-DD') AS date,
      on_time_percentage AS on_time_rate,
      overdue_deadlines AS overdue_count
    FROM mv_deadline_compliance_daily
    WHERE organization_id = ${organizationId}
      AND report_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY report_date
  `);

  // Get deadlines by priority
  const priorityBreakdown = await db.execute(sql`
    SELECT priority, COUNT(*) AS count
    FROM claim_deadlines
    WHERE organization_id = ${organizationId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY priority
  `);

  return {
    totalDeadlines: Number(metrics[0]?.total_deadlines || 0),
    overdueCount: Number(metrics[0]?.overdue_count || 0),
    onTimeRate: Number(metrics[0]?.on_time_rate || 0),
    avgDaysOverdue: Number(metrics[0]?.avg_days_overdue || 0),
    criticalOverdueCount: Number(metrics[0]?.critical_overdue_count || 0),
    extensionApprovalRate: Number(extensionMetrics[0]?.approval_rate || 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    complianceTrend: complianceTrend.map((r: any) => ({
      date: r.date,
      onTimeRate: Number(r.on_time_rate || 0),
      overdueCount: Number(r.overdue_count || 0),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deadlinesByPriority: Object.fromEntries(priorityBreakdown.map((r: any) => [r.priority, Number(r.count)])),
  };
}

// ============================================================================
// Financial Analytics Queries
// ============================================================================

/**
 * Get comprehensive financial analytics
 */
export async function getFinancialAnalytics(
  organizationId: string,
  dateRange: DateRange
): Promise<FinancialAnalytics> {
  const { startDate, endDate } = dateRange;

  // Get financial metrics
  const metrics = await db.execute(sql`
    SELECT 
      SUM(COALESCE((metadata->>'claim_value')::numeric, 0)) AS total_claim_value,
      SUM(COALESCE((metadata->>'settlement_amount')::numeric, 0)) AS total_settlements,
      SUM(COALESCE((metadata->>'legal_costs')::numeric, 0)) AS total_legal_costs,
      AVG(COALESCE((metadata->>'claim_value')::numeric, 0)) AS avg_claim_value,
      AVG(COALESCE((metadata->>'settlement_amount')::numeric, 0)) FILTER (WHERE outcome = 'settled') AS avg_settlement,
      CASE 
        WHEN COUNT(*) > 0 
        THEN SUM(COALESCE((metadata->>'legal_costs')::numeric, 0)) / COUNT(*)
        ELSE 0 
      END AS cost_per_claim,
      CASE 
        WHEN SUM(COALESCE((metadata->>'claim_value')::numeric, 0)) > 0 
        THEN ROUND(100.0 * SUM(COALESCE((metadata->>'settlement_amount')::numeric, 0)) / 
             SUM(COALESCE((metadata->>'claim_value')::numeric, 0)), 1)
        ELSE 0 
      END AS recovery_rate
    FROM claims
    WHERE organization_id = ${organizationId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
  `);

  // Get financial trend
  const financialTrend = await db.execute(sql`
    SELECT 
      TO_CHAR(report_date, 'YYYY-MM-DD') AS date,
      total_claim_value AS claim_value,
      total_settlements AS settlements,
      total_legal_costs AS costs
    FROM mv_financial_summary_daily
    WHERE organization_id = ${organizationId}
      AND report_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY report_date
  `);

  // Get outcome distribution with values
  const outcomeDistribution = await db.execute(sql`
    SELECT 
      outcome,
      COUNT(*) AS count,
      SUM(COALESCE((metadata->>'claim_value')::numeric, 0)) AS value
    FROM claims
    WHERE organization_id = ${organizationId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
      AND outcome IS NOT NULL
    GROUP BY outcome
  `);

  return {
    totalClaimValue: Number(metrics[0]?.total_claim_value || 0),
    totalSettlements: Number(metrics[0]?.total_settlements || 0),
    totalLegalCosts: Number(metrics[0]?.total_legal_costs || 0),
    avgClaimValue: Number(metrics[0]?.avg_claim_value || 0),
    avgSettlement: Number(metrics[0]?.avg_settlement || 0),
    costPerClaim: Number(metrics[0]?.cost_per_claim || 0),
    recoveryRate: Number(metrics[0]?.recovery_rate || 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    financialTrend: financialTrend.map((r: any) => ({
      date: r.date,
      claimValue: Number(r.claim_value || 0),
      settlements: Number(r.settlements || 0),
      costs: Number(r.costs || 0),
    })),
    outcomeDistribution: Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outcomeDistribution.map((r: any) => [
        r.outcome,
        { count: Number(r.count), value: Number(r.value || 0) }
      ])
    ),
  };
}

// ============================================================================
// Activity Pattern Queries
// ============================================================================

/**
 * Get weekly activity heatmap data
 */
export async function getWeeklyActivityHeatmap(organizationId: string): Promise<HeatmapData[]> {
  const heatmapData = await db.execute(sql`
    SELECT 
      day_of_week,
      hour_of_day,
      activity_score,
      claim_count
    FROM mv_weekly_activity
    WHERE organization_id = ${organizationId}
    ORDER BY day_of_week, hour_of_day
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return heatmapData.map((r: any) => ({
    dayOfWeek: Number(r.day_of_week),
    hourOfDay: Number(r.hour_of_day),
    activityScore: Number(r.activity_score),
    claimCount: Number(r.claim_count),
  }));
}

// ============================================================================
// Report Management Queries
// ============================================================================

/**
 * Get all reports for an organization (Legacy version - replaced by enhanced getReports below)
 * Kept for backwards compatibility if needed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getReportsLegacy(organizationId: string, userId?: string): Promise<any[]> {
  let query = sql`
    SELECT 
      r.id,
      r.name,
      r.description,
      r.report_type,
      r.category,
      r.config,
      r.is_public,
      r.is_template,
      r.created_by,
      r.created_at,
      r.updated_at,
      r.last_run_at,
      r.run_count,
      om.first_name || ' ' || om.last_name AS created_by_name
    FROM reports r
    LEFT JOIN organization_members om ON om.id = r.created_by AND om.organization_id = r.organization_id
    WHERE r.organization_id = ${organizationId}
  `;

  if (userId) {
    query = sql`${query} AND (r.is_public = true OR r.created_by = ${userId})`;
  }

  query = sql`${query} ORDER BY r.updated_at DESC`;

  return await db.execute(query);
}

/**
 * Create a new report (Legacy version - replaced by enhanced createReport below)
 */
export async function createReportLegacy(
  organizationId: string,
  userId: string,
  reportData: {
    name: string;
    description?: string;
    reportType: string;
    category?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    isPublic?: boolean;
    isTemplate?: boolean;
    templateId?: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const result = await db.execute(sql`
    INSERT INTO reports (
      organization_id, name, description, report_type, category, config, 
      is_public, is_template, template_id, created_by
    ) VALUES (
      ${organizationId}, ${reportData.name}, ${reportData.description || null},
      ${reportData.reportType}, ${reportData.category || null}, ${JSON.stringify(reportData.config)},
      ${reportData.isPublic || false}, ${reportData.isTemplate || false},
      ${reportData.templateId || null}, ${userId}
    )
    RETURNING *
  `);

  return result[0];
}

/**
 * Update report run statistics
 */
export async function updateReportRunStats(reportId: string): Promise<void> {
  await db.execute(sql`
    UPDATE reports
    SET last_run_at = NOW(),
        run_count = run_count + 1
    WHERE id = ${reportId}
  `);
}

// ============================================================================
// Export Job Management
// ============================================================================

/**
 * Create export job
 */
export async function createExportJob(
  organizationId: string,
  userId: string,
  exportData: {
    reportId?: string;
    scheduleId?: string;
    exportType: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const result = await db.execute(sql`
    INSERT INTO export_jobs (organization_id, report_id, schedule_id, export_type, created_by)
    VALUES (${organizationId}, ${exportData.reportId || null}, ${exportData.scheduleId || null}, 
            ${exportData.exportType}, ${userId})
    RETURNING *
  `);

  return result[0];
}

/**
 * Update export job status
 */
export async function updateExportJobStatus(
  jobId: string,
  status: string,
  fileUrl?: string,
  errorMessage?: string
): Promise<void> {
  const now = new Date();
  
  if (status === 'processing') {
    await db.execute(sql`
      UPDATE export_jobs
      SET status = ${status},
          processing_started_at = ${now}
      WHERE id = ${jobId}
    `);
  } else if (status === 'completed') {
    await db.execute(sql`
      UPDATE export_jobs
      SET status = ${status},
          file_url = ${fileUrl},
          processing_completed_at = ${now},
          processing_duration_ms = EXTRACT(EPOCH FROM (${now} - processing_started_at)) * 1000
      WHERE id = ${jobId}
    `);
  } else if (status === 'failed') {
    await db.execute(sql`
      UPDATE export_jobs
      SET status = ${status},
          error_message = ${errorMessage},
          processing_completed_at = ${now}
      WHERE id = ${jobId}
    `);
  }
}

/**
 * Get export job by ID
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getExportJob(jobId: string): Promise<any> {
  const result = await db.execute(sql`
    SELECT * FROM export_jobs WHERE id = ${jobId}
  `);
  return result[0];
}

/**
 * Get user's export jobs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserExportJobs(organizationId: string, userId: string): Promise<any[]> {
  return await db.execute(sql`
    SELECT 
      ej.*,
      r.name AS report_name
    FROM export_jobs ej
    LEFT JOIN reports r ON r.id = ej.report_id
    WHERE ej.organization_id = ${organizationId}
      AND ej.created_by = ${userId}
    ORDER BY ej.created_at DESC
    LIMIT 50
  `);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Refresh all analytics materialized views
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function refreshAnalyticsViews(): Promise<any[]> {
  return await db.execute(sql`SELECT * FROM refresh_analytics_views()`);
}

/**
 * Get last refresh time for materialized views
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getViewRefreshStats(): Promise<any[]> {
  return await db.execute(sql`
    SELECT 
      schemaname,
      matviewname,
      last_refresh
    FROM pg_matviews
    WHERE schemaname = 'public'
      AND matviewname LIKE 'mv_%'
    ORDER BY last_refresh DESC NULLS LAST
  `);
}

// ============================================================================
// Reports Management Queries (Phase 2)
// ============================================================================

/**
 * Get all reports for an organization
 */
export async function getReports(
  organizationId: string,
  userId: string,
  filters?: {
    category?: string;
    isTemplate?: boolean;
    isPublic?: boolean;
    search?: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [sql`r.tenant_id = ${organizationId}`];

  // Add filters
  if (filters?.category) {
    conditions.push(sql`r.category = ${filters.category}`);
  }
  if (filters?.isTemplate !== undefined) {
    conditions.push(sql`r.is_template = ${filters.isTemplate}`);
  }
  if (filters?.isPublic !== undefined) {
    conditions.push(sql`r.is_public = ${filters.isPublic}`);
  }
  if (filters?.search) {
    conditions.push(sql`(r.name ILIKE ${'%' + filters.search + '%'} OR r.description ILIKE ${'%' + filters.search + '%'})`);
  }

  // Include reports created by user or shared with them
  conditions.push(sql`(r.created_by = ${userId} OR r.is_public = true OR EXISTS (
    SELECT 1 FROM report_shares rs 
    WHERE rs.report_id = r.id AND rs.shared_with = ${userId}
  ))`);

  const whereClause = sql.join(conditions, sql` AND `);

  const reports = await db.execute(sql`
    SELECT 
      r.*,
      COUNT(re.id) as execution_count,
      MAX(re.executed_at) as last_executed_at
    FROM reports r
    LEFT JOIN report_executions re ON re.report_id = r.id
    WHERE ${whereClause}
    GROUP BY r.id
    ORDER BY r.updated_at DESC
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return reports as any[];
}

/**
 * Get single report by ID
 */
export async function getReportById(
  reportId: string,
  organizationId: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const reports = await db.execute(sql`
    SELECT r.*
    FROM reports r
    WHERE r.id = ${reportId} AND r.tenant_id = ${organizationId}
  `);

  return reports[0] || null;
}

/**
 * Create new report
 */
export async function createReport(
  organizationId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    reportType: string;
    category?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    isPublic?: boolean;
    isTemplate?: boolean;
    templateId?: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const result = await db.execute(sql`
    INSERT INTO reports (
      tenant_id, name, description, report_type, category, config,
      is_public, is_template, template_id, created_by, updated_by
    ) VALUES (
      ${organizationId}, ${data.name}, ${data.description || null}, ${data.reportType},
      ${data.category || null}, ${JSON.stringify(data.config)}, ${data.isPublic || false},
      ${data.isTemplate || false}, ${data.templateId || null}, ${userId}, ${userId}
    )
    RETURNING *
  `);

  return result[0];
}

/**
 * Update existing report
 */
export async function updateReport(
  reportId: string,
  organizationId: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config?: any;
    isPublic?: boolean;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const setClauses: SQL[] = [];

  // Build SET clauses using safe column names and parameterized values
  if (data.name !== undefined) {
    setClauses.push(sql`${safeColumnName('name')} = ${data.name}`);
  }
  if (data.description !== undefined) {
    setClauses.push(sql`${safeColumnName('description')} = ${data.description}`);
  }
  if (data.config !== undefined) {
    setClauses.push(sql`${safeColumnName('config')} = ${JSON.stringify(data.config)}`);
  }
  if (data.isPublic !== undefined) {
    setClauses.push(sql`${safeColumnName('is_public')} = ${data.isPublic}`);
  }

  // Always update updated_by and updated_at
  setClauses.push(sql`${safeColumnName('updated_by')} = ${userId}`);
  setClauses.push(sql`${safeColumnName('updated_at')} = NOW()`);

  // Join SET clauses with commas
  const setClause = sql.join(setClauses, sql`, `);

  const result = await db.execute(sql`
    UPDATE reports
    SET ${setClause}
    WHERE id = ${reportId} AND tenant_id = ${organizationId}
    RETURNING *
  `);

  return result[0];
}

/**
 * Delete report
 */
export async function deleteReport(
  reportId: string,
  organizationId: string
): Promise<boolean> {
  await db.execute(sql`
    DELETE FROM reports
    WHERE id = ${reportId} AND tenant_id = ${organizationId}
  `);

  return true;
}

/**
 * Log report execution
 */
export async function logReportExecution(
  reportId: string,
  organizationId: string,
  userId: string,
  data: {
    format: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parameters?: any;
    resultCount?: number;
    executionTimeMs: number;
    fileUrl?: string;
    fileSize?: number;
    status: string;
    errorMessage?: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const result = await db.execute(sql`
    INSERT INTO report_executions (
      report_id, tenant_id, executed_by, format, parameters,
      result_count, execution_time_ms, file_url, file_size,
      status, error_message
    ) VALUES (
      ${reportId}, ${organizationId}, ${userId}, ${data.format},
      ${data.parameters ? JSON.stringify(data.parameters) : null},
      ${data.resultCount?.toString() || null}, ${data.executionTimeMs.toString()},
      ${data.fileUrl || null}, ${data.fileSize?.toString() || null},
      ${data.status}, ${data.errorMessage || null}
    )
    RETURNING *
  `);

  // Update report's last_run_at and run_count
  await db.execute(sql`
    UPDATE reports
    SET last_run_at = NOW(), run_count = run_count + 1
    WHERE id = ${reportId}
  `);

  return result[0];
}

/**
 * Get report execution history
 */
export async function getReportExecutions(
  reportId: string,
  organizationId: string,
  limit: number = 50
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const executions = await db.execute(sql`
    SELECT re.*, u.email as executed_by_email
    FROM report_executions re
    LEFT JOIN users u ON u.id = re.executed_by
    WHERE re.report_id = ${reportId} AND re.tenant_id = ${organizationId}
    ORDER BY re.executed_at DESC
    LIMIT ${limit}
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return executions as any[];
}

/**
 * Get report templates
 */
export async function getReportTemplates(
  organizationId?: string,
  category?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [sql`rt.is_active = true`];

  // Include system templates and tenant-specific templates
  if (organizationId) {
    conditions.push(sql`(rt.tenant_id IS NULL OR rt.tenant_id = ${organizationId})`);
  } else {
    conditions.push(sql`rt.tenant_id IS NULL`);
  }

  if (category) {
    conditions.push(sql`rt.category = ${category}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const templates = await db.execute(sql`
    SELECT rt.*
    FROM report_templates rt
    WHERE ${whereClause}
    ORDER BY rt.name ASC
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return templates as any[];
}

/**
 * Create report from template
 */
export async function createReportFromTemplate(
  templateId: string,
  organizationId: string,
  userId: string,
  name: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // Get template
  const template = await db.execute(sql`
    SELECT * FROM report_templates WHERE id = ${templateId}
  `);

  if (template.length === 0) {
    throw new Error('Template not found');
  }

  const templateData = template[0];

  // Create report from template
  return await createReport(organizationId, userId, {
    name,
    description: typeof templateData.description === 'string' ? templateData.description : undefined,
    reportType: 'template',
    category: typeof templateData.category === 'string' ? templateData.category : undefined,
    config: templateData.config,
    isPublic: false,
    isTemplate: false,
    templateId: templateId,
  });
}

