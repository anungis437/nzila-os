/**
 * AI Insights Generator
 * Q1 2025 - Advanced Analytics
 * 
 * Generates natural language insights from analytics data
 * Integrates with existing AI workbench for content generation
 */

import { db } from '@/db';
import {
  analyticsMetrics,
  trendAnalyses,
  insightRecommendations,
  mlPredictions
} from '@/db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

interface InsightConfig {
  organizationId: string;
  analysisType: 'metrics' | 'trends' | 'anomalies' | 'predictions' | 'comprehensive';
  timeRange?: number; // days
  minConfidence?: number; // 0-1
}

interface GeneratedInsight {
  insightType: 'opportunity' | 'risk' | 'optimization' | 'alert' | 'information';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendations: string[];
  affectedMetrics: string[];
  estimatedImpact: string;
  confidence: number;
  dataPoints: unknown[];
}

/**
 * Generate comprehensive insights from all available data
 */
export async function generateInsights(
  config: InsightConfig
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  try {
    switch (config.analysisType) {
      case 'metrics':
        insights.push(...(await generateMetricInsights(config)));
        break;
      case 'trends':
        insights.push(...(await generateTrendInsights(config)));
        break;
      case 'anomalies':
        insights.push(...(await generateAnomalyInsights(config)));
        break;
      case 'predictions':
        insights.push(...(await generatePredictionInsights(config)));
        break;
      case 'comprehensive':
        insights.push(...(await generateMetricInsights(config)));
        insights.push(...(await generateTrendInsights(config)));
        insights.push(...(await generateAnomalyInsights(config)));
        insights.push(...(await generatePredictionInsights(config)));
        break;
    }

    // Sort by priority and confidence
    return insights.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  } catch (_error) {
return [];
  }
}

/**
 * Generate insights from metrics data
 */
async function generateMetricInsights(
  config: InsightConfig
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];
  const days = config.timeRange || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch recent metrics
  const metrics = await db
    .select()
    .from(analyticsMetrics)
    .where(
      and(
        eq(analyticsMetrics.organizationId, config.organizationId),
        gte(analyticsMetrics.periodStart, startDate)
      )
    )
    .orderBy(desc(analyticsMetrics.periodStart))
    .limit(100);

  if (metrics.length === 0) return insights;

  // Group metrics by type
  const metricsByType = metrics.reduce(
    (acc, metric) => {
      if (!acc[metric.metricType]) acc[metric.metricType] = [];
      acc[metric.metricType].push(metric);
      return acc;
    },
    {} as Record<string, typeof metrics>
  );

  // Analyze each metric type
  for (const [metricType, metricData] of Object.entries(metricsByType)) {
    const values = metricData.map((m) => Number(m.metricValue));
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[0];
    const changePercent = ((latest - average) / average) * 100;

    // Significant change detection
    if (Math.abs(changePercent) > 20) {
      insights.push({
        insightType: changePercent > 0 ? 'opportunity' : 'risk',
        priority: Math.abs(changePercent) > 40 ? 'critical' : 'high',
        title: `Significant ${metricType.replace(/_/g, ' ')} Change`,
        description: `${metricType.replace(/_/g, ' ')} has ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(1)}% compared to the ${days}-day average. Current value: ${latest.toFixed(1)}, Average: ${average.toFixed(1)}.`,
        recommendations: generateMetricRecommendations(metricType, changePercent),
        affectedMetrics: [metricType],
        estimatedImpact: Math.abs(changePercent) > 40 ? 'High' : 'Medium',
        confidence: 0.85,
        dataPoints: metricData.slice(0, 10).map((m) => ({
          date: m.periodStart,
          value: m.metricValue
        }))
      });
    }

    // Performance threshold analysis
    if (metricType === 'resolution_time' && latest > 7) {
      insights.push({
        insightType: 'optimization',
        priority: latest > 10 ? 'critical' : 'high',
        title: 'High Claim Resolution Time',
        description: `Average claim resolution time is ${latest.toFixed(1)} days, which exceeds the recommended threshold of 7 days. This may impact member satisfaction and operational efficiency.`,
        recommendations: [
          'Review bottlenecks in claim processing workflow',
          'Consider increasing staff allocation during peak periods',
          'Implement automated pre-screening for common claim types',
          'Provide additional training for claim processors',
          'Set up escalation process for claims pending > 5 days'
        ],
        affectedMetrics: ['resolution_time', 'member_satisfaction'],
        estimatedImpact: 'High',
        confidence: 0.9,
        dataPoints: metricData.slice(0, 10).map((m) => ({
          date: m.periodStart,
          value: m.metricValue
        }))
      });
    }

    // Growth opportunities
    if (metricType === 'member_growth' && latest > 0) {
      insights.push({
        insightType: 'opportunity',
        priority: 'medium',
        title: 'Positive Member Growth Trend',
        description: `Member base is growing at ${latest.toFixed(1)} members per ${metricData[0].periodType}. This presents opportunities to scale services and improve engagement.`,
        recommendations: [
          'Develop onboarding program for new members',
          'Scale support resources to maintain service quality',
          'Implement member referral program',
          'Create targeted communication campaigns',
          'Monitor service capacity and plan infrastructure scaling'
        ],
        affectedMetrics: ['member_growth', 'claims_volume'],
        estimatedImpact: 'Medium',
        confidence: 0.8,
        dataPoints: metricData.slice(0, 10).map((m) => ({
          date: m.periodStart,
          value: m.metricValue
        }))
      });
    }
  }

  return insights;
}

/**
 * Generate insights from trend analyses
 */
async function generateTrendInsights(
  config: InsightConfig
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];
  const days = config.timeRange || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch recent trend analyses
  const trends = await db
    .select()
    .from(trendAnalyses)
    .where(
      and(
        eq(trendAnalyses.organizationId, config.organizationId),
        gte(trendAnalyses.createdAt, startDate)
      )
    )
    .orderBy(desc(trendAnalyses.createdAt))
    .limit(50);

  for (const trend of trends) {
    const trendStrength = Number(trend.trendStrength);
    const hasAnomalies = trend.anomalyCount ? trend.anomalyCount > 0 : false;

    // Strong trend detection
    if (trendStrength > 0.7 && trend.detectedTrend && trend.detectedTrend !== 'stable') {
      insights.push({
        insightType:
          trend.detectedTrend === 'increasing' || trend.detectedTrend === 'seasonal_up'
            ? 'opportunity'
            : 'risk',
        priority: trendStrength > 0.85 ? 'high' : 'medium',
        title: `${trend.detectedTrend.replace(/_/g, ' ').toUpperCase()} Trend in ${trend.analysisType.replace(/_/g, ' ')}`,
        description: `A ${trend.detectedTrend.replace(/_/g, ' ')} trend has been detected with ${(trendStrength * 100).toFixed(1)}% confidence. ${trend.insights || ''}`,
        recommendations: generateTrendRecommendations(
          trend.analysisType,
          trend.detectedTrend || 'unknown'
        ),
        affectedMetrics: [trend.analysisType],
        estimatedImpact: trendStrength > 0.85 ? 'High' : 'Medium',
        confidence: trendStrength,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataPoints: (trend.visualizationData as any)?.dataPoints || []
      });
    }

    // Anomaly detection
    if (hasAnomalies && trend.anomalyCount && trend.anomalyCount > 2) {
      insights.push({
        insightType: 'alert',
        priority: trend.anomalyCount > 5 ? 'critical' : 'high',
        title: `Multiple Anomalies Detected in ${trend.analysisType.replace(/_/g, ' ')}`,
        description: `${trend.anomalyCount} anomalies detected in ${trend.analysisType.replace(/_/g, ' ')} over the analysis period. This indicates unusual patterns that require investigation.`,
        recommendations: [
          'Investigate data sources for accuracy',
          'Review recent operational changes',
          'Check for external factors affecting performance',
          'Verify data collection processes',
          'Consider adjusting baseline thresholds if environment changed'
        ],
        affectedMetrics: [trend.analysisType],
        estimatedImpact: 'High',
        confidence: 0.8,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataPoints: (trend.visualizationData as any)?.dataPoints || []
      });
    }

    // Seasonal pattern insights
    if (trend.detectedTrend === 'seasonal' || trend.seasonalPattern) {
      insights.push({
        insightType: 'information',
        priority: 'low',
        title: `Seasonal Pattern Identified in ${trend.analysisType.replace(/_/g, ' ')}`,
        description: `A recurring seasonal pattern has been identified. This information can be used for capacity planning and resource allocation.`,
        recommendations: [
          'Plan resources according to seasonal patterns',
          'Prepare staffing adjustments in advance',
          'Communicate expected changes to stakeholders',
          'Build seasonal forecasts into budgets',
          'Create seasonal-specific strategies'
        ],
        affectedMetrics: [trend.analysisType],
        estimatedImpact: 'Medium',
        confidence: trendStrength,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataPoints: (trend.visualizationData as any)?.dataPoints || []
      });
    }
  }

  return insights;
}

/**
 * Generate insights from anomaly detection
 */
async function generateAnomalyInsights(
  config: InsightConfig
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];
  const days = config.timeRange || 7; // Shorter window for anomalies
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch recent analyses with anomalies
  const analyses = await db
    .select()
    .from(trendAnalyses)
    .where(
      and(
        eq(trendAnalyses.organizationId, config.organizationId),
        gte(trendAnalyses.createdAt, startDate),
        sql`${trendAnalyses.anomalyCount} > 0`
      )
    )
    .orderBy(desc(trendAnalyses.createdAt));

  for (const analysis of analyses) {
    if (analysis.anomalyCount && analysis.anomalyCount > 0) {
      insights.push({
        insightType: 'alert',
        priority: analysis.anomalyCount > 3 ? 'critical' : 'high',
        title: `Anomalous ${analysis.analysisType.replace(/_/g, ' ')} Activity`,
        description: `Detected ${analysis.anomalyCount} anomalous data point(s) in ${analysis.analysisType.replace(/_/g, ' ')}. These outliers deviate significantly from expected patterns and require immediate attention.`,
        recommendations: [
          'Verify data accuracy and collection methods',
          'Investigate operational changes during anomaly periods',
          'Check for system errors or technical issues',
          'Review external factors (holidays, events, etc.)',
          'Document findings for future pattern analysis'
        ],
        affectedMetrics: [analysis.analysisType],
        estimatedImpact: 'High',
        confidence: 0.9,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataPoints: (analysis.visualizationData as any)?.dataPoints || []
      });
    }
  }

  return insights;
}

/**
 * Generate insights from ML predictions
 */
async function generatePredictionInsights(
  config: InsightConfig
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Fetch recent predictions
  const predictions = await db
    .select()
    .from(mlPredictions)
    .where(eq(mlPredictions.organizationId, config.organizationId))
    .orderBy(desc(mlPredictions.createdAt))
    .limit(20);

  // Group predictions by prediction type
  const predictionsByMetric = predictions.reduce(
    (acc, pred) => {
      if (!acc[pred.predictionType]) acc[pred.predictionType] = [];
      acc[pred.predictionType].push(pred);
      return acc;
    },
    {} as Record<string, typeof predictions>
  );

  for (const [metricType, preds] of Object.entries(predictionsByMetric)) {
    const sortedPreds = preds.sort(
      (a, b) => new Date(a.predictionDate).getTime() - new Date(b.predictionDate).getTime()
    );
    const values = sortedPreds.map((p) => Number(p.predictedValue));
    const confidences = sortedPreds.map((p) => Number(p.confidence || '0'));
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Trend in predictions
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;

    if (Math.abs(changePercent) > 15 && avgConfidence > 0.7) {
      insights.push({
        insightType: changePercent > 0 ? 'opportunity' : 'risk',
        priority: Math.abs(changePercent) > 30 ? 'high' : 'medium',
        title: `Predicted ${changePercent > 0 ? 'Increase' : 'Decrease'} in ${metricType.replace(/_/g, ' ')}`,
        description: `ML models predict a ${Math.abs(changePercent).toFixed(1)}% ${changePercent > 0 ? 'increase' : 'decrease'} in ${metricType.replace(/_/g, ' ')} over the next ${values.length} periods (confidence: ${(avgConfidence * 100).toFixed(1)}%).`,
        recommendations: generatePredictionRecommendations(metricType, changePercent),
        affectedMetrics: [metricType],
        estimatedImpact: Math.abs(changePercent) > 30 ? 'High' : 'Medium',
        confidence: avgConfidence,
        dataPoints: sortedPreds.map((p) => ({
          date: p.predictionDate,
          value: p.predictedValue,
          confidence: p.confidence
        }))
      });
    }
  }

  return insights;
}

/**
 * Generate metric-specific recommendations
 */
function generateMetricRecommendations(
  metricType: string,
  changePercent: number
): string[] {
  const recommendations: Record<string, { increase: string[]; decrease: string[] }> = {
    claims_volume: {
      increase: [
        'Increase staff allocation to handle volume',
        'Implement automated triage for urgent claims',
        'Review resource capacity and scale if needed',
        'Communicate expected delays to members',
        'Activate contingency procedures'
      ],
      decrease: [
        'Investigate reasons for volume decrease',
        'Review member engagement strategies',
        'Check for system/reporting issues',
        'Analyze if decrease indicates positive trends',
        'Adjust resource allocation accordingly'
      ]
    },
    resolution_time: {
      increase: [
        'Identify process bottlenecks',
        'Provide additional training to staff',
        'Review complex case handling procedures',
        'Implement escalation protocols',
        'Consider temporary resource augmentation'
      ],
      decrease: [
        'Document successful process improvements',
        'Share best practices across teams',
        'Maintain current efficiency levels',
        'Consider reallocating freed resources',
        'Continue monitoring for sustainability'
      ]
    },
    member_growth: {
      increase: [
        'Scale support and service capacity',
        'Enhance onboarding processes',
        'Plan infrastructure expansion',
        'Develop retention strategies',
        'Implement member success programs'
      ],
      decrease: [
        'Analyze attrition factors',
        'Review member satisfaction metrics',
        'Implement retention campaigns',
        'Enhance member value propositions',
        'Conduct exit surveys'
      ]
    }
  };

  const metricRecs = recommendations[metricType];
  if (!metricRecs) {
    return [
      'Monitor situation closely',
      'Analyze root causes',
      'Develop action plan',
      'Communicate with stakeholders'
    ];
  }

  return changePercent > 0 ? metricRecs.increase : metricRecs.decrease;
}

/**
 * Generate trend-specific recommendations
 */
function generateTrendRecommendations(metricType: string, trendType: string): string[] {
  const baseRecommendations = [
    'Continue monitoring trend development',
    'Update forecasts based on trend',
    'Adjust strategic planning accordingly',
    'Communicate trend to stakeholders'
  ];

  if (trendType.includes('increasing') || trendType.includes('up')) {
    return [
      'Prepare for sustained growth',
      'Scale resources proactively',
      ...baseRecommendations
    ];
  } else if (trendType.includes('decreasing') || trendType.includes('down')) {
    return [
      'Investigate underlying causes',
      'Develop intervention strategies',
      ...baseRecommendations
    ];
  }

  return baseRecommendations;
}

/**
 * Generate prediction-specific recommendations
 */
function generatePredictionRecommendations(
  metricType: string,
  predictedChange: number
): string[] {
  if (predictedChange > 0) {
    return [
      'Prepare resources for predicted increase',
      'Implement proactive capacity planning',
      'Communicate expectations to team',
      'Review contingency plans',
      'Monitor actual vs predicted values'
    ];
  } else {
    return [
      'Investigate factors driving predicted decrease',
      'Develop mitigation strategies',
      'Adjust resource allocation',
      'Prepare stakeholder communication',
      'Monitor for early warning signs'
    ];
  }
}

/**
 * Save generated insights to database
 */
export async function saveInsights(
  organizationId: string,
  insights: GeneratedInsight[]
): Promise<void> {
  try {
    for (const insight of insights) {
      await db.insert(insightRecommendations).values({
        organizationId,
        insightType: insight.insightType,
        category: 'claims', // Default category
        priority: insight.priority,
        title: insight.title,
        description: insight.description,
        recommendations: insight.recommendations as unknown,
        metrics: { affectedMetrics: insight.affectedMetrics, estimatedImpact: insight.estimatedImpact } as unknown,
        confidenceScore: insight.confidence.toString(),
        dataSource: { dataPoints: insight.dataPoints } as unknown,
        status: 'new'
      });
    }
  } catch (error) {
throw error;
  }
}

