/**
 * @nzila/platform-event-fabric — Types
 *
 * Strongly typed platform-wide event contracts.
 */
import { z } from 'zod'

// ── Platform Event Types ────────────────────────────────────────────────────

export const PlatformEventTypes = {
  // Lead / CRM
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_QUALIFIED: 'lead.qualified',

  // Case lifecycle
  CASE_CREATED: 'case.created',
  CASE_UPDATED: 'case.updated',
  CASE_CLOSED: 'case.closed',

  // Document lifecycle
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_VERIFIED: 'document.verified',
  DOCUMENT_REJECTED: 'document.rejected',

  // Program
  PROGRAM_RECOMMENDED: 'program.recommended',
  PROGRAM_ENROLLED: 'program.enrolled',

  // Approval / Decision
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_COMPLETED: 'approval.completed',
  APPROVAL_DENIED: 'approval.denied',

  // Policy
  POLICY_VIOLATION_DETECTED: 'policy.violation.detected',
  POLICY_UPDATED: 'policy.updated',

  // Payment
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_FAILED: 'payment.failed',

  // Shipment
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_UPDATED: 'shipment.updated',
  SHIPMENT_DELIVERED: 'shipment.delivered',

  // Member
  MEMBER_RECOGNIZED: 'member.recognized',
  MEMBER_UPDATED: 'member.updated',

  // Risk
  RISK_FLAGGED: 'risk.flagged',
  RISK_RESOLVED: 'risk.resolved',

  // AI
  AI_DECISION_GENERATED: 'ai.decision.generated',
  AI_RUN_COMPLETED: 'ai.run.completed',

  // Communication
  COMMUNICATION_SENT: 'communication.sent',
  COMMUNICATION_RECEIVED: 'communication.received',

  // Workflow
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_STEP_COMPLETED: 'workflow.step.completed',
  WORKFLOW_COMPLETED: 'workflow.completed',

  // Sync / Fabric
  SYNC_JOB_STARTED: 'sync.job.started',
  SYNC_JOB_COMPLETED: 'sync.job.completed',
  SYNC_CONFLICT_DETECTED: 'sync.conflict.detected',

  // Entity
  ENTITY_CREATED: 'entity.created',
  ENTITY_UPDATED: 'entity.updated',
  ENTITY_DELETED: 'entity.deleted',
} as const

export type PlatformEventType =
  (typeof PlatformEventTypes)[keyof typeof PlatformEventTypes]

// ── Event Metadata ──────────────────────────────────────────────────────────

export interface PlatformEventMetadata {
  readonly tenantId: string
  readonly orgId?: string
  readonly actorId: string
  readonly correlationId: string
  readonly causationId?: string
  readonly source: string
  readonly version: number
}

// ── Platform Event ──────────────────────────────────────────────────────────

export interface PlatformEvent<TPayload = Record<string, unknown>> {
  readonly id: string
  readonly type: PlatformEventType | string
  readonly payload: Readonly<TPayload>
  readonly metadata: PlatformEventMetadata
  readonly createdAt: string
}

// ── Event Handler ───────────────────────────────────────────────────────────

export type PlatformEventHandler<TPayload = Record<string, unknown>> = (
  event: PlatformEvent<TPayload>,
) => void | Promise<void>

export type Unsubscribe = () => void

// ── Event Bus Interface ─────────────────────────────────────────────────────

export interface PlatformEventBus {
  publish(event: PlatformEvent): Promise<void>
  subscribe(eventType: PlatformEventType | string, handler: PlatformEventHandler): Unsubscribe
  subscribeAll(handler: PlatformEventHandler): Unsubscribe
  replay(eventType: PlatformEventType | string, since: string): Promise<readonly PlatformEvent[]>
  clear(): void
}

// ── Event Store Interface ───────────────────────────────────────────────────

export interface PlatformEventStore {
  persist(event: PlatformEvent): Promise<void>
  query(eventType: string, since: string, tenantId?: string): Promise<readonly PlatformEvent[]>
}

// ── Event Schema Definition ─────────────────────────────────────────────────

export interface EventSchemaDefinition {
  readonly eventType: PlatformEventType | string
  readonly version: number
  readonly description: string
  readonly payloadSchema: z.ZodType
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const PlatformEventMetadataSchema = z.object({
  tenantId: z.guid(),
  orgId: z.guid().optional(),
  actorId: z.string().min(1),
  correlationId: z.guid(),
  causationId: z.guid().optional(),
  source: z.string().min(1),
  version: z.number().int().positive(),
})

export const PlatformEventSchema = z.object({
  id: z.guid(),
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  metadata: PlatformEventMetadataSchema,
  createdAt: z.string().datetime(),
})
