/**
 * Organizational Learning Models
 *
 * Data structures for organizational continuity learning intelligence.
 *
 * The system learns from:
 * - resilience score trajectories
 * - mitigation intervention history
 * - governance reasoning evolution
 * - continuity session outcomes
 *
 * NOT employee performance. Organizational continuity effectiveness only.
 */

export type LearningInsightType =
  | 'resilience_improvement'
  | 'resilience_regression'
  | 'effective_intervention'
  | 'recurring_failure'
  | 'governance_stabilization'
  | 'dependency_reduction'
  | 'stagnation_pattern';

export type LearningConfidence = 'high' | 'medium' | 'low' | 'insufficient_data';

export interface LearningDataPoint {
  capturedAt: string;
  resilienceScore: number;
  memoryEntryId: string;
  memoryType: string;
  title: string;
}

export interface LearningInsight {
  id: string;
  insightType: LearningInsightType;
  /** Short headline */
  headline: string;
  /** Detailed explanation */
  explanation: string;
  /** Quantified evidence */
  evidenceDataPoints: LearningDataPoint[];
  /** How many sessions/entries support this insight */
  supportingCount: number;
  confidence: LearningConfidence;
  /** Governance implication of this learning */
  governanceImplication: string;
  /** Suggested organizational action */
  suggestedAction: string;
  detectedAt: string;
}

export interface ResilienceEvolutionIndicator {
  /** Direction of organizational resilience over measured period */
  trend: 'improving' | 'stable' | 'declining' | 'volatile' | 'insufficient_data';
  /** Change in resilience score from first to latest snapshot */
  totalChange: number;
  /** Average change per entry */
  averageChangePerEntry: number;
  /** Max resilience score observed */
  peak: number;
  /** Min resilience score observed */
  trough: number;
  /** Number of data points used */
  dataPointCount: number;
  /** Period covered (days) */
  periodDays: number | null;
}

export interface LearningMaturityAssessment {
  /**
   * How mature is the org's learning posture?
   * scored 0-100 based on: data density, trend direction, intervention effectiveness
   */
  maturityScore: number;
  /** Stage label */
  maturityStage:
    | 'nascent'
    | 'emerging'
    | 'developing'
    | 'established'
    | 'advanced'
    | 'leading';
  /** What's driving the current maturity level */
  primaryDrivers: string[];
  /** What's holding maturity back */
  primaryLimiters: string[];
  /** Recommended focus to advance maturity */
  advancementFocus: string;
}

export interface InstitutionalLearningReport {
  organizationId: string;
  generatedAt: string;
  /** Core learning insights extracted from history */
  insights: LearningInsight[];
  /** Resilience trajectory analysis */
  resilienceEvolution: ResilienceEvolutionIndicator;
  /** Overall learning maturity */
  maturityAssessment: LearningMaturityAssessment;
  /** How many memory entries were analyzed */
  entriesAnalyzed: number;
  /** Summary narrative */
  summary: string;
}
