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
} from './contracts/index.js';

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
} from './contracts/index.js';

// ── Prioritization ──────────────────────────────────────────────────────────
export {
  computeExecutivePriorityScore,
  rankExecutivePriorities,
  selectTopExecutivePriorities,
} from './prioritization/index.js';

// ── Summaries ───────────────────────────────────────────────────────────────
export {
  classifyMovementPosture,
  explainMovementPosture,
  buildMovementSummary,
} from './summaries/index.js';

// ── Comparisons ─────────────────────────────────────────────────────────────
export {
  buildSnapshot,
  detectNewSignals,
  detectEscalations,
  detectResolutions,
  compareExecutiveSnapshots,
} from './comparisons/index.js';

// ── Narrative / NIL ─────────────────────────────────────────────────────────
export {
  EXECUTIVE_PROMPT_CONTRACTS,
  attemptNilRefinement,
  getExecutivePromptContract,
  validateNilOutput,
} from './narrative/index.js';
export type { NilAttemptResult } from './narrative/index.js';

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
} from './fallbacks/index.js';

// ── Pipeline ────────────────────────────────────────────────────────────────
export { runExecutiveIntelligencePipeline } from './pipeline/index.js';
