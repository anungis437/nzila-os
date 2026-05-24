/**
 * Organizational Learning Engine
 *
 * Analyzes organizational continuity history to extract learning insights.
 * Identifies resilience trends, effective interventions, and recurring failures.
 *
 * All analysis is organizational — never employee-level.
 */

import { randomUUID } from 'crypto';
import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import type {
  InstitutionalLearningReport,
  LearningInsight,
  ResilienceEvolutionIndicator,
  LearningMaturityAssessment,
  LearningDataPoint,
  LearningInsightType,
} from './learning-models';

/** Compute trend from a series of resilience scores. */
function computeTrend(
  scores: number[],
): 'improving' | 'stable' | 'declining' | 'volatile' | 'insufficient_data' {
  if (scores.length < 2) return 'insufficient_data';
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;

  // Volatility: std deviation
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > 15) return 'volatile';
  if (delta >= 8) return 'improving';
  if (delta <= -8) return 'declining';
  return 'stable';
}

/** Derive maturity score from resilience evolution and data density. */
function computeMaturityScore(
  trendIndicator: ResilienceEvolutionIndicator,
  insightCount: number,
  entriesAnalyzed: number,
): number {
  let score = 0;

  // Data density (max 25 points)
  score += Math.min(entriesAnalyzed * 3, 25);

  // Trend direction (max 40 points)
  const trendScores: Record<string, number> = {
    improving: 40,
    stable: 25,
    volatile: 15,
    declining: 5,
    insufficient_data: 0,
  };
  score += trendScores[trendIndicator.trend] ?? 0;

  // Insight depth — how much the org is learning (max 20 points)
  score += Math.min(insightCount * 4, 20);

  // Resilience level ceiling adjustment (max 15 points)
  if (trendIndicator.peak >= 70) score += 15;
  else if (trendIndicator.peak >= 50) score += 8;
  else if (trendIndicator.peak >= 30) score += 4;

  return Math.min(Math.max(Math.round(score), 0), 100);
}

function maturityStage(
  score: number,
): LearningMaturityAssessment['maturityStage'] {
  if (score >= 85) return 'leading';
  if (score >= 70) return 'advanced';
  if (score >= 55) return 'established';
  if (score >= 40) return 'developing';
  if (score >= 20) return 'emerging';
  return 'nascent';
}

/** Extract organizational learning insights from cognition memory history. */
function extractInsights(dataPoints: LearningDataPoint[]): LearningInsight[] {
  const insights: LearningInsight[] = [];
  if (dataPoints.length < 2) return insights;

  const withScores = dataPoints.filter((d) => d.resilienceScore !== null && d.resilienceScore >= 0);
  if (withScores.length < 2) return insights;

  const scores = withScores.map((d) => d.resilienceScore);
  const trend = computeTrend(scores);
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;

  // Resilience improvement insight
  if (delta >= 8) {
    insights.push({
      id: randomUUID(),
      insightType: 'resilience_improvement' as LearningInsightType,
      headline: `Organizational resilience has improved by ${delta} points over recorded history`,
      explanation: `The resilience score moved from ${first} to ${last} across ${withScores.length} measurements, indicating sustained continuity improvement.`,
      evidenceDataPoints: [withScores[0], withScores[withScores.length - 1]],
      supportingCount: withScores.length,
      confidence: withScores.length >= 5 ? 'high' : 'medium',
      governanceImplication: 'Continuity investments are demonstrating measurable organizational benefit.',
      suggestedAction: 'Continue current governance and documentation practices that are driving improvement.',
      detectedAt: new Date().toISOString(),
    });
  }

  // Resilience regression insight
  if (delta <= -8) {
    insights.push({
      id: randomUUID(),
      insightType: 'resilience_regression' as LearningInsightType,
      headline: `Organizational resilience has declined by ${Math.abs(delta)} points`,
      explanation: `The resilience score moved from ${first} to ${last}, indicating continuity investment may have stalled or knowledge concentration has increased.`,
      evidenceDataPoints: [withScores[0], withScores[withScores.length - 1]],
      supportingCount: withScores.length,
      confidence: 'medium',
      governanceImplication: 'Governance review of continuity investments is recommended.',
      suggestedAction: 'Audit recent organizational changes that may have increased knowledge concentration.',
      detectedAt: new Date().toISOString(),
    });
  }

  // Volatility insight
  if (trend === 'volatile') {
    insights.push({
      id: randomUUID(),
      insightType: 'recurring_failure' as LearningInsightType,
      headline: 'Organizational resilience shows high volatility — continuity gains are unstable',
      explanation: `Resilience scores fluctuate significantly (range: ${Math.min(...scores)}-${Math.max(...scores)}), suggesting continuity improvements are not being consolidated.`,
      evidenceDataPoints: withScores,
      supportingCount: withScores.length,
      confidence: 'medium',
      governanceImplication: 'Volatile continuity scores indicate knowledge retention challenges after initial improvements.',
      suggestedAction: 'Invest in knowledge documentation and governance process formalization to lock in gains.',
      detectedAt: new Date().toISOString(),
    });
  }

  // Governance stabilization: look for mitigation entries followed by score improvements
  const mitigationEntries = dataPoints.filter((d) => d.memoryType === 'mitigation_comparison');
  if (mitigationEntries.length >= 2) {
    insights.push({
      id: randomUUID(),
      insightType: 'effective_intervention' as LearningInsightType,
      headline: `${mitigationEntries.length} mitigation comparisons recorded — organizational governance learning is active`,
      explanation: `The organization has recorded ${mitigationEntries.length} mitigation comparison events, demonstrating active governance learning behavior.`,
      evidenceDataPoints: mitigationEntries.slice(0, 3),
      supportingCount: mitigationEntries.length,
      confidence: 'high',
      governanceImplication: 'Active mitigation comparison is a leading indicator of governance maturity.',
      suggestedAction: 'Link mitigation outcomes to resilience score changes to improve future decision quality.',
      detectedAt: new Date().toISOString(),
    });
  }

  // Stagnation pattern: many entries but flat scores
  if (withScores.length >= 4 && trend === 'stable' && Math.abs(delta) < 3) {
    const recent = scores.slice(-3);
    const recentVariance = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (Math.abs(recentVariance - last) < 2) {
      insights.push({
        id: randomUUID(),
        insightType: 'stagnation_pattern' as LearningInsightType,
        headline: 'Resilience score has plateaued — new governance investments may be needed',
        explanation: `Despite ${withScores.length} measurement periods, resilience remains near ${last}. The organization may have exhausted current strategy effectiveness.`,
        evidenceDataPoints: withScores.slice(-4),
        supportingCount: withScores.length,
        confidence: 'medium',
        governanceImplication: 'Plateaued resilience suggests existing governance strategies are exhausted.',
        suggestedAction: 'Review the resilience roadmap for higher-impact continuity investments.',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Data density insight: if there's rich history
  if (dataPoints.length >= 10) {
    insights.push({
      id: randomUUID(),
      insightType: 'governance_stabilization' as LearningInsightType,
      headline: `Rich organizational memory: ${dataPoints.length} cognition entries recorded`,
      explanation: `This organization has developed substantial organizational memory depth with ${dataPoints.length} cognition entries, enabling adaptive governance learning.`,
      evidenceDataPoints: [],
      supportingCount: dataPoints.length,
      confidence: 'high',
      governanceImplication: 'Deep organizational memory enables adaptive, evidence-based governance planning.',
      suggestedAction: 'Leverage historical cognition memory when planning future continuity investments.',
      detectedAt: new Date().toISOString(),
    });
  }

  return insights;
}

/**
 * Analyze organizational continuity history to produce learning intelligence.
 */
export async function analyzeInstitutionalLearning(
  orgId: string,
): Promise<InstitutionalLearningReport> {
  const store = await loadCognitionMemory(orgId, { limit: 100 });

  const dataPoints: LearningDataPoint[] = store.entries.map((e) => ({
    capturedAt: e.createdAt,
    resilienceScore: e.resilienceScoreAtCapture ?? -1,
    memoryEntryId: e.id,
    memoryType: e.memoryType,
    title: e.title,
  }));

  const withScores = store.resilienceTimeline;
  const scores = withScores.map((p) => p.resilienceScore);

  const trend = computeTrend(scores);
  const first = scores[0] ?? 0;
  const last = scores[scores.length - 1] ?? 0;
  const totalChange = scores.length >= 2 ? last - first : 0;
  const averageChange = scores.length >= 2 ? totalChange / (scores.length - 1) : 0;

  let periodDays: number | null = null;
  if (withScores.length >= 2) {
    const earliest = new Date(withScores[0].capturedAt).getTime();
    const latest = new Date(withScores[withScores.length - 1].capturedAt).getTime();
    periodDays = Math.round((latest - earliest) / (1000 * 60 * 60 * 24));
  }

  const resilienceEvolution: ResilienceEvolutionIndicator = {
    trend,
    totalChange,
    averageChangePerEntry: Math.round(averageChange * 10) / 10,
    peak: scores.length > 0 ? Math.max(...scores) : 0,
    trough: scores.length > 0 ? Math.min(...scores) : 0,
    dataPointCount: scores.length,
    periodDays,
  };

  const insights = extractInsights(dataPoints);

  const maturityScore = computeMaturityScore(resilienceEvolution, insights.length, dataPoints.length);
  const stage = maturityStage(maturityScore);

  const primaryDrivers: string[] = [];
  const primaryLimiters: string[] = [];

  if (dataPoints.length >= 10) primaryDrivers.push('Rich organizational memory depth');
  if (trend === 'improving') primaryDrivers.push('Positive resilience trajectory');
  if (insights.some((i) => i.insightType === 'effective_intervention')) primaryDrivers.push('Active mitigation governance');

  if (dataPoints.length < 5) primaryLimiters.push('Insufficient cognition memory history');
  if (trend === 'declining') primaryLimiters.push('Declining resilience trajectory');
  if (trend === 'stable') primaryLimiters.push('Resilience improvement has plateaued');
  if (scores.length < 3) primaryLimiters.push('Too few resilience measurements to establish trend');

  const advancementMap: Record<string, string> = {
    nascent: 'Begin capturing cognition memory and resilience baselines regularly.',
    emerging: 'Increase frequency of governance reasoning sessions and mitigation comparisons.',
    developing: 'Focus on linking mitigation outcomes to measurable resilience improvements.',
    established: 'Invest in governance diversification and dependency reduction strategies.',
    advanced: 'Target high-impact resilience dimensions identified by adaptive modeling.',
    leading: 'Share organizational governance patterns to strengthen organizational learning networks.',
  };

  const maturityAssessment: LearningMaturityAssessment = {
    maturityScore,
    maturityStage: stage,
    primaryDrivers: primaryDrivers.length > 0 ? primaryDrivers : ['Organizational continuity awareness'],
    primaryLimiters: primaryLimiters.length > 0 ? primaryLimiters : ['Further history needed to identify limiters'],
    advancementFocus: advancementMap[stage] ?? 'Continue building organizational memory.',
  };

  const summaryMap: Record<string, string> = {
    improving: `Organizational resilience has improved by ${totalChange} points over ${dataPoints.length} cognition entries, indicating effective continuity governance.`,
    declining: `Organizational resilience has declined by ${Math.abs(totalChange)} points, indicating continuity governance requires renewed attention.`,
    stable: `Organizational resilience is stable at approximately ${last} points with ${dataPoints.length} cognition entries recorded.`,
    volatile: `Organizational resilience shows high volatility, suggesting continuity gains need consolidation through stronger governance practices.`,
    insufficient_data: `Insufficient continuity history to establish a resilience trend. Continue building organizational memory.`,
  };

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    insights,
    resilienceEvolution,
    maturityAssessment,
    entriesAnalyzed: dataPoints.length,
    summary: summaryMap[trend] ?? 'Organizational learning analysis complete.',
  };
}
