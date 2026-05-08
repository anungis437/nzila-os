/**
 * Federated Intelligence Models
 *
 * Data structures for privacy-safe cross-organization continuity benchmarking.
 *
 * CRITICAL: NO cross-org data leakage.
 * - Anonymize aggressively
 * - Preserve organizational sovereignty
 * - Prevent operational reconstruction
 * - No identifiable continuity details exposed
 *
 * This is institutional learning patterns — NOT competitive intelligence.
 */

export type MaturityCohort =
  | 'nascent'        // score 0-20
  | 'emerging'       // score 21-40
  | 'developing'     // score 41-55
  | 'established'    // score 56-70
  | 'advanced'       // score 71-85
  | 'leading';       // score 86-100

export interface BenchmarkPercentileRange {
  percentile: number;
  scoreAtPercentile: number;
  cohortLabel: MaturityCohort;
  description: string;
}

export interface OrgBenchmarkPosition {
  /** Current org's resilience score */
  currentScore: number;
  /** Which cohort the org belongs to */
  cohort: MaturityCohort;
  /** Approximate percentile (computed from reference distribution) */
  estimatedPercentile: number;
  /** Score needed to reach next cohort */
  pointsToNextCohort: number;
  /** Label of next cohort */
  nextCohort: MaturityCohort | null;
  /** Qualitative positioning description */
  positionDescription: string;
}

export interface BenchmarkDimensionComparison {
  dimensionName: string;
  orgScore: number;
  cohortAverageScore: number;
  relativePosition: 'above_cohort' | 'at_cohort' | 'below_cohort';
  gapToCohortAverage: number;
  /** Privacy-safe insight about this dimension */
  insight: string;
}

export interface PrivacySafeMaturityCurve {
  /** Reference cohort data points (no org identifiers) */
  cohortBands: Array<{
    cohort: MaturityCohort;
    minScore: number;
    maxScore: number;
    midpointScore: number;
    description: string;
  }>;
  /** Where this org's score falls on the curve */
  orgPosition: number;
  /** Where this org was N entries ago */
  previousPosition: number | null;
}

export interface FederatedBenchmarkResult {
  organizationId: string;
  generatedAt: string;
  /** How this org compares to reference maturity distribution */
  orgPosition: OrgBenchmarkPosition;
  /** Per-dimension comparisons against cohort averages */
  dimensionComparisons: BenchmarkDimensionComparison[];
  /** Privacy-safe maturity curve */
  maturityCurve: PrivacySafeMaturityCurve;
  /** Reference percentile distribution (no org data) */
  percentileReference: BenchmarkPercentileRange[];
  /** Governance-safe insights based on cohort positioning */
  cohortInsights: string[];
  disclaimer: string;
}
