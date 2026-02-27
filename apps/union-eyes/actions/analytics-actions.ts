'use server';

/**
 * Analytics Server Actions
 * Q1 2025 - Advanced Analytics
 * 
 * Server-side actions for analytics operations
 */

import { withRLSContext } from '@/lib/db/with-rls-context';
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
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * Get current user's organization ID
 */
async function getCurrentUserOrgId(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  
  // Prefer Clerk's active org context (avoids raw DB lookup)
  if (orgId) return orgId;

  // Fallback: resolve via org membership with system RLS context
  const result = await withRLSContext({ organizationId: 'system' }, async (rlsDb) =>
    rlsDb.query.organizationMembers.findFirst({
      where: (members, { eq }) => eq(members.userId, userId),
      with: {
        organization: true
      }
    })
  );
  
  if (!result) throw new Error('User not associated with any organization');
  
  return result.organizationId;
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
}) {
  try {
    const orgId = await getCurrentUserOrgId();
    
    // Calculate metric value based on type
    let metricValue: number;
    let metricUnit: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let metadata: any = {};
    
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
        metadata = { claimIds: claimsCount.map(c => c.claimId) };
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
        // SECURITY FIX: Wrap with RLS context for tenant isolation
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
    
    // SECURITY FIX: Wrap with RLS context for tenant isolation
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
      return db.insert(analyticsMetrics).values({
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
    const orgId = await getCurrentUserOrgId();
    
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: m.metadata as Record<string, any>
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storedPredictions: any[] = [];
    
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i];
      const targetDate = new Date(lastDate);
      targetDate.setDate(targetDate.getDate() + i + 1);
      
      const [stored] = await withRLSContext({ organizationId: orgId }, async (db) =>
        db.insert(mlPredictions).values({
          organizationId: orgId,
          predictionType: params.predictionType,
          modelName: pred.modelName,
          modelVersion: pred.modelVersion,
          targetDate,
          predictedValue: pred.predictedValue.toString(),
          confidenceInterval: pred.confidenceInterval,
          confidenceScore: pred.confidenceScore.toString(),
          features: pred.features,
          metadata: {
            historicalDataPoints: timeSeriesData.length,
            generatedAt: new Date().toISOString()
          }
        }).returning()
      );
      
      storedPredictions.push(stored);
    }
    
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
    const orgId = await getCurrentUserOrgId();
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
    const [storedTrend] = await withRLSContext({ organizationId: orgId }, async (db) =>
      db.insert(trendAnalyses).values({
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
      }).returning()
    );
    
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculation: any;
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
    
    const [kpi] = await withRLSContext({ organizationId: orgId }, async (db) =>
      db.insert(kpiConfigurations).values({
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
      }).returning()
    );
    
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
}) {
  try {
    const orgId = await getCurrentUserOrgId();
    
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
    
    return { success: true, metrics };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateTrendRecommendations(trend: TrendAnalysisResult): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendations: any[] = [];
  
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

