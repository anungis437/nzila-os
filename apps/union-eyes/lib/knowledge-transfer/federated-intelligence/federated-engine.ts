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
 * The earlier reference percentile table and cohort averages were literals with no named source, population or date, and the
 * result stated a percentile and a cohort average from them. They are removed: the result keeps the score bands (a rubric the
 * product defines) and compares each dimension with the midpoint of the band the organization is in.
 */
const REFERENCE_DISTRIBUTION: BenchmarkPercentileRange[] = [];
/** Cohort band definitions */
const COHORT_BANDS = [
  { cohort: 'nascent' as MaturityCohort, minScore: 0, maxScore: 20, midpointScore: 10, description: 'Minimal continuity governance infrastructure' },
  { cohort: 'emerging' as MaturityCohort, minScore: 21, maxScore: 40, midpointScore: 30, description: 'Basic continuity practices being established' },
  { cohort: 'developing' as MaturityCohort, minScore: 41, maxScore: 55, midpointScore: 48, description: 'Active continuity governance with growing depth' },
  { cohort: 'established' as MaturityCohort, minScore: 56, maxScore: 70, midpointScore: 63, description: 'Systematic continuity governance and risk management' },
  { cohort: 'advanced' as MaturityCohort, minScore: 71, maxScore: 85, midpointScore: 78, description: 'Advanced continuity intelligence and governance depth' },
  { cohort: 'leading' as MaturityCohort, minScore: 86, maxScore: 100, midpointScore: 93, description: 'Adaptive organizational continuity intelligence' },
];

function scoreToCohort(score: number): MaturityCohort {
  for (const band of COHORT_BANDS) {
    if (score >= band.minScore && score <= band.maxScore) return band.cohort;
  }
  return score > 85 ? 'leading' : 'nascent';
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
    estimatedPercentile: null,
    pointsToNextCohort: pointsToNext,
    nextCohort: nextBand?.cohort ?? null,
    positionDescription: positionDescriptions[cohort] ?? '',
  };

  // Dimension comparisons
  const bandMidpoint = COHORT_BANDS.find((b) => b.cohort === cohort)?.midpointScore ?? 0;
  const dimensionComparisons: BenchmarkDimensionComparison[] = resilienceIndex.dimensions.map(
    (dim) => {
      const gap = dim.score - bandMidpoint;
      const relativePosition: BenchmarkDimensionComparison['relativePosition'] =
        gap >= 5 ? 'above_band_midpoint' : gap <= -5 ? 'below_band_midpoint' : 'at_band_midpoint';

      const insightMap: Record<string, string> = {
        above_band_midpoint: `${dim.name} is above the midpoint of the ${cohort} score band.`,
        at_band_midpoint: `${dim.name} is near the midpoint of the ${cohort} score band.`,
        below_band_midpoint: `${dim.name} is below the midpoint of the ${cohort} score band.`,
      };

      return {
        dimensionName: dim.name,
        orgScore: dim.score,
        bandMidpointScore: bandMidpoint,
        relativePosition,
        gapToBandMidpoint: Math.round(gap),
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
    `This organization's resilience score of ${currentScore} falls in the ${cohort} score band.`,
    positionDescriptions[cohort],
    nextBand
      ? `${pointsToNext} resilience points separate this organization from ${nextBand.cohort}-level continuity governance.`
      : 'This organization has achieved leading-level continuity governance maturity.',
    dimensionComparisons.filter((d) => d.relativePosition === 'above_band_midpoint').length > 0
      ? `Dimensions above the band midpoint: ${dimensionComparisons.filter((d) => d.relativePosition === 'above_band_midpoint').map((d) => d.dimensionName).join(', ')}.`
      : 'No dimension is above the band midpoint.',
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
    referenceStatus: 'UNSOURCED_RUBRIC_NO_POPULATION',
    cohortInsights,
    disclaimer:
      'The score bands are a rubric defined by this product, not a measurement of other organizations: no population, source or date supports a percentile or a cohort average, and none is reported. No cross-organization data is used.',
  };
}
