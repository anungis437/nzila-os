/**
 * Federated Intelligence Engine
 *
 * Generates privacy-safe benchmarking intelligence.
 * Uses a reference maturity distribution to position an organization
 * without exposing cross-org data.
 *
 * CRITICAL: No cross-org data leakage.
 * Reference distributions are based on static organizational governance research,
 * not on other organizations' live data.
 *
 * All outputs are governance-safe and privacy-preserving.
 */

import { calculateResilienceIndex } from '@/lib/knowledge-transfer/resilience-index/resilience-calculator';
import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import type {
  FederatedBenchmarkResult,
  OrgBenchmarkPosition,
  BenchmarkDimensionComparison,
  PrivacySafeMaturityCurve,
  BenchmarkPercentileRange,
  MaturityCohort,
} from './federated-models';

/**
 * Reference maturity distribution based on organizational governance research.
 * These are calibrated reference points — not derived from any specific organization.
 */
const REFERENCE_DISTRIBUTION: BenchmarkPercentileRange[] = [
  { percentile: 10, scoreAtPercentile: 15, cohortLabel: 'nascent', description: 'Minimal continuity governance — early-stage organizational awareness.' },
  { percentile: 25, scoreAtPercentile: 28, cohortLabel: 'emerging', description: 'Basic continuity practices — some documentation, limited resilience.' },
  { percentile: 40, scoreAtPercentile: 42, cohortLabel: 'developing', description: 'Active continuity governance — growing documentation and process redundancy.' },
  { percentile: 50, scoreAtPercentile: 52, cohortLabel: 'developing', description: 'Median organizational continuity posture — moderate resilience with known gaps.' },
  { percentile: 60, scoreAtPercentile: 60, cohortLabel: 'established', description: 'Established continuity governance — systematic documentation and risk mitigation.' },
  { percentile: 75, scoreAtPercentile: 70, cohortLabel: 'established', description: 'Strong continuity posture — proactive governance with measurable resilience.' },
  { percentile: 85, scoreAtPercentile: 78, cohortLabel: 'advanced', description: 'Advanced organizational continuity — diversified knowledge and governance depth.' },
  { percentile: 95, scoreAtPercentile: 88, cohortLabel: 'leading', description: 'Leading continuity intelligence — adaptive governance with continuous learning.' },
];

/** Cohort band definitions */
const COHORT_BANDS = [
  { cohort: 'nascent' as MaturityCohort, minScore: 0, maxScore: 20, midpointScore: 10, description: 'Minimal continuity governance infrastructure' },
  { cohort: 'emerging' as MaturityCohort, minScore: 21, maxScore: 40, midpointScore: 30, description: 'Basic continuity practices being established' },
  { cohort: 'developing' as MaturityCohort, minScore: 41, maxScore: 55, midpointScore: 48, description: 'Active continuity governance with growing depth' },
  { cohort: 'established' as MaturityCohort, minScore: 56, maxScore: 70, midpointScore: 63, description: 'Systematic continuity governance and risk management' },
  { cohort: 'advanced' as MaturityCohort, minScore: 71, maxScore: 85, midpointScore: 78, description: 'Advanced continuity intelligence and governance depth' },
  { cohort: 'leading' as MaturityCohort, minScore: 86, maxScore: 100, midpointScore: 93, description: 'Adaptive organizational continuity intelligence' },
];

/** Cohort average scores for dimension comparisons */
const COHORT_DIMENSION_AVERAGES: Record<MaturityCohort, number> = {
  nascent: 10,
  emerging: 30,
  developing: 48,
  established: 63,
  advanced: 78,
  leading: 93,
};

function scoreToCohort(score: number): MaturityCohort {
  for (const band of COHORT_BANDS) {
    if (score >= band.minScore && score <= band.maxScore) return band.cohort;
  }
  return score > 85 ? 'leading' : 'nascent';
}

function scoreToPercentile(score: number): number {
  // Interpolate percentile from reference distribution
  for (let i = 0; i < REFERENCE_DISTRIBUTION.length - 1; i++) {
    const lower = REFERENCE_DISTRIBUTION[i];
    const upper = REFERENCE_DISTRIBUTION[i + 1];
    if (score >= lower.scoreAtPercentile && score <= upper.scoreAtPercentile) {
      const fraction =
        (score - lower.scoreAtPercentile) /
        (upper.scoreAtPercentile - lower.scoreAtPercentile);
      return Math.round(lower.percentile + fraction * (upper.percentile - lower.percentile));
    }
  }
  if (score < REFERENCE_DISTRIBUTION[0].scoreAtPercentile) return 5;
  return 97;
}

/**
 * Generate privacy-safe federated benchmark for an organization.
 */
export async function generateFederatedBenchmark(
  orgId: string,
): Promise<FederatedBenchmarkResult> {
  const [resilienceIndex, store] = await Promise.all([
    calculateResilienceIndex(orgId),
    loadCognitionMemory(orgId, { limit: 50 }),
  ]);

  const currentScore = resilienceIndex.overallScore;
  const cohort = scoreToCohort(currentScore);
  const percentile = scoreToPercentile(currentScore);

  // Next cohort
  const currentBandIdx = COHORT_BANDS.findIndex((b) => b.cohort === cohort);
  const nextBand = COHORT_BANDS[currentBandIdx + 1] ?? null;
  const pointsToNext = nextBand ? Math.max(nextBand.minScore - currentScore, 0) : 0;

  const positionDescriptions: Record<MaturityCohort, string> = {
    nascent: 'Continuity governance infrastructure is in its early stages. Foundation-building is the priority.',
    emerging: 'Basic continuity practices are being established. Systematic documentation would accelerate progression.',
    developing: 'Active continuity governance with growing organizational depth. Targeting established governance practices is the logical next step.',
    established: 'Strong continuity posture with systematic governance. Investing in resilience diversification would advance maturity.',
    advanced: 'Advanced organizational continuity intelligence. Continuous learning and adaptive governance are hallmarks of this level.',
    leading: 'Leading continuity intelligence posture. Adaptive, evidence-grounded governance with deep organizational memory.',
  };

  const orgPosition: OrgBenchmarkPosition = {
    currentScore,
    cohort,
    estimatedPercentile: percentile,
    pointsToNextCohort: pointsToNext,
    nextCohort: nextBand?.cohort ?? null,
    positionDescription: positionDescriptions[cohort] ?? '',
  };

  // Dimension comparisons
  const cohortAvg = COHORT_DIMENSION_AVERAGES[cohort];
  const dimensionComparisons: BenchmarkDimensionComparison[] = resilienceIndex.dimensions.map(
    (dim) => {
      const gap = dim.score - cohortAvg;
      const relativePosition: BenchmarkDimensionComparison['relativePosition'] =
        gap >= 5 ? 'above_cohort' : gap <= -5 ? 'below_cohort' : 'at_cohort';

      const insightMap: Record<string, string> = {
        above_cohort: `${dim.name} exceeds typical ${cohort}-level governance — a continuity strength.`,
        at_cohort: `${dim.name} aligns with typical ${cohort}-level governance posture.`,
        below_cohort: `${dim.name} is below typical ${cohort}-level posture — a priority area for investment.`,
      };

      return {
        dimensionName: dim.name,
        orgScore: dim.score,
        cohortAverageScore: cohortAvg,
        relativePosition,
        gapToCohortAverage: Math.round(gap),
        insight: insightMap[relativePosition] ?? '',
      };
    },
  );

  // Previous position from timeline
  const timeline = store.resilienceTimeline;
  const previousScore =
    timeline.length >= 2 ? timeline[timeline.length - 2].resilienceScore : null;

  const maturityCurve: PrivacySafeMaturityCurve = {
    cohortBands: COHORT_BANDS,
    orgPosition: currentScore,
    previousPosition: previousScore,
  };

  // Cohort-specific insights
  const cohortInsights: string[] = [
    `At ${percentile}th percentile, this organization's continuity posture is ${cohort}-level.`,
    positionDescriptions[cohort],
    nextBand
      ? `${pointsToNext} resilience points separate this organization from ${nextBand.cohort}-level continuity governance.`
      : 'This organization has achieved leading-level continuity governance maturity.',
    dimensionComparisons.filter((d) => d.relativePosition === 'above_cohort').length > 0
      ? `Strengths above cohort average: ${dimensionComparisons.filter((d) => d.relativePosition === 'above_cohort').map((d) => d.dimensionName).join(', ')}.`
      : 'All dimensions are at or below cohort average — comprehensive investment would advance maturity.',
    previousScore !== null
      ? `Resilience has ${currentScore >= previousScore ? 'improved' : 'declined'} from ${previousScore} to ${currentScore} since last measurement.`
      : 'Establish regular resilience baselines to track positioning over time.',
  ];

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    orgPosition,
    dimensionComparisons,
    maturityCurve,
    percentileReference: REFERENCE_DISTRIBUTION,
    cohortInsights,
    disclaimer:
      'Benchmarking uses reference distributions based on organizational governance research. No cross-organization data is used. This is privacy-safe positioning intelligence, not competitive comparison.',
  };
}
