/**
 * CLC Decision Intelligence — Core Contracts
 *
 * Shared type definitions for the decision intelligence layer.
 * These types are consumed by correlation, reasoning, recommendations,
 * and UI components.
 *
 * @module contracts
 */

// ── Decision Intelligence Output ────────────────────────────────────────────

/**
 * The core output unit of the decision intelligence layer.
 * Every major insight can be expressed as a DecisionInsight.
 */
export interface DecisionInsight {
  /** Stable identifier (e.g. "DI-CONC-healthcare-2026Q2") */
  id: string;
  /** Short action-oriented headline */
  headline: string;
  /** 2-3 sentence narrative summary */
  summary: string;
  /** Why this matters for CLC leadership */
  significance: string;
  /** Composite confidence (0-1) from the confidence model */
  confidence: number;
  /** Confidence band derived from confidence score */
  confidenceBand: ConfidenceBand;
  /** Watch level for leadership prioritization */
  watchLevel: 'monitor' | 'elevated' | 'high' | 'critical';
  /** Recommended action */
  recommendedAction: 'monitor' | 'prepare' | 'escalate' | 'intervene';
  /** When action should be taken */
  timeframe: 'now' | '7_days' | '30_days' | 'pre_bargaining' | 'this_quarter';
  /** Data references supporting this insight */
  evidenceRefs: string[];
  /** Source signal type(s) */
  sourceSignalTypes: string[];
  /** When this insight was generated */
  generatedAt: string;
}

// ── Confidence Band ──────────────────────────────────────────────────────────

/** Named type for confidence score bands */
export type ConfidenceBand = 'low' | 'medium' | 'high';

// ── Confidence Model ────────────────────────────────────────────────────────

export interface ConfidenceInputs {
  /** Number of contributing organizations in the cohort */
  cohortSize: number;
  /** How recent the data is (days since most recent data point) */
  recencyDays: number;
  /** Agreement across independent signals (0-1, 1 = all agree) */
  signalAgreement: number;
  /** Number of independent data sources */
  sourceCount: number;
  /** How long the pattern has persisted (0-1, 1 = multi-quarter) */
  persistenceScore: number;
  /** Penalty for missing or incomplete data (0-1, 0 = complete) */
  missingDataPenalty: number;
}

export interface ConfidenceResult {
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Human-readable band */
  confidenceBand: ConfidenceBand;
  /** Explanation of confidence calculation */
  confidenceExplanation: string;
  /** Breakdown by factor */
  factors: {
    cohortFactor: number;
    recencyFactor: number;
    agreementFactor: number;
    sourceFactor: number;
    persistenceFactor: number;
    missingDataFactor: number;
  };
}

// ── Correlated Patterns ─────────────────────────────────────────────────────

export type PatternType =
  | 'cross_affiliate_issue_cluster'
  | 'cross_sector_shift'
  | 'employer_pattern'
  | 'precedent_concentration'
  | 'bargaining_pressure_signal';

export interface CorrelatedPattern {
  /** Stable identifier */
  id: string;
  /** Type of correlation detected */
  patternType: PatternType;
  /** Short headline */
  title: string;
  /** Narrative summary */
  summary: string;
  /** Sectors involved */
  affectedSectors: string[];
  /** Affiliate types involved (aggregate-safe) */
  affectedAffiliateTypes: string[];
  /** Composite confidence (0-1) */
  confidence: number;
  /** Watch level */
  watchLevel: 'monitor' | 'elevated' | 'high' | 'critical';
  /** Data references */
  evidenceRefs: string[];
}

// ── Time-Series Intelligence ────────────────────────────────────────────────

export type TrendDirection = 'rising' | 'falling' | 'stable' | 'volatile';

export type TrendClassification =
  | 'rising_steadily'
  | 'sudden_spike'
  | 'persistent_elevated'
  | 'returning_to_baseline'
  | 'pre_bargaining_acceleration'
  | 'gradual_decline'
  | 'stable'
  | 'volatile';

export interface TimeSeriesPoint {
  /** ISO-8601 date or period label */
  period: string;
  /** Numeric value */
  value: number;
}

export interface TrendAnalysis {
  /** Direction of the trend */
  direction: TrendDirection;
  /** Detailed classification */
  classification: TrendClassification;
  /** Rate of change per period */
  velocity: number;
  /** Change in velocity (acceleration/deceleration) */
  acceleration: number;
  /** Whether an inflection point was detected */
  hasInflectionPoint: boolean;
  /** Period of inflection (if any) */
  inflectionPeriod: string | null;
  /** Whether the signal is a sustained trend vs short spike */
  isPersistent: boolean;
  /** Persistence score (0-1, higher = more sustained) */
  persistenceScore: number;
  /** Human-readable description */
  description: string;
}

// ── Recommendations ─────────────────────────────────────────────────────────

export type RecommendedAction = 'monitor' | 'prepare' | 'escalate' | 'intervene';

export type ActionTimeframe = 'now' | '7_days' | '30_days' | 'pre_bargaining' | 'this_quarter';

export type TargetAudience =
  | 'clc_executive'
  | 'clc_staff'
  | 'federation_leadership'
  | 'research_policy_team';

export interface DecisionRecommendation {
  /** Stable identifier */
  id: string;
  /** Which signal/pattern triggered this recommendation */
  signalId: string;
  /** What to do */
  recommendedAction: RecommendedAction;
  /** Why this action */
  rationale: string;
  /** When to act */
  timeframe: ActionTimeframe;
  /** Who should act */
  targetAudience: TargetAudience;
  /** How confident we are in this recommendation */
  confidence: number;
}

// ── Data Products ───────────────────────────────────────────────────────────

export interface MovementRiskPosture {
  /** Overall posture level */
  posture: 'steady' | 'vigilant' | 'heightened';
  /** Top current watch areas (pattern titles) */
  watchAreas: string[];
  /** Rising sectors (sector names from bargaining/shift patterns) */
  risingSectors: string[];
  /** Active issue clusters (pattern titles) */
  issueClusters: string[];
  /** Confidence-weighted posture summary */
  summary: string;
  /** Overall confidence */
  confidence: number;
}

export interface SectorDivergence {
  /** Sector being analyzed */
  sector: string;
  /** How far from the movement baseline */
  divergenceScore: number;
  /** What is unique to this sector vs. common */
  uniqueFactors: string[];
  /** Common factors shared with movement baseline */
  commonFactors: string[];
  /** Velocity of divergence */
  velocity: number;
  /** Trend classification */
  classification: TrendClassification;
}

export interface BargainingWatch {
  /** Sectors with bargaining-relevant signals */
  sectors: string[];
  /** Headline summary */
  headline: string;
  /** Preparation indicators */
  preparationIndicators: string[];
  /** Concentration + persistence assessment */
  signalStrength: 'weak' | 'moderate' | 'strong';
  /** Recommended action */
  recommendedAction: RecommendedAction;
  /** Confidence */
  confidence: number;
  /** Evidence references */
  evidenceRefs: string[];
}

export interface ExecutiveBriefingCard {
  /** Stable identifier */
  id: string;
  /** Category for grouping */
  category: 'risk' | 'opportunity' | 'trend' | 'governance';
  /** Headline */
  headline: string;
  /** Why this matters */
  significance: string;
  /** Confidence score */
  confidence: number;
  /** Confidence band */
  confidenceBand: ConfidenceBand;
  /** Recommended action */
  recommendedAction: RecommendedAction;
  /** Timeframe */
  timeframe: ActionTimeframe;
  /** Watch level */
  watchLevel: 'monitor' | 'elevated' | 'high' | 'critical';
  /** Evidence references */
  evidenceRefs: string[];
}

// ── NIL Prompt Contracts ────────────────────────────────────────────────────

export interface DecisionPromptContract {
  /** Stable use-case key */
  useCase: string;
  /** Version for schema evolution */
  version: string;
  /** App identifier */
  app: 'union-eyes';
  /** System prompt */
  systemPrompt: string;
  /** Required output fields (for validation) */
  requiredOutputFields: string[];
  /** Anonymization rules */
  anonymizationRules: string[];
  /** Build input payload from governed aggregates */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildInput: (data: any) => Record<string, unknown>;
}

// ── Audit Extensions ────────────────────────────────────────────────────────

export interface DecisionAuditContext {
  /** Analytics scope */
  scope: 'clc' | 'federation';
  /** Whether NIL was invoked */
  nilInvoked: boolean;
  /** Whether recommendations were returned */
  recommendationReturned: boolean;
  /** Signal types included in response */
  signalTypesReturned: string[];
  /** Query filters applied */
  filtersApplied: Record<string, unknown>;
  /** Cohort health at time of query */
  cohortBand: 'healthy' | 'marginal' | 'insufficient';
}
