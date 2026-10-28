/**
 * Continuity Forecaster
 *
 * Reports the measured continuity position of the organization from the published, consented, derived-analytics-eligible
 * interviews, and says plainly when there is not enough data to describe a trend.
 *
 * It does not project. The earlier version extrapolated twelve months from three fixed monthly rates and rebuilt a
 * "history" from interview counts with literal fallbacks, so it reported an improving trend for every organization. A
 * trend needs a measured series (the dependency map as it stood in earlier periods), which this engine does not hold, so
 * the series and the projections are empty and the trend is `insufficient_data`.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import type { PropagationMap } from '../propagation/propagation-models';
import { derivedAnalyticsCondition } from '../governance/interview-access';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import type { ContinuityForecast } from './forecast-models';

export interface CurrentMetrics {
  singleSourceCount: number;
  totalNodes: number;
  averageRedundancy: number;
  governanceMaturity: number;
  undocumentedRisk: number;
  vendorConcentrationRisk: number;
}

async function countEligibleInterviews(orgId: string): Promise<number> {
  const rows = await db.select({ id: exitInterviews.id }).from(exitInterviews).where(derivedAnalyticsCondition(orgId));
  return rows.length;
}

export async function forecastContinuityTrends(orgId: string): Promise<ContinuityForecast> {
  const propagationMap = await buildDependencyPropagationMap(orgId);
  const interviewCount = await countEligibleInterviews(orgId);
  const now = new Date().toISOString();

  const metrics = buildCurrentMetrics(propagationMap);
  return {
    organizationId: orgId,
    generatedAt: now,
    baselineDate: now,
    historicalData: [],
    projections: [],
    trendDirection: 'insufficient_data',
    confidence: 0,
    trackedRisks: [],
    approachingThresholds: [],
    recommendations: metrics ? recommendationsFor(metrics) : [],
    ...(metrics ? { currentMetrics: metrics } : {}),
    dataPoints: interviewCount,
    note: 'No trend is reported: a measured history of the dependency map is not held. Current metrics are measured from eligible interviews only.',
  };
}

export function buildCurrentMetrics(propagationMap: PropagationMap): CurrentMetrics | null {
  const totalNodes = propagationMap.nodes.length;
  if (totalNodes === 0) return null;
  const singleSourceCount = propagationMap.nodes.filter((node) => node.isSingleSource).length;
  const averageRedundancy = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / totalNodes;
  const governanceNodes = propagationMap.nodes.filter((node) => node.category === 'governance');
  const undocumented = propagationMap.nodes.filter((node) => node.isSingleSource && node.continuitySensitivity === 'critical').length;
  const vendorSingle = propagationMap.nodes.filter((node) => node.category === 'vendor' && node.isSingleSource).length;

  return {
    singleSourceCount,
    totalNodes,
    averageRedundancy,
    governanceMaturity: Math.min(governanceNodes.length * 20, 80),
    undocumentedRisk: (undocumented / totalNodes) * 100,
    vendorConcentrationRisk: (vendorSingle / totalNodes) * 100,
  };
}

function recommendationsFor(metrics: CurrentMetrics): string[] {
  const recommendations: string[] = [];
  if (metrics.singleSourceCount / metrics.totalNodes >= 0.5) {
    recommendations.push('Accelerate cross-training and documentation to reduce single-source knowledge');
  }
  if (metrics.averageRedundancy < 2) {
    recommendations.push('Implement structured mentorship and knowledge transfer program');
  }
  if (metrics.undocumentedRisk >= 25) {
    recommendations.push('Establish knowledge management and documentation system');
  }
  if (metrics.vendorConcentrationRisk >= 25) {
    recommendations.push('Diversify vendor relationships and establish backup procedures');
  }
  return recommendations;
}
