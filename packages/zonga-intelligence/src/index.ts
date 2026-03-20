/**
 * @nzila/zonga-intelligence — AI/ML intelligence layer
 *
 * Recommendations, fraud detection, content moderation,
 * creator insights, and trend analysis.
 */

// ── Types & Schemas ───────────────────────────────────────────────────────
export {
  // Enums
  ModelType,
  SignalType,
  RiskLevel,
  ModerationVerdict,

  // Base interfaces
  type AIInferenceResult,
  type InferenceExplanation,
  type ExplanationFactor,

  // Recommendations
  type UserSignal,
  type Recommendation,
  type RecommendationResult,

  // Fraud
  type FraudSignal,
  type FraudScore,

  // Moderation
  type ModerationRequest,
  type ModerationResult,
  type ModerationCategory,

  // Creator Insights
  type CreatorInsight,
  type AudienceSegment,
  type CreatorDashboard,

  // Trends
  type TrendSignal,
  type TrendReport,

  // Schemas
  RecordSignalSchema,
  RequestRecommendationsSchema,
  RequestFraudCheckSchema,
  RequestModerationSchema,
} from './types'

// ── Recommendation Engine ─────────────────────────────────────────────────
export {
  scoreItemsBySignals,
  buildRecommendations,
  computeDiversity,
  type ScoredItem,
} from './recommendations'

// ── Fraud Engine ──────────────────────────────────────────────────────────
export {
  computeFraudScore,
  detectStreamFarming,
  type StreamPattern,
} from './fraud'

// ── Moderation Engine ─────────────────────────────────────────────────────
export {
  analyzeText,
  determineVerdict,
  type ModerationRule,
} from './moderation'

// ── Creator Insights ──────────────────────────────────────────────────────
export {
  computeInsights,
  buildRevenueBreakdown,
  buildCreatorDashboard,
  type MetricDataPoint,
  type RevenueEntry,
  type TrackPerformance,
} from './insights'
