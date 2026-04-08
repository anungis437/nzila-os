/**
 * CLC Executive Intelligence — Core Contracts
 *
 * Shared type definitions for the executive intelligence layer.
 * These types sit above the decision-intelligence contracts and
 * define executive-grade outputs: priorities, summaries, deltas,
 * action briefs, and NIL prompt contracts.
 *
 * @module contracts
 */

import type {
  CorrelatedPattern,
  DecisionRecommendation,
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
  DecisionIntelligenceOutput,
  ConfidenceBand,
  RecommendedAction,
  ActionTimeframe,
  DecisionPromptContract,
} from '@nzila/clc-decision-intelligence';

// Re-export upstream types needed by consumers
export type {
  CorrelatedPattern,
  DecisionRecommendation,
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
  DecisionIntelligenceOutput,
  ConfidenceBand,
  RecommendedAction,
  ActionTimeframe,
  DecisionPromptContract,
};

// ── Executive Priority ──────────────────────────────────────────────────────

export type WatchLevel = 'monitor' | 'elevated' | 'high' | 'critical';

/**
 * A ranked executive priority — the unit output of the prioritization engine.
 */
export interface ExecutivePriority {
  /** Stable identifier */
  id: string;
  /** Short action-oriented title */
  title: string;
  /** Watch level for leadership attention */
  watchLevel: WatchLevel;
  /** Recommended action */
  recommendedAction: RecommendedAction;
  /** When action should be taken */
  timeframe: ActionTimeframe;
  /** Composite confidence (0-1) */
  confidence: number;
  /** Why this matters for leadership right now */
  whyItMatters: string;
  /** Data references backing this priority */
  evidenceRefs: string[];
  /** Source types that contributed (pattern types, trend, recommendation, etc.) */
  sourceTypes: string[];
  /** Computed priority score (higher = more important) */
  priorityScore: number;
}

// ── Movement Summary ────────────────────────────────────────────────────────

export type MovementPosture = 'steady' | 'vigilant' | 'heightened';

/**
 * Executive-facing movement summary — synthesized narrative.
 */
export interface MovementSummary {
  /** One-sentence headline */
  headline: string;
  /** 2-4 sentence executive summary */
  summary: string;
  /** Overall posture */
  posture: MovementPosture;
  /** Composite confidence (0-1) */
  confidence: number;
  /** Top signals driving this posture */
  dominantSignals: string[];
  /** Why this posture right now (contextual explanation) */
  whyNow: string;
}

// ── Executive Delta (What Changed) ──────────────────────────────────────────

export type DeltaDirection = 'up' | 'down' | 'new' | 'resolved';

/**
 * A single change between two executive intelligence snapshots.
 */
export interface ExecutiveDelta {
  /** Stable identifier */
  id: string;
  /** Short description of the change */
  title: string;
  /** Direction of change */
  direction: DeltaDirection;
  /** Human-readable explanation */
  explanation: string;
  /** Confidence in this change detection */
  confidence: number;
  /** Previous state (if applicable) */
  previousState?: string;
  /** Current state */
  currentState?: string;
}

// ── Executive Intelligence Snapshot (for persistence) ────────────────────────

/**
 * A point-in-time snapshot of executive intelligence state.
 * Used for delta comparison between review cycles.
 */
export interface ExecutiveSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** When this snapshot was taken */
  generatedAt: string;
  /** Posture at snapshot time */
  posture: MovementPosture;
  /** Overall confidence */
  confidence: number;
  /** Pattern IDs active at snapshot time */
  activePatternIds: string[];
  /** Watch levels for each active pattern */
  patternWatchLevels: Record<string, WatchLevel>;
  /** Recommendation action counts */
  actionCounts: Record<RecommendedAction, number>;
  /** Top priority IDs */
  topPriorityIds: string[];
  /** Sectors with elevated+ divergence */
  divergentSectors: string[];
  /** Whether bargaining watch was active */
  bargainingWatchActive: boolean;
  /** Number of briefing cards */
  briefingCardCount: number;
}

// ── Executive Action Brief ──────────────────────────────────────────────────

/**
 * The top-level executive artifact — a complete action brief
 * suitable for dashboard display and leadership briefing prep.
 */
export interface ExecutiveActionBrief {
  /** When this brief was generated */
  generatedAt: string;
  /** Overall movement posture */
  posture: MovementPosture;
  /** One-sentence headline */
  headline: string;
  /** Executive summary */
  summary: string;
  /** Ranked top priorities */
  topPriorities: ExecutivePriority[];
  /** What changed since last review */
  whatChanged: ExecutiveDelta[];
  /** Concrete next steps */
  recommendedNextSteps: string[];
  /** Overall confidence */
  confidence: number;
  /** Evidence references */
  evidenceRefs: string[];
  /** Whether NIL was used for narrative generation */
  nilInvoked: boolean;
  /** Whether time-series data was available */
  usedTimeSeries: boolean;
  /** Ordered action sequence (Section 4) */
  actionSequence?: ActionSequence;
  /** The single most important priority (Section 5) */
  topOnePriority?: TopOnePriority;
  /** Strategic narrative (Section 8) */
  strategicNarrative?: StrategicNarrative;
  /** Multi-signal analysis (Section 2) */
  multiSignalAnalysis?: MultiSignalAnalysis;
  /** Decision mode used (Section 10) */
  decisionMode?: DecisionMode;
}

// ── NIL Runtime Interface ───────────────────────────────────────────────────

/**
 * NIL reasoning service interface.
 * Implementations can be AI-backed or deterministic fallback.
 */
export interface NilReasoningService {
  /**
   * Whether this service is available and ready.
   */
  isAvailable(): boolean;

  /**
   * Generate a narrative refinement for executive output.
   * Returns null if unable to generate (triggers fallback).
   */
  refine(contract: DecisionPromptContract, input: Record<string, unknown>): Promise<NilRefinement | null>;
}

// ── NIL Conflict Resolution (Section 1) ─────────────────────────────────────

/**
 * Output from NIL conflict resolution.
 * NIL can resolve ambiguity between competing signals but
 * NEVER overrides governance, NEVER invents data, MUST cite evidenceRefs.
 */
export interface NilConflictResolution {
  /** The chosen priority direction */
  chosenAction: string;
  /** Alternatives that were rejected */
  rejectedOptions: string[];
  /** Reasoning trace for the decision */
  reasoning: string;
  /** Adjusted confidence (0-1) */
  confidence: number;
  /** Tradeoffs identified */
  tradeoffs: string[];
  /** Evidence references cited */
  evidenceRefs: string[];
}

// ── Multi-Signal Reasoning (Section 2) ──────────────────────────────────────

export type SignalInteractionType = 'reinforcing' | 'conflicting' | 'independent';

/**
 * Result of evaluating multiple signals in combination.
 */
export interface MultiSignalAnalysis {
  /** Combined impact score (0-1) */
  combinedImpactScore: number;
  /** How the signals interact */
  interactionType: SignalInteractionType;
  /** Adjustment factor to apply (-0.3 to +0.3) */
  adjustmentFactor: number;
  /** Which signal pairs were evaluated */
  signalPairs: Array<{
    signalA: string;
    signalB: string;
    interaction: SignalInteractionType;
  }>;
  /** Summary of the combined analysis */
  summary: string;
}

// ── Time-Series Intelligence (Section 3) ─────────────────────────────────────

export type TimeSeriesPatternType = 'spike' | 'sustained_rise' | 'cyclical' | 'declining' | 'volatile' | 'stable';

/**
 * Extended time-series analysis with pattern classification, acceleration,
 * persistence scoring, and lightweight lag correlation.
 */
export interface TimeSeriesIntelligence {
  /** Pattern classification */
  pattern: TimeSeriesPatternType;
  /** Acceleration (change in velocity over time) */
  acceleration: number;
  /** How long the signal has remained elevated (0-1) */
  persistenceScore: number;
  /** Whether persistently elevated */
  isPersistent: boolean;
  /** Lag correlation results (if detected) */
  lagCorrelations: LagCorrelation[];
}

/**
 * Lightweight lag correlation between sectors.
 */
export interface LagCorrelation {
  /** Leading sector */
  leadingSector: string;
  /** Lagging sector */
  laggingSector: string;
  /** Estimated lag in periods */
  lagPeriods: number;
  /** Correlation strength (0-1) */
  correlationStrength: number;
}

// ── Decision Sequencing (Section 4) ──────────────────────────────────────────

/**
 * A single step in an ordered action sequence.
 */
export interface SequencedAction {
  /** Step number (1-based) */
  step: number;
  /** The action to take */
  action: string;
  /** Why this comes at this position */
  rationale: string;
  /** Source priority ID */
  priorityId: string;
  /** Urgency level */
  urgency: RecommendedAction;
  /** Confidence in this step */
  confidence: number;
}

/**
 * A complete ordered action sequence for executive decision-making.
 */
export interface ActionSequence {
  /** Ordered list of actions */
  orderedActions: SequencedAction[];
  /** The primary (step 1) action */
  primaryAction: SequencedAction | null;
  /** Secondary actions (step 2+) */
  secondaryActions: SequencedAction[];
}

// ── Executive Single Focus (Section 5) ──────────────────────────────────────

/**
 * The ONE thing that matters most right now.
 * Derived from the prioritization engine — cuts through list noise.
 */
export interface TopOnePriority {
  /** Priority ID */
  id: string;
  /** Short action-oriented title */
  title: string;
  /** Why this is THE one priority above all others */
  whyThisIsTheOne: string;
  /** The single immediate action to take */
  immediateAction: string;
  /** Timeframe for action */
  timeframe: ActionTimeframe;
  /** Confidence in this selection (0-1) */
  confidence: number;
}

// ── Decision Feedback Loop (Section 6) ──────────────────────────────────────

export type DecisionOutcomeResult = 'success' | 'partial' | 'failure';

/**
 * Tracks the outcome of a recommended action for feedback learning.
 */
export interface DecisionOutcome {
  /** Priority ID this outcome relates to */
  priorityId: string;
  /** What was recommended */
  recommendedAction: string;
  /** What was actually done */
  actionTaken: string;
  /** Outcome category */
  outcome: DecisionOutcomeResult;
  /** Success score (0-1) */
  successScore: number;
  /** Optional notes */
  notes?: string;
  /** When this outcome was recorded */
  createdAt: string;
}

/**
 * Scoring weight adjustments derived from feedback.
 */
export interface WeightAdjustment {
  /** Which scoring factor */
  factor: string;
  /** Previous weight */
  previousWeight: number;
  /** New weight */
  newWeight: number;
  /** Sample size used */
  sampleSize: number;
  /** Reason for adjustment */
  reason: string;
}

/**
 * Recommendation accuracy metrics.
 */
export interface RecommendationAccuracy {
  /** Total outcomes evaluated */
  totalOutcomes: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Partial success rate (0-1) */
  partialRate: number;
  /** Failure rate (0-1) */
  failureRate: number;
  /** Average success score */
  averageSuccessScore: number;
  /** NIL vs deterministic comparison */
  nilVsDeterministic: {
    nilSuccessRate: number;
    deterministicSuccessRate: number;
    nilSampleSize: number;
    deterministicSampleSize: number;
  } | null;
}

/**
 * Low-performance pattern flagged by the learning engine.
 */
export interface LowPerformanceFlag {
  /** Pattern type or signal category */
  category: string;
  /** Success rate observed */
  successRate: number;
  /** Sample size */
  sampleSize: number;
  /** Description of the issue */
  issue: string;
}

// ── Confidence Evolution (Section 7) ─────────────────────────────────────────

/**
 * Evolved confidence that incorporates historical performance.
 */
export interface EvolvedConfidence {
  /** Base confidence from the standard model */
  baseConfidence: number;
  /** Historical performance modifier (0.5-1.5) */
  historicalModifier: number;
  /** Final evolved confidence (0-1) */
  evolvedConfidence: number;
  /** Explanation of the evolution */
  explanation: string;
}

// ── Strategic Narrative (Section 8) ──────────────────────────────────────────

export type StrategicOutlook = 'stable' | 'worsening' | 'improving';
export type ActionWindow = 'immediate' | 'short_term' | 'bargaining_cycle';

/**
 * Strategic framing fields added to the movement summary.
 */
export interface StrategicNarrative {
  /** Directional outlook */
  outlook: StrategicOutlook;
  /** What this means strategically */
  strategicImplication: string;
  /** Best window for action */
  nextWindow: ActionWindow;
}

// ── UI Contracts (Section 9) ────────────────────────────────────────────────

/**
 * Signal interaction indicator for UI display.
 */
export interface SignalInteractionIndicator {
  /** Signal A identifier */
  signalA: string;
  /** Signal B identifier */
  signalB: string;
  /** Interaction type */
  interaction: SignalInteractionType;
  /** Human-readable label */
  label: string;
}

/**
 * Trend classification badge for UI display.
 */
export interface TrendBadge {
  /** Pattern type */
  pattern: TimeSeriesPatternType;
  /** Display label */
  label: string;
  /** Severity for coloring */
  severity: 'info' | 'warning' | 'danger';
}

/**
 * Confidence breakdown for tooltip display.
 */
export interface ConfidenceBreakdown {
  /** Overall confidence */
  confidence: number;
  /** Band */
  band: ConfidenceBand;
  /** Factor contributions */
  factors: Array<{
    name: string;
    contribution: number;
    description: string;
  }>;
}

// ── NIL + Deterministic Hybrid Control (Section 10) ──────────────────────────

export type DecisionMode = 'deterministic_only' | 'hybrid' | 'nil_weighted';

/**
 * Hybrid control configuration.
 * Ensures NIL cannot fully override deterministic base.
 */
export interface HybridControlConfig {
  /** Decision mode */
  mode: DecisionMode;
  /** Maximum bounded adjustment NIL can apply (±) */
  maxAdjustment: number;
}

// ── Extended Pipeline Types ─────────────────────────────────────────────────

/**
 * Output from an NIL refinement call.
 */
export interface NilRefinement {
  /** Refined headline */
  headline?: string;
  /** Refined summary */
  summary?: string;
  /** Key takeaway */
  keyTakeaway?: string;
  /** Recommended next step (narrative) */
  recommendedNextStep?: string;
  /** Additional fields from the prompt contract */
  additionalFields?: Record<string, unknown>;
}

// ── Executive Audit Context (extension of DecisionAuditContext) ──────────────

/**
 * Audit context for executive intelligence operations.
 */
export interface ExecutiveAuditContext {
  /** Whether executive summary was generated */
  executiveSummaryGenerated: boolean;
  /** Whether NIL was invoked */
  nilInvoked: boolean;
  /** Number of top priorities returned */
  topPriorityCount: number;
  /** Number of deltas detected */
  changedSignalsCount: number;
  /** Whether time-series data was used */
  usedTimeSeries: boolean;
  /** Previous snapshot ID used for comparison (if any) */
  previousSnapshotId?: string;
}

// ── Pipeline Input ──────────────────────────────────────────────────────────

/**
 * Full input to the executive intelligence pipeline.
 * Consumes the output of the decision intelligence pipeline
 * plus optional previous snapshot for delta computation.
 */
export interface ExecutivePipelineInput {
  /** Output from the decision intelligence pipeline */
  decisionOutput: DecisionIntelligenceOutput;
  /** Previous snapshot for delta comparison (null = first run) */
  previousSnapshot: ExecutiveSnapshot | null;
  /** Optional NIL service for narrative refinement */
  nilService?: NilReasoningService;
  /** Maximum number of top priorities to return */
  maxPriorities?: number;
  /** Whether time-series data was available in the pipeline */
  timeSeriesAvailable?: boolean;
  /** Decision mode (default: hybrid) */
  decisionMode?: DecisionMode;
  /** Historical outcomes for feedback learning */
  historicalOutcomes?: DecisionOutcome[];
  /** Historical performance score for confidence evolution */
  historicalPerformanceScore?: number;
}

/**
 * Full output from the executive intelligence pipeline.
 */
export interface ExecutivePipelineOutput {
  /** Movement summary */
  movementSummary: MovementSummary;
  /** Ranked executive priorities */
  topExecutivePriorities: ExecutivePriority[];
  /** What changed since last review */
  whatChanged: ExecutiveDelta[];
  /** Complete action brief */
  actionBrief: ExecutiveActionBrief;
  /** Current snapshot (for persisting) */
  currentSnapshot: ExecutiveSnapshot;
  /** Audit context */
  auditContext: ExecutiveAuditContext;
  /** Multi-signal analysis result */
  multiSignalAnalysis?: MultiSignalAnalysis;
  /** Action sequence */
  actionSequence?: ActionSequence;
  /** Top one priority */
  topOnePriority?: TopOnePriority;
  /** Strategic narrative */
  strategicNarrative?: StrategicNarrative;
  /** Feedback metrics (if historical data provided) */
  feedbackMetrics?: RecommendationAccuracy;
}
