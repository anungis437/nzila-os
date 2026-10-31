'use server';

/**
 * Analytics Server Actions
 * Q1 2025 - Advanced Analytics
 * 
 * Server-side actions for analytics operations
 */

import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import {
  analyticsMetrics,
  kpiConfigurations,
  mlPredictions,
  trendAnalyses,
} from '@/db/schema';
import {
  forecastLinearRegression,
  generateEnsembleForecast,
  detectTrend,
  type TimeSeriesData,
  type PredictionResult,
  type TrendAnalysisResult,
} from '@/lib/ml/predictive-analytics';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { auth } from '@nzila/platform-auth/entra/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * Get current user's organization ID
 *
 * IMPORTANT: does NOT trust auth()'s `orgId` — for Entra-backed sessions
 * that value is the Azure AD security-group GUID (activeOrgId), not the
 * app-level organizations.id UUID. Using it directly here previously meant
 * analytics queries could be scoped to a value that never matches the
 * user's real organization membership (queries silently returning nothing),
 * or — if an AD group GUID happens to collide with an unrelated org's UUID —
 * scoping the RLS context to an organization the user never verified
 * membership in. getOrganizationIdForUser() always resolves via a verified
 * organization_members row.
 */
/**
 * A caller that already resolved an organization (an API route behind its role guard) names it as expectedOrganizationId: the
 * action resolves independently, and a disagreement (a user with more than one membership whose selection changed between
 * the two resolutions) refuses the call instead of writing to a different organization than the one the caller was authorized in.
 */
function assertSameOrganization(resolved: string, expected: string | undefined): string {
  if (expected && expected !== resolved) throw new Error('Organization context changed during the request');
  return resolved;
}

async function getCurrentUserOrgId(expectedOrganizationId?: string): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  return assertSameOrganization(await getOrganizationIdForUser(userId), expectedOrganizationId);
}

/** The acting user and the organization verified for them; every write is audited to this pair. */
async function getActor(expectedOrganizationId?: string): Promise<{ userId: string; orgId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  return { userId, orgId: assertSameOrganization(await getOrganizationIdForUser(userId), expectedOrganizationId) };
}

/**
 * Calculate and store metrics for a given period
 */
export async function calculateMetrics(params: {
  metricType: string;
  metricName: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  periodStart: Date;
  periodEnd: Date;
  expectedOrganizationId?: string;
}) {
  try {
    const { userId, orgId } = await getActor(params.expectedOrganizationId);
    
    // Calculate metric value based on type
    let metricValue: number;
    let metricUnit: string;
    let metadata: Record<string, unknown> = {};
    
    switch (params.metricType) {
      case 'claims_volume':
        const claimsCount = await withRLSContext({ organizationId: orgId }, async (db) => 
          db.query.claims.findMany({
            where: (claims, { eq, and, gte, lte }) => and(
              eq(claims.organizationId, orgId),
              gte(claims.createdAt, params.periodStart),
              lte(claims.createdAt, params.periodEnd)
            )
          })
        );
        metricValue = claimsCount.length;
        metricUnit = 'count';
        metadata = { claimsCount: claimsCount.length };
        break;
        
      case 'resolution_time':
        const resolvedClaims = await withRLSContext({ organizationId: orgId }, async (db) =>
          db.query.claims.findMany({
            where: (claims, { eq, and, gte, lte, isNotNull }) => and(
              eq(claims.organizationId, orgId),
              gte(claims.updatedAt, params.periodStart),
              lte(claims.updatedAt, params.periodEnd),
              isNotNull(claims.resolvedAt)
            )
          })
        );
        
        if (resolvedClaims.length === 0) {
          metricValue = 0;
        } else {
          const totalDays = resolvedClaims.reduce((sum, claim) => {
            const days = (claim.resolvedAt!.getTime() - (claim.createdAt?.getTime() || claim.resolvedAt!.getTime())) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0);
          metricValue = totalDays / resolvedClaims.length;
        }
        metricUnit = 'days';
        metadata = { claimsResolved: resolvedClaims.length };
        break;
        
      case 'member_growth':
        // SECURITY FIX: Wrap with RLS context for org isolation
        const membersCount = await withRLSContext({ organizationId: orgId }, async (db) =>
          db.query.organizationMembers.findMany({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            where: (members: any, { eq, and, gte, lte }: any) => and(
              eq(members.organizationId, orgId),
              gte(members.createdAt, params.periodStart),
              lte(members.createdAt, params.periodEnd)
            )
          })
        );
        metricValue = membersCount.length;
        metricUnit = 'count';
        break;
        
      default:
        throw new Error(`Unsupported metric type: ${params.metricType}`);
    }
    
    // Get comparison value from previous period
    const periodDuration = params.periodEnd.getTime() - params.periodStart.getTime();
    const previousPeriodEnd = new Date(params.periodStart);
    const previousPeriodStart = new Date(params.periodStart.getTime() - periodDuration);
    
    // SECURITY FIX: Wrap with RLS context for org isolation
    const previousMetric = await withRLSContext({ organizationId: orgId }, async (db) =>
      db.query.analyticsMetrics.findFirst({
        where: (metrics, { and, eq, gte, lte }) => and(
          eq(metrics.organizationId, orgId),
          eq(metrics.metricType, params.metricType),
          eq(metrics.periodType, params.periodType),
          gte(metrics.periodStart, previousPeriodStart),
          lte(metrics.periodEnd, previousPeriodEnd)
        )
      })
    );
    
    const comparisonValue = previousMetric?.metricValue ? Number(previousMetric.metricValue) : null;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    
    if (comparisonValue) {
      const change = ((metricValue - comparisonValue) / comparisonValue) * 100;
      if (change > 5) trend = 'up';
      else if (change < -5) trend = 'down';
    }
    
    // Store metric with RLS context
    const [metric] = await withRLSContext({ organizationId: orgId }, async (db) => {
      const stored = await db.insert(analyticsMetrics).values({
        organizationId: orgId,
        metricType: params.metricType,
        metricName: params.metricName,
        metricValue: metricValue.toString(),
        metricUnit,
        periodType: params.periodType,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        metadata,
        comparisonValue: comparisonValue?.toString(),
        trend
      }).returning();
      await persistAtomicAudit(db, {
        organizationId: orgId,
        userId,
        action: 'analytics.metric.calculate',
        resourceType: 'analytics_metrics',
        resourceId: stored[0].id,
        details: { metricType: params.metricType, metricName: params.metricName, periodType: params.periodType },
      });
      return stored;
    });
    
    revalidatePath('/dashboard/analytics');
    
    return { success: true, metric };
  } catch (error) {
    logger.error('Error calculating metrics', error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Generate predictions for future periods
 */
export async function generatePredictions(params: {
  predictionType: 'claims_volume' | 'resource_needs' | 'budget_forecast';
  periodsAhead: number;
  modelName?: 'linear_regression' | 'moving_average' | 'ensemble';
}) {
  try {
    const { userId, orgId } = await getActor();
    
    // Get historical data based on prediction type with RLS context
    const historicalMetrics = await withRLSContext({ organizationId: orgId }, async (db) =>
      db.query.analyticsMetrics.findMany({
        where: (metrics, { and, eq }) => and(
          eq(metrics.organizationId, orgId),
          eq(metrics.metricType, params.predictionType === 'claims_volume' ? 'claims_volume' : 'custom')
        ),
        orderBy: (metrics, { desc }) => [desc(metrics.periodStart)],
        limit: 90 // Last 90 periods
      })
    );
    
    if (historicalMetrics.length < 7) {
      return { success: false, error: 'Insufficient historical data for predictions (minimum 7 data points required)' };
    }
    
    // Convert to time series format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeSeriesData: TimeSeriesData[] = historicalMetrics.reverse().map((m: any) => ({
      date: m.periodStart,
      value: Number(m.metricValue),
      metadata: m.metadata as Record<string, unknown>
    }));
    
    // Generate predictions
    let predictions: PredictionResult[];
    const modelName = params.modelName || 'ensemble';
    
    if (modelName === 'ensemble') {
      predictions = generateEnsembleForecast(timeSeriesData, params.periodsAhead);
    } else if (modelName === 'linear_regression') {
      predictions = forecastLinearRegression(timeSeriesData, params.periodsAhead);
    } else {
      return { success: false, error: 'Unsupported model' };
    }
    
    // Store predictions in database
    const lastDate = timeSeriesData[timeSeriesData.length - 1].date;

    // Every prediction and their audit record commit together
    const storedPredictions = await withRLSContext({ organizationId: orgId }, async (db) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        const targetDate = new Date(lastDate);
        targetDate.setDate(targetDate.getDate() + i + 1);

        const [stored] = await db.insert(mlPredictions).values({
          organizationId: orgId,
          predictionType: params.predictionType,
          predictionDate: targetDate,
          predictedValue: pred.predictedValue.toString(),
          lowerBound: pred.confidenceInterval.lower.toString(),
          upperBound: pred.confidenceInterval.upper.toString(),
          confidence: pred.confidenceScore.toString(),
        }).returning();

        rows.push(stored);
      }
      await persistAtomicAudit(db, {
        organizationId: orgId,
        userId,
        action: 'analytics.predictions.generate',
        resourceType: 'ml_predictions',
        details: { predictionType: params.predictionType, count: rows.length, model: modelName },
      });
      return rows;
    });
    
    revalidatePath('/dashboard/analytics');
    
    return { success: true, predictions: storedPredictions };
  } catch (error) {
    logger.error('Error generating predictions', error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Detect trends in metrics
 */
export async function detectMetricTrends(params: {
  metricType: string;
  daysBack?: number;
}) {
  try {
    const { userId, orgId } = await getActor();
    const daysBack = params.daysBack || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    // Get historical metrics with RLS context
    const metrics = await withRLSContext({ organizationId: orgId }, async (db) =>
      db.query.analyticsMetrics.findMany({
        where: (metricsTable, { and, eq, gte }) => and(
          eq(metricsTable.organizationId, orgId),
          eq(metricsTable.metricType, params.metricType),
          gte(metricsTable.periodStart, startDate)
        ),
        orderBy: (metricsTable, { desc }) => [desc(metricsTable.periodStart)]
      })
    );
    
    if (metrics.length < 7) {
      return { success: false, error: 'Insufficient data for trend analysis (minimum 7 data points required)' };
    }
    
    // Convert to time series
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeSeriesData: TimeSeriesData[] = metrics.reverse().map((m: any) => ({
      date: m.periodStart,
      value: Number(m.metricValue)
    }));
    
    // Detect trends
    const trendResult = detectTrend(timeSeriesData);
    
    // Store trend analysis with RLS context
    const [storedTrend] = await withRLSContext({ organizationId: orgId }, async (db) => {
      const stored = await db.insert(trendAnalyses).values({
        organizationId: orgId,
        analysisType: 'trend',
        dataSource: params.metricType,
        timeRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString()
        },
        detectedTrend: trendResult.detectedTrend,
        trendStrength: trendResult.trendStrength.toString(),
        anomaliesDetected: trendResult.anomalies,
        anomalyCount: trendResult.anomalies.length,
        seasonalPattern: trendResult.seasonalPattern,
        correlations: trendResult.correlations,
        insights: generateTrendInsights(trendResult),
        recommendations: generateTrendRecommendations(trendResult),
        confidence: trendResult.confidence.toString()
      }).returning();
      await persistAtomicAudit(db, {
        organizationId: orgId,
        userId,
        action: 'analytics.trend.detect',
        resourceType: 'trend_analyses',
        resourceId: stored[0].id,
        details: { metricType: params.metricType, daysBack },
      });
      return stored;
    });
    
    revalidatePath('/dashboard/analytics');
    
    return { success: true, trend: storedTrend };
  } catch (error) {
    logger.error('Error detecting trends', error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create custom KPI configuration
 */
export async function createKPI(params: {
  name: string;
  description?: string;
  metricType: string;
  dataSource: string;
  calculation: Record<string, unknown>;
  visualizationType: 'line' | 'bar' | 'pie' | 'gauge' | 'number';
  targetValue?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  alertEnabled?: boolean;
  alertRecipients?: string[];
}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');
    
    const orgId = await getCurrentUserOrgId();
    
    const [kpi] = await withRLSContext({ organizationId: orgId }, async (db) => {
      const stored = await db.insert(kpiConfigurations).values({
        organizationId: orgId,
        createdBy: userId,
        name: params.name,
        description: params.description,
        metricType: params.metricType,
        dataSource: params.dataSource,
        calculation: params.calculation,
        visualizationType: params.visualizationType,
        targetValue: params.targetValue?.toString(),
        warningThreshold: params.warningThreshold?.toString(),
        criticalThreshold: params.criticalThreshold?.toString(),
        alertEnabled: params.alertEnabled || false,
        alertRecipients: params.alertRecipients || []
      }).returning();
      await persistAtomicAudit(db, {
        organizationId: orgId,
        userId,
        action: 'analytics.kpi.create',
        resourceType: 'kpi_configurations',
        resourceId: stored[0].id,
        details: { name: params.name, metricType: params.metricType, alertEnabled: params.alertEnabled || false },
      });
      return stored;
    });
    
    revalidatePath('/dashboard/analytics/kpis');
    
    return { success: true, kpi };
  } catch (error) {
    logger.error('Error creating KPI', error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get analytics metrics for dashboard
 */
export async function getAnalyticsMetrics(params: {
  metricType?: string;
  periodType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  expectedOrganizationId?: string;
}) {
  try {
    const orgId = await getCurrentUserOrgId(params.expectedOrganizationId);
    
    const metrics = await withRLSContext({ organizationId: orgId }, async (db) => {
      const conditions = [eq(analyticsMetrics.organizationId, orgId)];
      
      if (params.metricType) {
        conditions.push(eq(analyticsMetrics.metricType, params.metricType));
      }
      
      if (params.periodType) {
        conditions.push(eq(analyticsMetrics.periodType, params.periodType));
      }
      
      if (params.startDate) {
        conditions.push(gte(analyticsMetrics.periodStart, params.startDate));
      }
      
      if (params.endDate) {
        conditions.push(lte(analyticsMetrics.periodEnd, params.endDate));
      }
      
      return db.query.analyticsMetrics.findMany({
        where: and(...conditions),
        orderBy: [desc(analyticsMetrics.periodStart)],
        limit: params.limit || 50
      });
    });
    
    // A member may read aggregate metric values, never underlying claim IDs
    // or arbitrary metadata left by historical versions of the calculator.
    // Explicit allowlisting also protects records created before the redaction migration.
    const publicMetrics = metrics.map((metric) => {
      const raw = metric.metadata && typeof metric.metadata === 'object' && !Array.isArray(metric.metadata)
        ? metric.metadata as Record<string, unknown>
        : {};
      let metadata: Record<string, number | null> = {};
      if (metric.metricType === 'claims_volume') {
        const claimsCount = Number(metric.metricValue);
        metadata = { claimsCount: Number.isFinite(claimsCount) ? claimsCount : null };
      } else if (metric.metricType === 'resolution_time' && raw.claimsResolved != null) {
        const claimsResolved = Number(raw.claimsResolved);
        if (Number.isFinite(claimsResolved) && claimsResolved >= 0) {
          metadata = { claimsResolved };
        }
      }
      return { ...metric, metadata };
    });
    return { success: true, metrics: publicMetrics };
  } catch (error) {
    logger.error('Error fetching analytics metrics', error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper functions
function generateTrendInsights(trend: TrendAnalysisResult): string {
  const insights: string[] = [];
  
  insights.push(`The data shows a ${trend.detectedTrend} trend with ${(trend.trendStrength * 100).toFixed(1)}% confidence.`);
  
  if (trend.anomalies.length > 0) {
    insights.push(`Detected ${trend.anomalies.length} anomalies in the data.`);
    
    const criticalAnomalies = trend.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
    if (criticalAnomalies.length > 0) {
      insights.push(`${criticalAnomalies.length} of these anomalies are critical or high severity.`);
    }
  }
  
  if (trend.seasonalPattern) {
    insights.push(`A seasonal pattern with a ${trend.seasonalPattern.period}-day cycle was detected (strength: ${(trend.seasonalPattern.strength * 100).toFixed(1)}%).`);
  }
  
  return insights.join(' ');
}

interface TrendRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

function generateTrendRecommendations(trend: TrendAnalysisResult): TrendRecommendation[] {
  const recommendations: TrendRecommendation[] = [];
  
  if (trend.detectedTrend === 'increasing' && trend.trendStrength > 0.7) {
    recommendations.push({
      action: 'monitor_capacity',
      priority: 'high',
      description: 'The strong upward trend suggests increased demand. Consider planning for additional capacity or resources.'
    });
  }
  
  if (trend.anomalies.length > 5) {
    recommendations.push({
      action: 'investigate_anomalies',
      priority: 'medium',
      description: 'Multiple anomalies detected. Investigate potential data quality issues or unusual events.'
    });
  }
  
  if (trend.seasonalPattern && trend.seasonalPattern.strength > 0.6) {
    recommendations.push({
      action: 'plan_for_seasonality',
      priority: 'medium',
      description: `Strong seasonal pattern detected. Plan staffing and resources around the ${trend.seasonalPattern.period}-day cycle.`
    });
  }
  
  return recommendations;
}

