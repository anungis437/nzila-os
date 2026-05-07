/**
 * @nzila/platform-governed-ai — Types
 *
 * Governed AI types — every AI operation produces an auditable run record
 * with grounding, evidence chain, policy constraints, and confidence scoring.
 */
import { z } from 'zod'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── AI Operation Types ──────────────────────────────────────────────────────

export const AIOperationTypes = {
  RECOMMENDATION: 'recommendation',
  CLASSIFICATION: 'classification',
  EXTRACTION: 'extraction',
  SUMMARIZATION: 'summarization',
  RISK_SCORING: 'risk_scoring',
  ANOMALY_DETECTION: 'anomaly_detection',
  GENERATION: 'generation',
  GROUNDED_RETRIEVAL: 'grounded_retrieval',
  REASONING: 'reasoning',
} as const

export type AIOperationType =
  (typeof AIOperationTypes)[keyof typeof AIOperationTypes]

// ── AI Run Statuses ─────────────────────────────────────────────────────────

export const AIRunStatuses = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REJECTED_BY_POLICY: 'rejected_by_policy',
} as const

export type AIRunStatus = (typeof AIRunStatuses)[keyof typeof AIRunStatuses]

// ── Evidence Item ───────────────────────────────────────────────────────────

export interface EvidenceItem {
  readonly id: string
  readonly sourceType: 'document' | 'event' | 'decision' | 'knowledge' | 'entity' | 'external'
  readonly sourceId: string
  readonly excerpt: string
  readonly relevanceScore: number
  readonly metadata?: Record<string, unknown>
}

// ── Policy Constraint ───────────────────────────────────────────────────────

export interface PolicyConstraint {
  readonly policyId: string
  readonly policyName: string
  readonly satisfied: boolean
  readonly reason?: string
}

// ── AI Run Record ───────────────────────────────────────────────────────────

export interface AIRunRecord {
  readonly id: string
  readonly tenantId: string
  readonly operationType: AIOperationType
  readonly status: AIRunStatus
  readonly modelId: string
  readonly modelVersion: string
  readonly entityType: OntologyEntityType
  readonly resourceId: string
  readonly input: Record<string, unknown>
  readonly output: Record<string, unknown> | null
  readonly confidence: number | null
  readonly evidence: readonly EvidenceItem[]
  readonly policyConstraints: readonly PolicyConstraint[]
  readonly reasoning: string | null
  readonly tokenUsage?: {
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
  }
  readonly latencyMs: number | null
  readonly createdAt: string
  readonly completedAt: string | null
  readonly requestedBy: string
  readonly decisionNodeId?: string
}

// ── AI Model Provider Interface ─────────────────────────────────────────────

export interface AIModelProvider {
  readonly modelId: string
  readonly modelVersion: string
  invoke(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<{
    output: Record<string, unknown>
    confidence: number
    reasoning: string | null
    tokenUsage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }>
}

// ── AI Run Store Interface ──────────────────────────────────────────────────

export interface AIRunStore {
  persistRun(run: AIRunRecord): Promise<void>
  updateRun(id: string, update: Partial<AIRunRecord>): Promise<void>
  getRun(id: string): Promise<AIRunRecord | undefined>
  getRunsByEntity(
    entityType: OntologyEntityType,
    resourceId: string,
  ): Promise<readonly AIRunRecord[]>
  getRunsByTenant(
    tenantId: string,
    limit?: number,
  ): Promise<readonly AIRunRecord[]>
}

// ── Policy Evaluator Interface ──────────────────────────────────────────────

export interface PolicyEvaluator {
  evaluate(
    tenantId: string,
    operationType: AIOperationType,
    entityType: OntologyEntityType,
    input: Record<string, unknown>,
  ): Promise<readonly PolicyConstraint[]>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const AIRunRequestSchema = z.object({
  tenantId: z.string().uuid(),
  operationType: z.enum(
    Object.values(AIOperationTypes) as [string, ...string[]],
  ),
  modelId: z.string().min(1),
  entityType: z.string().min(1),
  resourceId: z.string().uuid(),
  input: z.record(z.unknown()),
  requestedBy: z.string().min(1),
})

export type AIRunRequest = z.infer<typeof AIRunRequestSchema>
