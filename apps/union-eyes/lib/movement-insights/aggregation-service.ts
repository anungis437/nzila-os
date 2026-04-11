/**
 * Movement Insights Aggregation Service
 * 
 * Creates privacy-preserving cross-union insights.
 * 
 * PRIVACY GUARANTEES:
 * 1. Minimum 5 organizations required for any trend
 * 2. Minimum 10 cases per trend (configurable by sensitivity)
 * 3. No individual organization identifiable
 * 4. All participants must have active consent
 * 5. Statistical noise added to prevent re-identification
 */

import { MovementTrend } from '@/types/marketing';
import { logger } from '@/lib/logger';

export interface AggregationInput {
  trendType: string;
  jurisdiction?: string;
  sector?: string;
  timeframe: 'month' | 'quarter' | 'year';
  dataPoints: {
    organizationId: string;
    value: number;
    weight?: number; // For weighted averages
    metadata?: Record<string, unknown>;
  }[];
}

export interface AggregationConfig {
  minOrganizations: number; // Default: 5
  minCases: number; // Default: 10
  addNoise: boolean; // Default: true
  noisePercent: number; // Default: 2% (prevents exact reverse engineering)
}

const DEFAULT_CONFIG: AggregationConfig = {
  minOrganizations: 5,
  minCases: 10,
  addNoise: true,
  noisePercent: 2,
};

/**
 * Aggregate data with privacy guarantees
 */
export function aggregateWithPrivacy(
  input: AggregationInput,
  config: Partial<AggregationConfig> = {}
): MovementTrend | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Privacy check 1: Minimum organizations
  if (input.dataPoints.length < cfg.minOrganizations) {
    logger.warn('Aggregation rejected: Insufficient organizations', {
      count: input.dataPoints.length,
      required: cfg.minOrganizations,
    });
    return null;
  }

  // Privacy check 2: Minimum cases
  const totalCases = input.dataPoints.reduce(
    (sum, dp) => sum + (dp.weight || 1),
    0
  );
  if (totalCases < cfg.minCases) {
    logger.warn('Aggregation rejected: Insufficient cases', {
      count: totalCases,
      required: cfg.minCases,
    });
    return null;
  }

  // Calculate aggregated value
  let aggregatedValue: number;
  
  if (input.dataPoints.some((dp) => dp.weight !== undefined)) {
    // Weighted average
    const totalWeight = input.dataPoints.reduce(
      (sum, dp) => sum + (dp.weight || 0),
      0
    );
    const weightedSum = input.dataPoints.reduce(
      (sum, dp) => sum + dp.value * (dp.weight || 0),
      0
    );
    aggregatedValue = weightedSum / totalWeight;
  } else {
    // Simple average
    const sum = input.dataPoints.reduce((sum, dp) => sum + dp.value, 0);
    aggregatedValue = sum / input.dataPoints.length;
  }

  // Privacy check 3: Add statistical noise
  if (cfg.addNoise) {
    const noiseRange = aggregatedValue * (cfg.noisePercent / 100);
    const noise = (Math.random() - 0.5) * 2 * noiseRange;
    aggregatedValue += noise;
  }

  // Round to prevent precision-based re-identification
  aggregatedValue = Math.round(aggregatedValue * 100) / 100;

  // Create trend record
  const trend: MovementTrend = {
    id: `trend-${input.trendType}-${Date.now()}`,
    trendType: input.trendType,
    aggregatedValue,
    participatingOrgs: input.dataPoints.length,
    totalCases: Math.round(totalCases),
    jurisdiction: input.jurisdiction,
    sector: input.sector,
    timeframe: input.timeframe,
    calculatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return trend;
}

/**
 * Calculate trend with confidence interval
 */
export function calculateTrendWithConfidence(
  input: AggregationInput,
  config: Partial<AggregationConfig> = {}
): {
  trend: MovementTrend | null;
  confidence: 'low' | 'medium' | 'high';
  message: string;
} {
  const trend = aggregateWithPrivacy(input, config);

  if (!trend) {
    return {
      trend: null,
      confidence: 'low',
      message: 'Insufficient data for privacy-preserving aggregation',
    };
  }

  // Confidence based on sample size
  let confidence: 'low' | 'medium' | 'high';
  let message: string;

  if (trend.participatingOrgs >= 20 && trend.totalCases >= 100) {
    confidence = 'high';
    message = 'High confidence: Large sample size across many organizations';
  } else if (trend.participatingOrgs >= 10 && trend.totalCases >= 50) {
    confidence = 'medium';
    message = 'Medium confidence: Moderate sample size';
  } else {
    confidence = 'low';
    message = 'Low confidence: Minimum threshold met but limited data';
  }

  return { trend, confidence, message };
}

/**
 * Compare trends across time periods
 */
export function compareTrends(
  current: MovementTrend,
  previous: MovementTrend
): {
  change: number;
  changePercent: number;
  direction: 'improving' | 'declining' | 'stable';
  significance: 'significant' | 'minor' | 'negligible';
} {
  const change = current.aggregatedValue - previous.aggregatedValue;
  const changePercent =
    previous.aggregatedValue !== 0
      ? (change / previous.aggregatedValue) * 100
      : 0;

  // Determine direction
  let direction: 'improving' | 'declining' | 'stable';
  
  // For certain metrics, lower is better (e.g., resolution time)
  const lowerIsBetter = [
    'avg-resolution-time',
    'escalation-rate',
    'organizer-burnout',
  ].includes(current.trendType);

  if (Math.abs(changePercent) < 5) {
    direction = 'stable';
  } else if (lowerIsBetter) {
    direction = change < 0 ? 'improving' : 'declining';
  } else {
    direction = change > 0 ? 'improving' : 'declining';
  }

  // Determine significance
  let significance: 'significant' | 'minor' | 'negligible';
  const absChangePercent = Math.abs(changePercent);

  if (absChangePercent >= 20) {
    significance = 'significant';
  } else if (absChangePercent >= 10) {
    significance = 'minor';
  } else {
    significance = 'negligible';
  }

  return {
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 10) / 10,
    direction,
    significance,
  };
}

/**
 * Generate legislative brief data
 * 
 * Purpose: Support union advocacy with anonymized data
 */
export function generateLegislativeBrief(
  trends: MovementTrend[],
  focusArea: string
): {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  dataSource: string;
} {
  const participatingOrgs = Math.max(
    ...trends.map((t) => t.participatingOrgs)
  );
  const totalCases = trends.reduce((sum, t) => sum + t.totalCases, 0);

  const brief = {
    title: `Movement Insights: ${focusArea}`,
    summary: `Analysis based on anonymized data from ${participatingOrgs}+ union locals representing ${totalCases.toLocaleString()}+ cases.`,
    keyFindings: [] as string[],
    recommendations: [] as string[],
    dataSource: `UnionEyes Movement Insights Platform - Data aggregated with privacy guarantees from consenting organizations. Minimum ${DEFAULT_CONFIG.minOrganizations} organizations and ${DEFAULT_CONFIG.minCases} cases required for all insights.`,
  };

  // Generate findings from trends
  trends.forEach((trend) => {
    const value = Math.round(trend.aggregatedValue * 10) / 10;
    
    if (trend.trendType === 'avg-resolution-time') {
      brief.keyFindings.push(
        `Average grievance resolution time: ${value} days (${trend.participatingOrgs} unions, ${trend.totalCases} cases)`
      );
      
      if (value > 60) {
        brief.recommendations.push(
          'Legislative action needed to streamline workplace dispute resolution processes'
        );
      }
    }

    if (trend.trendType === 'win-rate') {
      brief.keyFindings.push(
        `Member win rate: ${value}% (${trend.participatingOrgs} unions, ${trend.totalCases} cases)`
      );
      
      if (value < 50) {
        brief.recommendations.push(
          'Stronger worker protections needed to ensure fair dispute outcomes'
        );
      }
    }

    if (trend.trendType === 'member-satisfaction') {
      brief.keyFindings.push(
        `Member satisfaction with grievance process: ${value}/5.0 (${trend.participatingOrgs} unions)`
      );
    }
  });

  return brief;
}

/**
 * Validate aggregation request against consent
 */
export function validateAggregationRequest(
  organizationIds: string[],
  dataType: string,
  consentRecords: Map<string, boolean>
): {
  valid: boolean;
  eligibleOrgs: string[];
  ineligibleOrgs: string[];
  reason?: string;
} {
  const eligibleOrgs: string[] = [];
  const ineligibleOrgs: string[] = [];

  organizationIds.forEach((orgId) => {
    const hasConsent = consentRecords.get(orgId);
    if (hasConsent) {
      eligibleOrgs.push(orgId);
    } else {
      ineligibleOrgs.push(orgId);
    }
  });

  if (eligibleOrgs.length < DEFAULT_CONFIG.minOrganizations) {
    return {
      valid: false,
      eligibleOrgs,
      ineligibleOrgs,
      reason: `Only ${eligibleOrgs.length} organizations with consent (minimum ${DEFAULT_CONFIG.minOrganizations} required)`,
    };
  }

  return {
    valid: true,
    eligibleOrgs,
    ineligibleOrgs,
  };
}
