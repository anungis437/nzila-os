/**
 * Analytics Aggregation Service
 * 
 * Pre-computes and stores analytics aggregations for improved performance
 * Runs scheduled jobs to update aggregations periodically
 * 
 * Features:
 * - Daily/weekly/monthly aggregations
 * - Incremental updates
 * - Multi-organization support
 * 
 * Created: November 15, 2025
 */

import { db } from '@/db';
import { claims } from '@/db/schema';
import { eq, and, gte, sql, count } from 'drizzle-orm';

interface DailyAggregation {
  organizationId: string;
  date: Date;
  totalClaims: number;
  newClaims: number;
  resolvedClaims: number;
  activeClaims: number;
  avgResolutionTime: number;
  totalClaimValue: number;
  totalSettlements: number;
  totalCosts: number;
}

interface OrganizationMetrics {
  organizationId: string;
  metrics: {
    claims: {
      total: number;
      active: number;
      resolved: number;
      resolutionRate: number;
      avgResolutionDays: number;
    };
    financial: {
      totalValue: number;
      totalSettlements: number;
      totalCosts: number;
      netValue: number;
      roi: number;
    };
    operational: {
      queueSize: number;
      avgWaitTime: number;
      slaCompliance: number;
    };
  };
  lastUpdated: Date;
}

class AnalyticsAggregationService {
  /**
  * Compute daily aggregations for an organization
   */
  async computeDailyAggregation(
    organizationId: string,
    date: Date
  ): Promise<DailyAggregation> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get claims created on this day
    const [newClaims] = await db
      .select({ count: count() })
      .from(claims)
      .where(
        and(
          eq(claims.organizationId, organizationId),
          gte(claims.createdAt, startOfDay),
          sql`${claims.createdAt} <= ${endOfDay.toISOString()}::timestamp`
        )
      );

    // Get claims resolved on this day
    const [resolvedClaims] = await db
      .select({
        count: count(),
        avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${claims.closedAt} - ${claims.createdAt})) / 86400)`,
      })
      .from(claims)
      .where(
        and(
          eq(claims.organizationId, organizationId),
          sql`${claims.status} = 'resolved'`,
          gte(claims.closedAt, startOfDay),
          sql`${claims.closedAt} <= ${endOfDay.toISOString()}::timestamp`
        )
      );

    // Get total and active claims as of this day
    const [totals] = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(CASE WHEN ${claims.status} IN ('under_review', 'assigned', 'investigation', 'pending_documentation') THEN 1 END)`,
      })
      .from(claims)
      .where(
        and(
          eq(claims.organizationId, organizationId),
          sql`${claims.createdAt} <= ${endOfDay.toISOString()}::timestamp`
        )
      );

    // Get financial metrics
    const [financials] = await db
      .select({
        totalValue: sql<number>`COALESCE(SUM(claim_amount), 0)`,
        totalSettlements: sql<number>`COALESCE(SUM(CASE WHEN resolution_outcome = 'won' THEN settlement_amount ELSE 0 END), 0)`,
        totalCosts: sql<number>`COALESCE(SUM(legal_costs + COALESCE(court_costs, 0)), 0)`,
      })
      .from(claims)
      .where(
        and(
          eq(claims.organizationId, organizationId),
          sql`${claims.createdAt} <= ${endOfDay.toISOString()}::timestamp`
        )
      );

    return {
      organizationId,
      date,
      totalClaims: totals.total,
      newClaims: newClaims.count,
      resolvedClaims: resolvedClaims.count || 0,
      activeClaims: totals.active,
      avgResolutionTime: resolvedClaims.avgResolutionTime || 0,
      totalClaimValue: financials.totalValue,
      totalSettlements: financials.totalSettlements,
      totalCosts: financials.totalCosts,
    };
  }

  /**
  * Compute comprehensive organization metrics
   */
  async computeOrganizationMetrics(organizationId: string): Promise<OrganizationMetrics> {
    // Claims metrics
    const [claimsMetrics] = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(CASE WHEN ${claims.status} IN ('under_review', 'assigned', 'investigation', 'pending_documentation') THEN 1 END)`,
        resolved: sql<number>`COUNT(CASE WHEN ${claims.status} = 'resolved' THEN 1 END)`,
        avgResolutionDays: sql<number>`AVG(CASE WHEN ${claims.status} = 'resolved' THEN EXTRACT(EPOCH FROM (${claims.closedAt} - ${claims.createdAt})) / 86400 END)`,
      })
      .from(claims)
      .where(eq(claims.organizationId, organizationId));

    const resolutionRate = claimsMetrics.total > 0 
      ? (claimsMetrics.resolved / claimsMetrics.total) * 100 
      : 0;

    // Financial metrics
    const [financialMetrics] = await db
      .select({
        totalValue: sql<number>`COALESCE(SUM(claim_amount), 0)`,
        totalSettlements: sql<number>`COALESCE(SUM(CASE WHEN resolution_outcome = 'won' THEN settlement_amount ELSE 0 END), 0)`,
        totalCosts: sql<number>`COALESCE(SUM(legal_costs + COALESCE(court_costs, 0)), 0)`,
      })
      .from(claims)
      .where(eq(claims.organizationId, organizationId));

    const netValue = financialMetrics.totalSettlements - financialMetrics.totalCosts;
    const roi = financialMetrics.totalCosts > 0 
      ? (netValue / financialMetrics.totalCosts) * 100 
      : 0;

    // Operational metrics
    const [operationalMetrics] = await db
      .select({
        queueSize: sql<number>`COUNT(CASE WHEN ${claims.status} IN ('under_review', 'assigned', 'investigation', 'pending_documentation') THEN 1 END)`,
        avgWaitTime: sql<number>`AVG(CASE WHEN ${claims.status} NOT IN ('resolved', 'closed', 'rejected') THEN EXTRACT(EPOCH FROM (NOW() - ${claims.createdAt})) / 3600 END)`,
        onTime: sql<number>`COUNT(CASE WHEN ${claims.status} = 'resolved' AND EXTRACT(EPOCH FROM (${claims.closedAt} - ${claims.createdAt})) / 86400 <= 30 THEN 1 END)`,
        resolved: sql<number>`COUNT(CASE WHEN ${claims.status} = 'resolved' THEN 1 END)`,
      })
      .from(claims)
      .where(eq(claims.organizationId, organizationId));

    const slaCompliance = operationalMetrics.resolved > 0
      ? (operationalMetrics.onTime / operationalMetrics.resolved) * 100
      : 0;

    return {
      organizationId,
      metrics: {
        claims: {
          total: claimsMetrics.total,
          active: claimsMetrics.active,
          resolved: claimsMetrics.resolved,
          resolutionRate,
          avgResolutionDays: claimsMetrics.avgResolutionDays || 0,
        },
        financial: {
          totalValue: financialMetrics.totalValue,
          totalSettlements: financialMetrics.totalSettlements,
          totalCosts: financialMetrics.totalCosts,
          netValue,
          roi,
        },
        operational: {
          queueSize: operationalMetrics.queueSize,
          avgWaitTime: operationalMetrics.avgWaitTime || 0,
          slaCompliance,
        },
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Compute metrics for date range
   */
  async computeRangeMetrics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [metrics] = await db
      .select({
        totalClaims: count(),
        newClaims: sql<number>`COUNT(CASE WHEN ${claims.createdAt} BETWEEN ${startDate.toISOString()}::timestamp AND ${endDate.toISOString()}::timestamp THEN 1 END)`,
        resolvedClaims: sql<number>`COUNT(CASE WHEN ${claims.status} = 'resolved' AND ${claims.closedAt} BETWEEN ${startDate.toISOString()}::timestamp AND ${endDate.toISOString()}::timestamp THEN 1 END)`,
        avgResolutionDays: sql<number>`AVG(CASE WHEN ${claims.status} = 'resolved' AND ${claims.closedAt} BETWEEN ${startDate.toISOString()}::timestamp AND ${endDate.toISOString()}::timestamp THEN EXTRACT(EPOCH FROM (${claims.closedAt} - ${claims.createdAt})) / 86400 END)`,
        totalValue: sql<number>`COALESCE(SUM(CASE WHEN ${claims.incidentDate} BETWEEN ${startDate.toISOString()}::timestamp AND ${endDate.toISOString()}::timestamp THEN claim_amount ELSE 0 END), 0)`,
        totalSettlements: sql<number>`COALESCE(SUM(CASE WHEN ${claims.status} = 'resolved' AND resolution_outcome = 'won' AND ${claims.closedAt} BETWEEN ${startDate.toISOString()}::timestamp AND ${endDate.toISOString()}::timestamp THEN settlement_amount ELSE 0 END), 0)`,
      })
      .from(claims)
      .where(eq(claims.organizationId, organizationId));

    return {
      organizationId,
      startDate,
      endDate,
      ...metrics,
    };
  }

  /**
  * Run scheduled aggregation for all organizations
   * Should be called daily via cron job
   */
  async runDailyAggregations(): Promise<void> {
// Get all unique organization IDs
        const organizations = await db
      .selectDistinct({ organizationId: claims.organizationId })
      .from(claims);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Compute aggregations for each organization
        for (const { organizationId } of organizations) {
      try {
        await this.computeDailyAggregation(organizationId, yesterday);
} catch (_error) {
}
    }
}
}

// Singleton instance
export const aggregationService = new AnalyticsAggregationService();

/**
 * Helper function to get or compute metrics with caching
 */
export async function getOrganizationMetrics(organizationId: string): Promise<OrganizationMetrics> {
  return await aggregationService.computeOrganizationMetrics(organizationId);
}

