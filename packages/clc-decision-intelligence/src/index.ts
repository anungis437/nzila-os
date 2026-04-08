/**
 * CLC Decision Intelligence Layer
 *
 * Public API — barrel export for all modules.
 *
 * @packageDocumentation
 */

// Contracts / types
export type {
  DecisionInsight,
  ConfidenceInputs,
  ConfidenceResult,
  ConfidenceBand,
  CorrelatedPattern,
  PatternType,
  TimeSeriesPoint,
  TrendAnalysis,
  TrendDirection,
  TrendClassification,
  DecisionRecommendation,
  RecommendedAction,
  ActionTimeframe,
  TargetAudience,
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
  DecisionPromptContract,
  DecisionAuditContext,
} from './contracts/index.js';

// Confidence model
export {
  computeConfidence,
  computeCohortFactor,
  computeRecencyFactor,
  computeAgreementFactor,
  computeSourceFactor,
  computePersistenceFactor,
  computeMissingDataFactor,
  confidenceBandFromScore,
} from './confidence/index.js';

// Time-series signals
export {
  computeTrendVelocity,
  computeAcceleration,
  detectInflectionPoint,
  classifySignalPersistence,
  analyzeTrend,
} from './signals/index.js';

// Correlation engine
export type {
  SectorAggregate,
  AffiliateTypeAggregate,
  SectorTimeSeries,
} from './correlation/index.js';
export {
  detectIssueCluster,
  detectSectorShift,
  detectPrecedentConcentration,
  detectBargainingPressure,
  detectAllPatterns,
} from './correlation/index.js';

// Recommendation engine
export {
  recommendForPattern,
  generateRecommendations,
  recommendFromTrend,
} from './recommendations/index.js';

// Strategic reasoning / data products
export type { DecisionIntelligenceOutput } from './reasoning/index.js';
export {
  deriveMovementRiskPosture,
  analyzeSectorDivergence,
  deriveBargainingWatch,
  generateExecutiveBriefingCards,
  runDecisionIntelligencePipeline,
} from './reasoning/index.js';

// NIL briefing contracts
export {
  DECISION_PROMPT_CONTRACTS,
  getDecisionPromptContract,
  listDecisionPromptUseCases,
} from './briefings/index.js';
