/**
 * @nzila/zonga-intelligence — Types & Schemas
 *
 * AI/ML types for recommendations, creator insights,
 * fraud scoring, content moderation, and trend analysis.
 * All AI outputs are logged with explainability metadata.
 */
import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const ModelType = {
  RECOMMENDATION: 'recommendation',
  FRAUD_DETECTION: 'fraud_detection',
  CONTENT_MODERATION: 'content_moderation',
  TREND_ANALYSIS: 'trend_analysis',
  CREATOR_INSIGHTS: 'creator_insights',
  PRICING: 'pricing',
} as const
export type ModelType = (typeof ModelType)[keyof typeof ModelType]

export const SignalType = {
  PLAY: 'play',
  SKIP: 'skip',
  SAVE: 'save',
  SHARE: 'share',
  FOLLOW: 'follow',
  UNFOLLOW: 'unfollow',
  PURCHASE: 'purchase',
  SEARCH: 'search',
  PLAYLIST_ADD: 'playlist_add',
  EVENT_ATTEND: 'event_attend',
  TIP: 'tip',
} as const
export type SignalType = (typeof SignalType)[keyof typeof SignalType]

export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel]

export const ModerationVerdict = {
  APPROVED: 'approved',
  FLAGGED: 'flagged',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
} as const
export type ModerationVerdict = (typeof ModerationVerdict)[keyof typeof ModerationVerdict]

// ── Interfaces ────────────────────────────────────────────────────────────

/** Base for all AI inference results — explainability + audit */
export interface AIInferenceResult {
  readonly modelId: string
  readonly modelVersion: string
  readonly inferenceId: string
  readonly timestamp: Date
  readonly latencyMs: number
  readonly featureFlags: readonly string[]
  readonly explanation: InferenceExplanation
}

export interface InferenceExplanation {
  readonly method: 'feature_importance' | 'shap' | 'rule_based' | 'heuristic'
  readonly topFactors: readonly ExplanationFactor[]
  readonly confidence: number // 0-1
  readonly humanReadable: string
}

export interface ExplanationFactor {
  readonly feature: string
  readonly weight: number
  readonly direction: 'positive' | 'negative' | 'neutral'
}

// ── Recommendations ───────────────────────────────────────────────────────

export interface UserSignal {
  readonly userId: string
  readonly signalType: SignalType
  readonly targetId: string // track, artist, event ID
  readonly targetType: 'track' | 'artist' | 'event' | 'playlist'
  readonly timestamp: Date
  readonly weight: number // signal strength (1 = normal, 2 = strong, etc.)
  readonly context?: Record<string, unknown>
}

export interface Recommendation {
  readonly itemId: string
  readonly itemType: 'track' | 'artist' | 'event' | 'playlist'
  readonly score: number // 0-1 relevance score
  readonly reason: string // human-readable
  readonly strategy: 'collaborative' | 'content_based' | 'trending' | 'editorial' | 'hybrid'
}

export interface RecommendationResult extends AIInferenceResult {
  readonly userId: string
  readonly recommendations: readonly Recommendation[]
  readonly strategy: string
  readonly diversity: number // 0-1 how diverse the result set is
}

// ── Fraud Detection ───────────────────────────────────────────────────────

export interface FraudSignal {
  readonly type:
    | 'stream_farming'
    | 'fake_accounts'
    | 'payment_fraud'
    | 'ticket_scalping'
    | 'bot_activity'
    | 'review_manipulation'
  readonly userId: string
  readonly entityId: string
  readonly indicators: readonly string[]
  readonly timestamp: Date
}

export interface FraudScore extends AIInferenceResult {
  readonly entityId: string
  readonly entityType: 'user' | 'track' | 'event' | 'transaction'
  readonly riskLevel: RiskLevel
  readonly score: number // 0-100
  readonly signals: readonly FraudSignal[]
  readonly recommended_action: 'allow' | 'flag' | 'block' | 'manual_review'
}

// ── Content Moderation ────────────────────────────────────────────────────

export interface ModerationRequest {
  readonly contentId: string
  readonly contentType: 'track' | 'lyrics' | 'cover_art' | 'bio' | 'comment' | 'event_description'
  readonly text?: string
  readonly imageUrl?: string
  readonly audioUrl?: string
}

export interface ModerationResult extends AIInferenceResult {
  readonly contentId: string
  readonly verdict: ModerationVerdict
  readonly categories: readonly ModerationCategory[]
  readonly requiresHumanReview: boolean
}

export interface ModerationCategory {
  readonly name: string // e.g., 'hate_speech', 'violence', 'explicit_content'
  readonly score: number // 0-1
  readonly threshold: number
  readonly triggered: boolean
}

// ── Creator Insights ──────────────────────────────────────────────────────

export interface CreatorInsight {
  readonly artistId: string
  readonly metric: string
  readonly value: number
  readonly trend: 'rising' | 'stable' | 'declining'
  readonly percentChange: number
  readonly period: string
  readonly comparison: string // e.g., "vs. last month"
}

export interface AudienceSegment {
  readonly name: string
  readonly size: number
  readonly percentage: number
  readonly topCountries: readonly string[]
  readonly ageRange: string
  readonly engagementScore: number
}

export interface CreatorDashboard {
  readonly artistId: string
  readonly generatedAt: Date
  readonly insights: readonly CreatorInsight[]
  readonly audienceSegments: readonly AudienceSegment[]
  readonly topTracks: readonly { trackId: string; streams: number; revenue: number }[]
  readonly revenueBreakdown: Record<string, number>
}

// ── Trend Analysis ────────────────────────────────────────────────────────

export interface TrendSignal {
  readonly term: string
  readonly category: 'genre' | 'artist' | 'track' | 'event' | 'hashtag'
  readonly velocity: number // rate of change
  readonly volume: number
  readonly region: string
  readonly detectedAt: Date
}

export interface TrendReport {
  readonly generatedAt: Date
  readonly region: string
  readonly trends: readonly TrendSignal[]
  readonly emergingGenres: readonly string[]
  readonly breakoutArtists: readonly string[]
}

// ── Zod Schemas ───────────────────────────────────────────────────────────

export const RecordSignalSchema = z.object({
  userId: z.string().min(1),
  signalType: z.enum([
    'play', 'skip', 'save', 'share', 'follow', 'unfollow',
    'purchase', 'search', 'playlist_add', 'event_attend', 'tip',
  ]),
  targetId: z.string().min(1),
  targetType: z.enum(['track', 'artist', 'event', 'playlist']),
  weight: z.number().min(0).max(10).default(1),
  context: z.record(z.unknown()).optional(),
})

export const RequestRecommendationsSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
  strategy: z.enum(['collaborative', 'content_based', 'trending', 'editorial', 'hybrid']).default('hybrid'),
  excludeIds: z.array(z.string()).default([]),
  targetType: z.enum(['track', 'artist', 'event', 'playlist']).default('track'),
})

export const RequestFraudCheckSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(['user', 'track', 'event', 'transaction']),
  signals: z.array(z.string()).default([]),
})

export const RequestModerationSchema = z.object({
  contentId: z.string().min(1),
  contentType: z.enum(['track', 'lyrics', 'cover_art', 'bio', 'comment', 'event_description']),
  text: z.string().optional(),
  imageUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
})
