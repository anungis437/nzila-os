/**
 * @nzila/intelligence — Types
 *
 * Unified types for the Nzila Intelligence Layer (NIL).
 * All AI and intelligence capabilities across NzilaOS share these
 * standardised request/response shapes.
 */
import { z } from 'zod'

// ── App Keys ────────────────────────────────────────────────────────────────

/**
 * Every Nzila application that may invoke the intelligence layer.
 */
export type NilApp = 'ue' | 'cfo' | 'zonga' | 'agrimo' | 'flow' | 'itsm' | 'console'

export const NIL_APPS = ['ue', 'cfo', 'zonga', 'agrimo', 'flow', 'itsm', 'console'] as const

// ── Confidence & Risk ───────────────────────────────────────────────────────

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// ── Data Classification ─────────────────────────────────────────────────────

export type DataClass = 'public' | 'internal' | 'sensitive' | 'regulated'

// ── Intelligence Request ────────────────────────────────────────────────────

/**
 * Unified request envelope for every intelligence operation.
 * Wraps org identity, app context, use-case key, and arbitrary input.
 */
export interface IntelligenceRequest {
  /** Organisation (tenant) identifier */
  readonly orgId: string
  /** Source application invoking NIL */
  readonly app: NilApp
  /** Domain use-case key (e.g. "grievance-triage", "cash-forecast") */
  readonly useCase: string
  /** Arbitrary input payload — shape depends on the use-case */
  readonly input: Record<string, unknown>
  /** Optional context overrides (locale, actor, etc.) */
  readonly context?: IntelligenceContext
}

/**
 * Optional context that travels with every intelligence request.
 */
export interface IntelligenceContext {
  readonly actorId?: string
  readonly locale?: string
  readonly environment?: 'local' | 'preview' | 'staging' | 'production'
  readonly correlationId?: string
  readonly dataClass?: DataClass
  readonly metadata?: Record<string, unknown>
}

// ── Intelligence Response ───────────────────────────────────────────────────

/**
 * Unified response envelope returned by every intelligence operation.
 */
export interface IntelligenceResponse {
  /** Unique response identifier for tracing */
  readonly requestId: string
  /** Whether the operation succeeded */
  readonly success: boolean
  /** Primary output payload — shape depends on the use-case */
  readonly output: Record<string, unknown>
  /** Explainability trace (reasoning steps, citations) */
  readonly explanation: ExplanationTrace
  /** Overall confidence score (0–1) */
  readonly confidence: number
  /** Risk classification of the output */
  readonly riskLevel: RiskLevel
  /** Processing time in milliseconds */
  readonly durationMs: number
  /** ISO-8601 timestamp of completion */
  readonly completedAt: string
}

// ── Explanation Trace ───────────────────────────────────────────────────────

/**
 * Structured explainability trace attached to every NIL response.
 */
export interface ExplanationTrace {
  /** Human-readable summary of how the result was derived */
  readonly summary: string
  /** Ordered steps the intelligence layer took */
  readonly steps: readonly ExplanationStep[]
  /** Citations backing the result */
  readonly citations: readonly ExplanationCitation[]
}

export interface ExplanationStep {
  readonly stepNumber: number
  readonly description: string
  readonly confidence: number
  readonly durationMs: number
}

export interface ExplanationCitation {
  readonly id: string
  readonly sourceType: 'policy' | 'knowledge' | 'event' | 'decision' | 'entity' | 'data'
  readonly sourceId: string
  readonly label: string
  readonly excerpt: string
  readonly relevance: number
}

// ── Intelligence Capability ─────────────────────────────────────────────────

/**
 * Descriptor for a registered intelligence capability in the NIL registry.
 */
export interface IntelligenceCapability {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly supportedApps: readonly NilApp[]
  readonly useCases: readonly string[]
  readonly version: string
}

// ── Adaptive Routing & Correlation ─────────────────────────────────────────

export interface CapabilityRouteDecision {
  readonly selected?: IntelligenceCapability
  readonly alternatives: readonly IntelligenceCapability[]
  readonly reason: string
}

export interface DomainSignal {
  readonly app: NilApp | string
  readonly metric: string
  readonly value: number
  readonly timestamp: string
  readonly sourceId?: string
}

export type CorrelationStrength =
  | 'none'
  | 'weak'
  | 'moderate'
  | 'strong'
  | 'very_strong'

export interface CrossDomainCorrelation {
  readonly id: string
  readonly left: {
    readonly app: string
    readonly metric: string
  }
  readonly right: {
    readonly app: string
    readonly metric: string
  }
  readonly coefficient: number
  readonly strength: CorrelationStrength
  readonly direction: 'positive' | 'negative'
  readonly sampleSize: number
  readonly overlapStart: string
  readonly overlapEnd: string
}

// ── Error ───────────────────────────────────────────────────────────────────

export type NilErrorCode =
  | 'policy_denied'
  | 'budget_exceeded'
  | 'capability_not_found'
  | 'validation_error'
  | 'provider_error'
  | 'reasoning_failed'
  | 'decision_failed'
  | 'context_error'
  | 'unknown'

export class NilError extends Error {
  constructor(
    public readonly code: NilErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'NilError'
  }
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const intelligenceContextSchema = z.object({
  actorId: z.string().optional(),
  locale: z.string().optional(),
  environment: z.enum(['local', 'preview', 'staging', 'production']).optional(),
  correlationId: z.string().optional(),
  dataClass: z.enum(['public', 'internal', 'sensitive', 'regulated']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const intelligenceRequestSchema = z.object({
  orgId: z.string().min(1),
  app: z.enum(NIL_APPS),
  useCase: z.string().min(1),
  input: z.record(z.unknown()),
  context: intelligenceContextSchema.optional(),
})
