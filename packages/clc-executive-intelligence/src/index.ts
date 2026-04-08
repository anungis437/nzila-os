/**
 * CLC Executive Intelligence
 *
 * Transforms CLC decision-intelligence output into executive-ready
 * artifacts: ranked priorities, movement summaries, what-changed deltas,
 * action briefs, and NIL-refined narratives.
 *
 * @packageDocumentation
 */

// ── Contracts ───────────────────────────────────────────────────────────────
export type {
  WatchLevel,
  ExecutivePriority,
  MovementPosture,
  MovementSummary,
  DeltaDirection,
  ExecutiveDelta,
  ExecutiveSnapshot,
  ExecutiveActionBrief,
  NilReasoningService,
  NilRefinement,
  ExecutiveAuditContext,
  ExecutivePipelineInput,
  ExecutivePipelineOutput,
  // Section 1: NIL Conflict Resolution
  NilConflictResolution,
  // Section 2: Multi-Signal Reasoning
  SignalInteractionType,
  MultiSignalAnalysis,
  // Section 3: Time-Series Intelligence
  TimeSeriesPatternType,
  TimeSeriesIntelligence,
  LagCorrelation,
  // Section 4: Decision Sequencing
  SequencedAction,
  ActionSequence,
  // Section 5: Top One Priority
  TopOnePriority,
  // Section 6: Feedback Loop
  DecisionOutcomeResult,
  DecisionOutcome,
  WeightAdjustment,
  RecommendationAccuracy,
  LowPerformanceFlag,
  // Section 7: Confidence Evolution
  EvolvedConfidence,
  // Section 8: Strategic Narrative
  StrategicOutlook,
  ActionWindow,
  StrategicNarrative,
  // Section 9: UI Contracts
  SignalInteractionIndicator,
  TrendBadge,
  ConfidenceBreakdown,
  // Section 10: Hybrid Control
  DecisionMode,
  HybridControlConfig,
} from './contracts/index';

// Re-export upstream types for convenience
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
} from './contracts/index';

// ── Prioritization ──────────────────────────────────────────────────────────
export {
  computeExecutivePriorityScore,
  rankExecutivePriorities,
  selectTopExecutivePriorities,
} from './prioritization/index';

// ── Summaries ───────────────────────────────────────────────────────────────
export {
  classifyMovementPosture,
  explainMovementPosture,
  buildMovementSummary,
} from './summaries/index';

// ── Comparisons ─────────────────────────────────────────────────────────────
export {
  buildSnapshot,
  detectNewSignals,
  detectEscalations,
  detectResolutions,
  compareExecutiveSnapshots,
} from './comparisons/index';

// ── Narrative / NIL ─────────────────────────────────────────────────────────
export {
  EXECUTIVE_PROMPT_CONTRACTS,
  attemptNilRefinement,
  getExecutivePromptContract,
  validateNilOutput,
} from './narrative/index';
export type { NilAttemptResult } from './narrative/index';

// ── Strategic Narrative (Section 8) ─────────────────────────────────────────
export {
  classifyOutlook,
  classifyActionWindow,
  buildStrategicNarrative,
} from './narrative/strategic';

// ── NIL Authority (Section 1 + 10) ──────────────────────────────────────────
export {
  NIL_CONFLICT_CONTRACTS,
  resolveConflictingSignals,
  getHybridConfig,
  applyBoundedAdjustment,
  resolveWithHybridControl,
} from './nil-authority/index';

// ── Multi-Signal Reasoning (Section 2) ──────────────────────────────────────
export { analyzeMultipleSignals } from './reasoning/multi-signal-engine';

// ── Time-Series Intelligence (Section 3) ────────────────────────────────────
export {
  classifyTimeSeriesPattern,
  computePersistence,
  computeAcceleration,
  detectLagCorrelation,
  buildTimeSeriesIntelligence,
  createTrendBadge,
} from './time-series/index';

// ── Decision Sequencing (Section 4 + 5) ─────────────────────────────────────
export {
  buildActionSequence,
  deriveTopOnePriority,
} from './recommendations/sequence-engine';

// ── Feedback Learning (Section 6) ───────────────────────────────────────────
export {
  computeRecommendationAccuracy,
  updateModelWeights,
  flagLowPerformancePatterns,
  getDefaultWeights,
  getMinSampleSize,
} from './learning/feedback-engine';
export type { ScoringWeights } from './learning/feedback-engine';

// ── Confidence Evolution (Section 7) ────────────────────────────────────────
export {
  computeHistoricalModifier,
  computeModifierFromScore,
  evolveConfidence,
  computeNilDeterministicVariance,
  buildConfidenceBreakdown,
} from './confidence/evolution';

// ── UI Helpers (Section 9) ──────────────────────────────────────────────────
export {
  buildTopOneBanner,
  buildSequenceTimeline,
  buildSignalInteractionIndicators,
  buildStrategicOutlookDisplay,
} from './ui/index';
export type {
  TopOneBanner,
  SequenceTimelineItem,
  StrategicOutlookDisplay,
} from './ui/index';

// ── Fallbacks ───────────────────────────────────────────────────────────────
export {
  fallbackPostureHeadline,
  fallbackPostureSummary,
  fallbackPostureKeyTakeaway,
  fallbackPrioritySummary,
  fallbackPriorityNextStep,
  fallbackChangeSummary,
  fallbackRecommendedNextSteps,
  fallbackActionBriefHeadline,
  fallbackActionBriefSummary,
} from './fallbacks/index';

// ── Pipeline ────────────────────────────────────────────────────────────────
export { runExecutiveIntelligencePipeline } from './pipeline/index';
