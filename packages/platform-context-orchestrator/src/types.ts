/**
 * @nzila/platform-context-orchestrator — Types
 *
 * Context envelope types — assembles a rich, structured context from
 * ontology, entity graph, event history, knowledge, decisions, and tenant policies.
 */
import { z } from 'zod'
import type { OntologyEntityType, OntologyEntity } from '@nzila/platform-ontology'
import type { EntityNode, EntityEdge } from '@nzila/platform-entity-graph'
import type { PlatformEvent } from '@nzila/platform-event-fabric'
import type { KnowledgeAsset } from '@nzila/platform-knowledge-registry'
import type { DecisionNode } from '@nzila/platform-decision-graph'

// ── Context Purposes ────────────────────────────────────────────────────────

export const ContextPurposes = {
  WORKFLOW: 'workflow',
  DECISION: 'decision',
  AI_INFERENCE: 'ai_inference',
  AUDIT: 'audit',
  REPORTING: 'reporting',
  USER_DISPLAY: 'user_display',
} as const

export type ContextPurpose =
  (typeof ContextPurposes)[keyof typeof ContextPurposes]

// ── Context Envelope ────────────────────────────────────────────────────────

export interface ContextEnvelope {
  readonly id: string
  readonly tenantId: string
  readonly purpose: ContextPurpose
  readonly primaryEntityType: OntologyEntityType
  readonly primaryEntityId: string
  readonly assembledAt: string

  /** The primary entity + its ontology definition */
  readonly entity: OntologyEntity | null

  /** Related entities from the entity graph (neighbors within depth) */
  readonly relatedEntities: readonly EntityNode[]
  readonly relationships: readonly EntityEdge[]

  /** Recent events involving this entity */
  readonly recentEvents: readonly PlatformEvent[]

  /** Applicable knowledge assets (policies, rules, playbooks) */
  readonly applicableKnowledge: readonly KnowledgeAsset[]

  /** Decision history for this entity */
  readonly decisionHistory: readonly DecisionNode[]

  /** Tenant-level policies and configuration */
  readonly tenantPolicies: Record<string, unknown>

  /** Caller context */
  readonly caller: ContextCaller
}

// ── Context Caller ──────────────────────────────────────────────────────────

export interface ContextCaller {
  readonly userId?: string
  readonly role?: string
  readonly permissions?: readonly string[]
  readonly sessionId?: string
}

// ── Context Sources (provider interfaces) ──────────────────────────────────

export interface ContextEntitySource {
  getEntity(
    tenantId: string,
    entityType: OntologyEntityType,
    resourceId: string,
  ): Promise<OntologyEntity | null>
}

export interface ContextGraphSource {
  getNeighbors(
    entityType: OntologyEntityType,
    resourceId: string,
    depth?: number,
  ): Promise<{ nodes: readonly EntityNode[]; edges: readonly EntityEdge[] }>
}

export interface ContextEventSource {
  getRecentEvents(
    tenantId: string,
    entityType: OntologyEntityType,
    resourceId: string,
    limit?: number,
  ): Promise<readonly PlatformEvent[]>
}

export interface ContextKnowledgeSource {
  getApplicable(
    tenantId: string,
    entityType: OntologyEntityType,
    tags?: readonly string[],
  ): Promise<readonly KnowledgeAsset[]>
}

export interface ContextDecisionSource {
  getDecisions(
    entityType: OntologyEntityType,
    resourceId: string,
  ): Promise<readonly DecisionNode[]>
}

export interface ContextTenantSource {
  getTenantPolicies(tenantId: string): Promise<Record<string, unknown>>
}

// ── Context Sources Bundle ──────────────────────────────────────────────────

export interface ContextSources {
  entity: ContextEntitySource
  graph: ContextGraphSource
  events: ContextEventSource
  knowledge: ContextKnowledgeSource
  decisions: ContextDecisionSource
  tenant: ContextTenantSource
}

// ── Context Request ─────────────────────────────────────────────────────────

export interface ContextRequest {
  tenantId: string
  purpose: ContextPurpose
  entityType: OntologyEntityType
  resourceId: string
  caller: ContextCaller
  graphDepth?: number
  eventLimit?: number
  knowledgeTags?: readonly string[]
}

// ── Zod Schema ──────────────────────────────────────────────────────────────

export const ContextRequestSchema = z.object({
  tenantId: z.string().uuid(),
  purpose: z.enum(
    Object.values(ContextPurposes) as [string, ...string[]],
  ),
  entityType: z.string().min(1),
  resourceId: z.string().uuid(),
  caller: z.object({
    userId: z.string().optional(),
    role: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    sessionId: z.string().optional(),
  }),
  graphDepth: z.number().int().min(0).max(5).optional(),
  eventLimit: z.number().int().min(1).max(100).optional(),
  knowledgeTags: z.array(z.string()).optional(),
})
