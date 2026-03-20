/**
 * @nzila/zonga-control-plane — Core Types
 *
 * Central type definitions for the Zonga control plane.
 * Every critical action flows through this layer.
 */
import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const WorkflowId = {
  ARTIST_ONBOARDING: 'artist_onboarding_flow',
  RELEASE_PUBLISH: 'release_publish_flow',
  TRACK_UPLOAD_PROCESSING: 'track_upload_processing_flow',
  EVENT_CREATION: 'event_creation_flow',
  TICKET_PURCHASE: 'ticket_purchase_flow',
  TICKET_SCAN: 'ticket_scan_flow',
  REFUND: 'refund_flow',
  PAYOUT_SETTLEMENT: 'payout_settlement_flow',
  RIGHTS_UPDATE: 'rights_update_flow',
  DISPUTE_RESOLUTION: 'dispute_resolution_flow',
  MODERATION: 'moderation_flow',
  PAYMENT_FAILURE_RECOVERY: 'payment_failure_recovery_flow',
} as const
export type WorkflowId = (typeof WorkflowId)[keyof typeof WorkflowId]

export const WorkflowStepStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  COMPENSATING: 'compensating',
  COMPENSATED: 'compensated',
  SKIPPED: 'skipped',
} as const
export type WorkflowStepStatus = (typeof WorkflowStepStatus)[keyof typeof WorkflowStepStatus]

export const WorkflowExecutionStatus = {
  CREATED: 'created',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  COMPENSATING: 'compensating',
  COMPENSATED: 'compensated',
  TIMED_OUT: 'timed_out',
} as const
export type WorkflowExecutionStatus =
  (typeof WorkflowExecutionStatus)[keyof typeof WorkflowExecutionStatus]

export const SystemEventType = {
  // Economic
  REVENUE_RECORDED: 'revenue.recorded',
  LEDGER_ENTRY_CREATED: 'ledger.entry_created',
  LEDGER_INTEGRITY_FAILURE: 'ledger.integrity_failure',
  PAYOUT_INITIATED: 'payout.initiated',
  PAYOUT_COMPLETED: 'payout.completed',
  PAYOUT_FAILED: 'payout.failed',
  RECONCILIATION_COMPLETED: 'reconciliation.completed',
  RECONCILIATION_DISCREPANCY: 'reconciliation.discrepancy',

  // Workflow
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_STEP_COMPLETED: 'workflow.step_completed',
  WORKFLOW_STEP_FAILED: 'workflow.step_failed',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  WORKFLOW_COMPENSATING: 'workflow.compensating',
  WORKFLOW_COMPENSATED: 'workflow.compensated',

  // Rights
  RIGHTS_UPDATED: 'rights.updated',
  RIGHTS_DISPUTE_FILED: 'rights.dispute_filed',
  RIGHTS_DISPUTE_RESOLVED: 'rights.dispute_resolved',
  PAYOUT_FROZEN: 'payout.frozen',
  PAYOUT_UNFROZEN: 'payout.unfrozen',

  // Events/Tickets
  EVENT_CREATED: 'event.created',
  EVENT_PUBLISHED: 'event.published',
  TICKET_PURCHASED: 'ticket.purchased',
  TICKET_SCANNED: 'ticket.scanned',
  TICKET_SCAN_DUPLICATE: 'ticket.scan_duplicate',
  TICKET_REFUNDED: 'ticket.refunded',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_OVERSELL_BLOCKED: 'inventory.oversell_blocked',

  // Content
  RELEASE_PUBLISHED: 'release.published',
  TRACK_UPLOADED: 'track.uploaded',
  TRACK_PROCESSED: 'track.processed',
  CONTENT_MODERATED: 'content.moderated',
  CONTENT_TAKEN_DOWN: 'content.taken_down',

  // Creator
  CREATOR_ONBOARDED: 'creator.onboarded',
  CREATOR_SUSPENDED: 'creator.suspended',
  CREATOR_ACTIVATED: 'creator.activated',

  // AI/Fraud
  FRAUD_SIGNAL_DETECTED: 'fraud.signal_detected',
  AI_INFERENCE_COMPLETED: 'ai.inference_completed',

  // Admin
  ADMIN_ACTION_EXECUTED: 'admin.action_executed',

  // Governance
  POLICY_VIOLATION_DETECTED: 'governance.policy_violation',
  INVARIANT_VIOLATION_DETECTED: 'governance.invariant_violation',
} as const
export type SystemEventType = (typeof SystemEventType)[keyof typeof SystemEventType]

export const InvariantId = {
  NO_REVENUE_WITHOUT_LEDGER: 'invariant.no_revenue_without_ledger',
  NO_PAYOUT_WITHOUT_BACKING: 'invariant.no_payout_without_backing',
  NO_EVENT_OVERSELL: 'invariant.no_event_oversell',
  NO_INVALID_RIGHTS_SPLIT: 'invariant.no_invalid_rights_split',
  NO_AUDITLESS_ACTION: 'invariant.no_auditless_action',
  NO_WORKFLOW_BYPASS: 'invariant.no_workflow_bypass',
  LEDGER_BALANCED: 'invariant.ledger_balanced',
  NO_NEGATIVE_PAYOUT: 'invariant.no_negative_payout',
  SPLITS_SUM_100: 'invariant.splits_sum_100',
} as const
export type InvariantId = (typeof InvariantId)[keyof typeof InvariantId]

export const AuditSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const
export type AuditSeverity = (typeof AuditSeverity)[keyof typeof AuditSeverity]

// ── Core Interfaces ───────────────────────────────────────────────────────

export interface ControlPlaneContext {
  readonly orgId: string
  readonly actorId: string
  readonly actorRole: string
  readonly correlationId: string
  readonly requestId: string
  readonly timestamp: Date
  readonly reason?: string
  readonly metadata?: Record<string, unknown>
}

export interface SystemEvent {
  readonly id: string
  readonly type: SystemEventType
  readonly orgId: string
  readonly actorId: string
  readonly entityId: string
  readonly entityType: string
  readonly correlationId: string
  readonly workflowId?: string
  readonly workflowExecutionId?: string
  readonly timestamp: Date
  readonly payload: Record<string, unknown>
  readonly beforeState?: Record<string, unknown>
  readonly afterState?: Record<string, unknown>
  readonly severity: AuditSeverity
  readonly reason?: string
}

export interface WorkflowStep {
  readonly id: string
  readonly name: string
  readonly status: WorkflowStepStatus
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly error?: string
  readonly retryCount: number
  readonly maxRetries: number
  readonly compensationStepId?: string
  readonly output?: Record<string, unknown>
}

export interface WorkflowExecution {
  readonly id: string
  readonly workflowId: WorkflowId
  readonly orgId: string
  readonly actorId: string
  readonly correlationId: string
  readonly status: WorkflowExecutionStatus
  readonly steps: readonly WorkflowStep[]
  readonly currentStepIndex: number
  readonly input: Record<string, unknown>
  readonly output?: Record<string, unknown>
  readonly startedAt: Date
  readonly completedAt?: Date
  readonly error?: string
  readonly retryCount: number
  readonly maxRetries: number
  readonly timeoutMs: number
}

export interface WorkflowDefinition {
  readonly id: WorkflowId
  readonly name: string
  readonly description: string
  readonly steps: readonly WorkflowStepDefinition[]
  readonly maxRetries: number
  readonly timeoutMs: number
}

export interface WorkflowStepDefinition {
  readonly id: string
  readonly name: string
  readonly execute: (
    context: ControlPlaneContext,
    input: Record<string, unknown>,
    previousOutput?: Record<string, unknown>,
  ) => Promise<WorkflowStepResult>
  readonly compensate?: (
    context: ControlPlaneContext,
    input: Record<string, unknown>,
    stepOutput: Record<string, unknown>,
  ) => Promise<void>
  readonly maxRetries: number
  readonly timeoutMs: number
}

export interface WorkflowStepResult {
  readonly success: boolean
  readonly output?: Record<string, unknown>
  readonly error?: string
  readonly shouldRetry?: boolean
}

export interface InvariantCheck {
  readonly id: InvariantId
  readonly name: string
  readonly passed: boolean
  readonly details?: string
  readonly checkedAt: Date
}

export interface InvariantCheckResult {
  readonly allPassed: boolean
  readonly checks: readonly InvariantCheck[]
  readonly failures: readonly InvariantCheck[]
  readonly checkedAt: Date
}

export interface EconomicIntegrityResult {
  readonly ledgerBalanced: boolean
  readonly totalDebits: number
  readonly totalCredits: number
  readonly discrepancy: number
  readonly unreconciledTransactions: readonly string[]
  readonly payoutsWithoutBacking: readonly string[]
  readonly revenueWithoutLedger: readonly string[]
  readonly checkedAt: Date
}

export interface GovernancePolicyResult {
  readonly policyId: string
  readonly passed: boolean
  readonly violations: readonly GovernanceViolation[]
  readonly evaluatedAt: Date
}

export interface GovernanceViolation {
  readonly rule: string
  readonly entity: string
  readonly entityId: string
  readonly message: string
  readonly severity: AuditSeverity
}

export interface DisputeImpactAssessment {
  readonly disputeId: string
  readonly frozenPayoutIds: readonly string[]
  readonly frozenRoyaltyAccrualIds: readonly string[]
  readonly totalFrozenAmount: number
  readonly affectedCreators: readonly string[]
  readonly requiresManualReview: boolean
  readonly recommendedAction: string
}

export interface AuditQueryFilter {
  readonly entityId?: string
  readonly entityType?: string
  readonly actorId?: string
  readonly workflowId?: string
  readonly correlationId?: string
  readonly eventType?: SystemEventType
  readonly severity?: AuditSeverity
  readonly fromDate?: Date
  readonly toDate?: Date
}

export interface AuditQueryResult {
  readonly events: readonly SystemEvent[]
  readonly totalCount: number
  readonly hasMore: boolean
}

export interface AdminActionRequest {
  readonly action: string
  readonly targetEntityId: string
  readonly targetEntityType: string
  readonly reason: string
  readonly context: ControlPlaneContext
}

export interface AdminActionResult {
  readonly allowed: boolean
  readonly executed: boolean
  readonly auditEventId: string
  readonly denialReason?: string
}

export interface PaymentRecoveryResult {
  readonly intentId: string
  readonly recovered: boolean
  readonly newStatus: string
  readonly retryCount: number
  readonly nextRetryAt?: Date
  readonly error?: string
}

export interface OfflineSyncResult {
  readonly synced: number
  readonly conflicts: number
  readonly resolved: number
  readonly failed: number
  readonly pendingItems: readonly OfflineSyncItem[]
}

export interface OfflineSyncItem {
  readonly id: string
  readonly type: string
  readonly action: string
  readonly timestamp: Date
  readonly data: Record<string, unknown>
  readonly conflictWith?: string
  readonly resolution?: 'local_wins' | 'remote_wins' | 'merged' | 'manual'
}

export interface ObservabilityMetric {
  readonly name: string
  readonly value: number
  readonly labels: Record<string, string>
  readonly timestamp: Date
}

export interface AIControlResult {
  readonly modelId: string
  readonly featureFlag: string
  readonly enabled: boolean
  readonly inferenceResult?: Record<string, unknown>
  readonly explanation?: string
  readonly confidence?: number
  readonly logged: boolean
}

// ── Schemas ───────────────────────────────────────────────────────────────

export const ControlPlaneContextSchema = z.object({
  orgId: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.string().min(1),
  correlationId: z.string().min(1),
  requestId: z.string().min(1),
  timestamp: z.date(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  input: z.record(z.unknown()),
  context: ControlPlaneContextSchema,
})
export type ExecuteWorkflowInput = z.infer<typeof ExecuteWorkflowSchema>

export const AdminActionSchema = z.object({
  action: z.string().min(1),
  targetEntityId: z.string().min(1),
  targetEntityType: z.string().min(1),
  reason: z.string().min(10, 'Admin action reason must be at least 10 characters'),
})

export const AuditQuerySchema = z.object({
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  actorId: z.string().optional(),
  workflowId: z.string().optional(),
  correlationId: z.string().optional(),
  eventType: z.string().optional(),
  severity: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
})
export type AuditQueryInput = z.infer<typeof AuditQuerySchema>
