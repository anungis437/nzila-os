/**
 * @nzila/platform-decision-graph — Types
 *
 * Explainable decision trail types — every platform decision is a node in an
 * auditable, traversable graph with full evidence and policy linkage.
 */
import { z } from 'zod'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── Decision Types ──────────────────────────────────────────────────────────

export const DecisionTypes = {
  APPROVAL: 'approval',
  REJECTION: 'rejection',
  ESCALATION: 'escalation',
  RECOMMENDATION: 'recommendation',
  CLASSIFICATION: 'classification',
  ROUTING: 'routing',
  RISK_ASSESSMENT: 'risk_assessment',
  PRICING: 'pricing',
  ALLOCATION: 'allocation',
  COMPLIANCE_CHECK: 'compliance_check',
  AI_INFERENCE: 'ai_inference',
  POLICY_EVALUATION: 'policy_evaluation',
} as const

export type DecisionType = (typeof DecisionTypes)[keyof typeof DecisionTypes]

// ── Decision Statuses ───────────────────────────────────────────────────────

export const DecisionStatuses = {
  PENDING: 'pending',
  EXECUTED: 'executed',
  OVERRIDDEN: 'overridden',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
} as const

export type DecisionStatus =
  (typeof DecisionStatuses)[keyof typeof DecisionStatuses]

// ── Decision Actor Types ────────────────────────────────────────────────────

export const ActorTypes = {
  USER: 'user',
  SYSTEM: 'system',
  AI_MODEL: 'ai_model',
  POLICY_ENGINE: 'policy_engine',
  WORKFLOW: 'workflow',
} as const

export type ActorType = (typeof ActorTypes)[keyof typeof ActorTypes]

// ── Decision Node ───────────────────────────────────────────────────────────

export interface DecisionNode {
  readonly id: string
  readonly tenantId: string
  readonly decisionType: DecisionType
  readonly status: DecisionStatus
  readonly actorType: ActorType
  readonly actorId: string
  readonly entityType: OntologyEntityType
  readonly resourceId: string
  readonly summary: string
  readonly outcome: Record<string, unknown>
  readonly confidence?: number
  readonly policyRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
  readonly knowledgeRefs: readonly string[]
  readonly reasoning?: string
  readonly createdAt: string
  readonly executedAt?: string
  readonly expiresAt?: string
}

// ── Decision Edge ───────────────────────────────────────────────────────────

export const DecisionEdgeTypes = {
  DEPENDS_ON: 'depends_on',
  OVERRIDES: 'overrides',
  ESCALATED_TO: 'escalated_to',
  TRIGGERED_BY: 'triggered_by',
  INFORMED_BY: 'informed_by',
} as const

export type DecisionEdgeType =
  (typeof DecisionEdgeTypes)[keyof typeof DecisionEdgeTypes]

export interface DecisionEdge {
  readonly id: string
  readonly fromDecisionId: string
  readonly toDecisionId: string
  readonly edgeType: DecisionEdgeType
  readonly metadata?: Record<string, unknown>
  readonly createdAt: string
}

// ── Decision Trail ──────────────────────────────────────────────────────────

export interface DecisionTrail {
  readonly rootDecisionId: string
  readonly nodes: readonly DecisionNode[]
  readonly edges: readonly DecisionEdge[]
  readonly totalDepth: number
}

// ── Decision Graph Store ────────────────────────────────────────────────────

export interface DecisionGraphStore {
  persistNode(node: DecisionNode): Promise<void>
  persistEdge(edge: DecisionEdge): Promise<void>
  getNode(id: string): Promise<DecisionNode | undefined>
  getEdgesFrom(decisionId: string): Promise<readonly DecisionEdge[]>
  getEdgesTo(decisionId: string): Promise<readonly DecisionEdge[]>
  getNodesByEntity(
    entityType: OntologyEntityType,
    resourceId: string,
  ): Promise<readonly DecisionNode[]>
  updateNodeStatus(id: string, status: DecisionStatus): Promise<void>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const CreateDecisionNodeSchema = z.object({
  tenantId: z.string().uuid(),
  decisionType: z.enum(
    Object.values(DecisionTypes) as [string, ...string[]],
  ),
  actorType: z.enum(Object.values(ActorTypes) as [string, ...string[]]),
  actorId: z.string().min(1),
  entityType: z.string().min(1),
  resourceId: z.string().uuid(),
  summary: z.string().min(1),
  outcome: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
  policyRefs: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  knowledgeRefs: z.array(z.string()).default([]),
  reasoning: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

export type CreateDecisionNodeInput = z.infer<typeof CreateDecisionNodeSchema>

export const CreateDecisionEdgeSchema = z.object({
  fromDecisionId: z.string().uuid(),
  toDecisionId: z.string().uuid(),
  edgeType: z.enum(
    Object.values(DecisionEdgeTypes) as [string, ...string[]],
  ),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateDecisionEdgeInput = z.infer<typeof CreateDecisionEdgeSchema>
