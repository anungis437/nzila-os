/**
 * @nzila/platform-reasoning-engine — Types
 *
 * Cross-vertical reasoning engine types — structured reasoning chains
 * with citations, confidence scoring, and explainable conclusions.
 */
import { z } from 'zod'
import type { OntologyEntityType } from '@nzila/platform-ontology'
import type { ContextEnvelope } from '@nzila/platform-context-orchestrator'
import type { EvidenceItem } from '@nzila/platform-governed-ai'

// ── Reasoning Types ─────────────────────────────────────────────────────────

export const ReasoningTypes = {
  DEDUCTIVE: 'deductive',
  INDUCTIVE: 'inductive',
  ABDUCTIVE: 'abductive',
  ANALOGICAL: 'analogical',
  CAUSAL: 'causal',
  RISK_BASED: 'risk_based',
  POLICY_BASED: 'policy_based',
  CROSS_VERTICAL: 'cross_vertical',
} as const

export type ReasoningType =
  (typeof ReasoningTypes)[keyof typeof ReasoningTypes]

// ── Reasoning Statuses ──────────────────────────────────────────────────────

export const ReasoningStatuses = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  INCONCLUSIVE: 'inconclusive',
} as const

export type ReasoningStatus =
  (typeof ReasoningStatuses)[keyof typeof ReasoningStatuses]

// ── Citation ────────────────────────────────────────────────────────────────

export interface Citation {
  readonly id: string
  readonly sourceType: 'policy' | 'knowledge' | 'event' | 'decision' | 'entity' | 'data'
  readonly sourceId: string
  readonly label: string
  readonly excerpt: string
  readonly relevance: number
}

// ── Reasoning Step ──────────────────────────────────────────────────────────

export interface ReasoningStep {
  readonly stepNumber: number
  readonly description: string
  readonly input: Record<string, unknown>
  readonly output: Record<string, unknown>
  readonly citations: readonly Citation[]
  readonly confidence: number
  readonly durationMs: number
}

// ── Reasoning Conclusion ────────────────────────────────────────────────────

export interface ReasoningConclusion {
  readonly summary: string
  readonly recommendation?: string
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  readonly confidence: number
  readonly alternativeConclusions: readonly string[]
}

// ── Reasoning Chain ─────────────────────────────────────────────────────────

export interface ReasoningChain {
  readonly id: string
  readonly orgId: string
  readonly reasoningType: ReasoningType
  readonly status: ReasoningStatus
  readonly entityType: OntologyEntityType
  readonly entityId: string
  readonly question: string
  readonly steps: readonly ReasoningStep[]
  readonly conclusion: ReasoningConclusion | null
  readonly allCitations: readonly Citation[]
  readonly totalConfidence: number
  readonly crossVerticalInsights: readonly CrossVerticalInsight[]
  readonly createdAt: string
  readonly completedAt: string | null
  readonly requestedBy: string
}

// ── Cross-Vertical Insight ──────────────────────────────────────────────────

export interface CrossVerticalInsight {
  readonly verticalA: string
  readonly verticalB: string
  readonly insight: string
  readonly evidence: readonly EvidenceItem[]
  readonly confidence: number
}

// ── Reasoning Strategy ──────────────────────────────────────────────────────

export interface ReasoningStrategy {
  readonly type: ReasoningType
  reason(
    context: ContextEnvelope,
    question: string,
  ): Promise<{
    steps: readonly ReasoningStep[]
    conclusion: ReasoningConclusion
    citations: readonly Citation[]
  }>
}

// ── Reasoning Engine Store ──────────────────────────────────────────────────

export interface ReasoningStore {
  persistChain(chain: ReasoningChain): Promise<void>
  getChain(id: string): Promise<ReasoningChain | undefined>
  getChainsByEntity(
    entityType: OntologyEntityType,
    entityId: string,
  ): Promise<readonly ReasoningChain[]>
  getChainsByOrg(
    orgId: string,
    limit?: number,
  ): Promise<readonly ReasoningChain[]>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const ReasoningRequestSchema = z.object({
  orgId: z.string().uuid(),
  reasoningType: z.enum(
    Object.values(ReasoningTypes) as [string, ...string[]],
  ),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  question: z.string().min(1),
  requestedBy: z.string().min(1),
})

export type ReasoningRequest = z.infer<typeof ReasoningRequestSchema>
