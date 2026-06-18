/**
 * Continuity Forecaster
 *
 * Predict organizational continuity degradation trends.
 * Projects concentration growth, governance drift, redundancy erosion.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import type { PropagationMap } from '../propagation/propagation-models';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import type { ContinuityForecast, ContinuityTrendPoint } from './forecast-models';
import {
  forecastContinuityHealth,
  identifyApproachingThresholds,
} from './forecast-models';

type PublishedInterview = Awaited<ReturnType<typeof loadPublishedInterviews>>[number];

type CurrentMetrics = {
  singleSourceCount: number;
  totalNodes: number;
  averageRedundancy: number;
  governanceMaturity: number;
  undocumentedRisk: number;
  vendorConcentrationRisk: number;
};

async function loadPublishedInterviews(orgId: string) {
  return db
    .select()
    .from(exitInterviews)
    .where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published')))
    .orderBy(exitInterviews.publishedAt);
}

export async function forecastContinuityTrends(orgId: string): Promise<ContinuityForecast> {
  // Build current dependency map
  const propagationMap = await buildDependencyPropagationMap(orgId);

  // Load interviews for trend data
  const interviews = await loadPublishedInterviews(orgId);

  // Build baseline metrics
  const currentMetrics = buildCurrentMetrics(propagationMap, interviews.length);

  // Build historical trend points (simulate from interview dates)
  const historicalData = buildHistoricalTrendData(interviews, propagationMap);

  // Project future trends
  const projections = projectFutureTrends(currentMetrics, propagationMap);

  // Determine trend direction
  const trendDirection = determineTrendDirection(historicalData, projections);

  // Track specific risks
  const trackedRisks = buildTrackedRisks(currentMetrics, projections);

  // Find approaching thresholds
  const partialForecast: ContinuityForecast = {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    baselineDate: new Date().toISOString(),
    historicalData,
    projections,
    trendDirection,
    confidence: 60,
    trackedRisks,
    approachingThresholds: [],
    recommendations: [],
  };

  const approachingThresholds = identifyApproachingThresholds(partialForecast);

  // Generate recommendations
  const recommendations = generateForecastRecommendations(trackedRisks, approachingThresholds);

  return {
    ...partialForecast,
    approachingThresholds,
    recommendations,
    confidence: calculateForecastConfidence(interviews.length, propagationMap.nodes.length),
  };
}

function buildCurrentMetrics(propagationMap: PropagationMap, _interviewCount: number): CurrentMetrics {
  const totalNodes = propagationMap.nodes.length;
  const singleSourceCount = propagationMap.nodes.filter((node) => node.isSingleSource).length;
  const avgFrequency = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / totalNodes;

  const governanceNodes = propagationMap.nodes.filter((node) => node.category === 'governance');
  const undocumentedCount = propagationMap.nodes.filter((node) => node.isSingleSource && node.continuitySensitivity === 'critical').length;

  return {
    singleSourceCount,
    totalNodes,
    averageRedundancy: avgFrequency,
    governanceMaturity: Math.min(governanceNodes.length * 20, 80),
    undocumentedRisk: (undocumentedCount / totalNodes) * 100,
    vendorConcentrationRisk: (propagationMap.nodes.filter((node) => node.category === 'vendor' && node.isSingleSource).length / totalNodes) * 100,
  };
}

function buildHistoricalTrendData(interviews: PublishedInterview[], propagationMap: PropagationMap): ContinuityTrendPoint[] {
  // Build monthly trend points from interview dates
  const now = new Date();
  const trendPoints: ContinuityTrendPoint[] = [];

  for (let monthsAgo = 12; monthsAgo >= 0; monthsAgo--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - monthsAgo);

    // Filter interviews up to this month
    const upToThis = interviews.filter(
      (interview) => interview.publishedAt && new Date(interview.publishedAt) <= date,
    );

    if (upToThis.length > 0) {
      const singleSourceCount = propagationMap.nodes.filter((node) => node.frequency <= upToThis.length / 4).length;
      const healthScore = 100 - (singleSourceCount / propagationMap.nodes.length) * 50;

      trendPoints.push({
        date: date.toISOString().split('T')[0],
        healthScore: Math.max(healthScore, 20),
        singleSourceCount,
        averageRedundancy: Math.min(upToThis.length / 3, 3),
        governanceMaturity: Math.min(40 + (upToThis.length * 3), 80),
        undocumentedWorkflowRisk: Math.max(70 - (upToThis.length * 4), 20),
        vendorConcentrationRisk: 40,
      });
    }
  }

  return trendPoints.length > 0 ? trendPoints : [
    {
      date: new Date().toISOString().split('T')[0],
      healthScore: 60,
      singleSourceCount: 5,
      averageRedundancy: 1.5,
      governanceMaturity: 50,
      undocumentedWorkflowRisk: 60,
      vendorConcentrationRisk: 40,
    },
  ];
}

function projectFutureTrends(currentMetrics: CurrentMetrics, _propagationMap: PropagationMap): ContinuityTrendPoint[] {
  const projections: ContinuityTrendPoint[] = [];
  const now = new Date();

  // Growth rates (monthly change)
  const concentrationGrowth = 0.3; // 0.3 percentage points per month
  const governanceDrift = -0.5; // -0.5 points per month
  const redundancyErosion = -0.2; // -0.2 average per month

  for (let month = 1; month <= 12; month++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + month);

    const projectedConcentration = Math.min(
      (currentMetrics.singleSourceCount / currentMetrics.totalNodes) * 100 + concentrationGrowth * month,
      100,
    );
    const projectedGovernance = Math.max(currentMetrics.governanceMaturity + governanceDrift * month, 10);
    const projectedRedundancy = Math.max(currentMetrics.averageRedundancy - redundancyErosion * month, 1);

    const healthScore = forecastContinuityHealth(
      projectedConcentration,
      projectedRedundancy * 20,
      projectedGovernance,
      100 - currentMetrics.undocumentedRisk,
    );

    projections.push({
      date: date.toISOString().split('T')[0],
      healthScore: Math.round(healthScore),
      singleSourceCount: Math.round((projectedConcentration / 100) * currentMetrics.totalNodes),
      averageRedundancy: Math.round(projectedRedundancy * 10) / 10,
      governanceMaturity: Math.round(projectedGovernance),
      undocumentedWorkflowRisk: Math.min(currentMetrics.undocumentedRisk + concentrationGrowth * month * 1.5, 100),
      vendorConcentrationRisk: Math.min(currentMetrics.vendorConcentrationRisk + concentrationGrowth * month, 100),
    });
  }

  return projections;
}

function determineTrendDirection(historical: ContinuityTrendPoint[], projections: ContinuityTrendPoint[]) {
  const firstProjection = projections[0]?.healthScore ?? 50;
  const lastProjection = projections[projections.length - 1]?.healthScore ?? 50;

  const change = lastProjection - firstProjection;
  if (change < -5) return 'degrading' as const;
  if (change > 5) return 'improving' as const;
  return 'stable' as const;
}

function buildTrackedRisks(currentMetrics: CurrentMetrics, projections: ContinuityTrendPoint[]): ContinuityForecast['trackedRisks'] {
  const firstProj = projections[0];
  const lastProj = projections[projections.length - 1];

  return [
    {
      riskType: 'concentration_growth' as const,
      currentValue: (currentMetrics.singleSourceCount / currentMetrics.totalNodes) * 100,
      projectedValue: (lastProj.singleSourceCount / currentMetrics.totalNodes) * 100,
      isFavorable: false,
      trajectory: (lastProj.singleSourceCount > firstProj.singleSourceCount) ? 'degrading' as const : 'improving' as const,
    },
    {
      riskType: 'redundancy_erosion' as const,
      currentValue: currentMetrics.averageRedundancy,
      projectedValue: lastProj.averageRedundancy,
      isFavorable: true,
      trajectory: (lastProj.averageRedundancy < firstProj.averageRedundancy) ? 'degrading' as const : 'improving' as const,
    },
    {
      riskType: 'governance_drift' as const,
      currentValue: currentMetrics.governanceMaturity,
      projectedValue: lastProj.governanceMaturity,
      isFavorable: true,
      trajectory: (lastProj.governanceMaturity < firstProj.governanceMaturity) ? 'degrading' as const : 'improving' as const,
    },
    {
      riskType: 'documentation_degradation' as const,
      currentValue: currentMetrics.undocumentedRisk,
      projectedValue: lastProj.undocumentedWorkflowRisk,
      isFavorable: false,
      trajectory: (lastProj.undocumentedWorkflowRisk > firstProj.undocumentedWorkflowRisk) ? 'degrading' as const : 'improving' as const,
    },
    {
      riskType: 'vendor_risk' as const,
      currentValue: currentMetrics.vendorConcentrationRisk,
      projectedValue: lastProj.vendorConcentrationRisk,
      isFavorable: false,
      trajectory: (lastProj.vendorConcentrationRisk > firstProj.vendorConcentrationRisk) ? 'degrading' as const : 'improving' as const,
    },
  ];
}

function generateForecastRecommendations(trackedRisks: ContinuityForecast['trackedRisks'], thresholds: string[]): string[] {
  const recommendations: string[] = [];

  for (const risk of trackedRisks) {
    if (risk.trajectory === 'degrading') {
      if (risk.riskType === 'concentration_growth') {
        recommendations.push('Accelerate cross-training and documentation to reduce single-source knowledge');
      } else if (risk.riskType === 'redundancy_erosion') {
        recommendations.push('Implement structured mentorship and knowledge transfer program');
      } else if (risk.riskType === 'governance_drift') {
        recommendations.push('Audit governance procedures and create formal documentation');
      } else if (risk.riskType === 'documentation_degradation') {
        recommendations.push('Establish knowledge management and documentation system');
      } else if (risk.riskType === 'vendor_risk') {
        recommendations.push('Diversify vendor relationships and establish backup procedures');
      }
    }
  }

  if (thresholds.length > 0) {
    recommendations.unshift('URGENT: Address approaching critical thresholds immediately');
  }

  return recommendations;
}

function calculateForecastConfidence(interviewCount: number, nodeCount: number): number {
  let confidence = 50;
  confidence += Math.min(interviewCount * 3, 25); // More interviews = more data
  if (nodeCount > 20) confidence += 15; // Complex graph = more patterns
  return Math.min(confidence, 85);
}
