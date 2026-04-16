/**
 * @nzila/platform-contracts — Control System Canonical Contracts
 *
 * The single authoritative definition of all types, enums, and shapes
 * used across the four-app control system:
 *   - control-plane (authority)
 *   - orchestrator  (execution engine)
 *   - console       (operator interface)
 *   - platform-admin (org-scoped admin)
 *
 * RULE: No app may re-declare these types locally. Import from here.
 * RULE: Changes to this file require a Control Plane maintainer review.
 */
import { z } from 'zod'

// ── Authorized Apps ──────────────────────────────────────────────────────────

export const AuthorizedAppSchema = z.enum([
  'control-plane',
  'orchestrator',
  'console',
  'platform-admin',
])
export type AuthorizedApp = z.infer<typeof AuthorizedAppSchema>

// ── Execution Status ─────────────────────────────────────────────────────────

export const ExecutionStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
  'dead_lettered',
])
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>

// ── Governance Action Status ─────────────────────────────────────────────────

export const GovernanceStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'executed',
  'failed',
  'cancelled',
])
export type GovernanceStatus = z.infer<typeof GovernanceStatusSchema>

// ── Decision Event Types ─────────────────────────────────────────────────────

export const DecisionEventTypeSchema = z.enum([
  'policy.evaluated',
  'entitlement.resolved',
  'workflow.authorized',
  'workflow.denied',
  'governance.action.created',
  'governance.action.submitted',
  'governance.action.approved',
  'governance.action.rejected',
  'governance.action.executed',
  'break_glass.invoked',
  'capability.resolved',
  'integration.registered',
  'runtime_profile.resolved',
])
export type DecisionEventType = z.infer<typeof DecisionEventTypeSchema>

// ── Execution Event Types ────────────────────────────────────────────────────

export const ExecutionEventTypeSchema = z.enum([
  'workflow.run.created',
  'workflow.run.started',
  'workflow.run.step.completed',
  'workflow.run.step.failed',
  'workflow.run.step.retrying',
  'workflow.run.succeeded',
  'workflow.run.failed',
  'workflow.run.cancelled',
  'workflow.run.timed_out',
  'workflow.run.dead_lettered',
])
export type ExecutionEventType = z.infer<typeof ExecutionEventTypeSchema>

// ── Failure Class ────────────────────────────────────────────────────────────

export const FailureClassSchema = z.enum([
  'transient',        // Retry-eligible network/infra blip
  'policy_denied',    // Rejected by Control Plane policy
  'auth_failure',     // Missing or invalid authorization
  'input_invalid',    // Bad input / schema violation
  'dependency_error', // Upstream dependency failure
  'timeout',          // Exceeded SLO
  'permanent',        // Unrecoverable — go to DLQ
  'unknown',
])
export type FailureClass = z.infer<typeof FailureClassSchema>

// ── Retry Policy ─────────────────────────────────────────────────────────────

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  backoffMs: z.number().int().min(0),
  backoffMultiplier: z.number().min(1),
  maxBackoffMs: z.number().int().min(0),
  retryableFailureClasses: z.array(FailureClassSchema),
})
export type RetryPolicy = z.infer<typeof RetryPolicySchema>

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
  retryableFailureClasses: ['transient', 'dependency_error'],
}

// ── Org Scope Identity ───────────────────────────────────────────────────────

export const OrgScopeIdentitySchema = z.object({
  orgId: z.string().uuid(),
  orgName: z.string().optional(),
  tier: z.string().optional(),
})
export type OrgScopeIdentity = z.infer<typeof OrgScopeIdentitySchema>

// ── Actor Identity ───────────────────────────────────────────────────────────

export const ActorIdentitySchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(['user', 'service', 'system', 'break_glass']),
  orgId: z.string().uuid().optional(),
  displayName: z.string().optional(),
})
export type ActorIdentity = z.infer<typeof ActorIdentitySchema>

// ── Correlation Envelope ─────────────────────────────────────────────────────

export const CorrelationEnvelopeSchema = z.object({
  requestId: z.string().uuid(),
  correlationId: z.string().uuid(),
  workflowId: z.string().optional(),
  orgId: z.string().uuid().optional(),
  actorId: z.string().min(1).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  initiatedAt: z.string().datetime(),
})
export type CorrelationEnvelope = z.infer<typeof CorrelationEnvelopeSchema>

// ── Policy Evaluation Request/Response ──────────────────────────────────────

export const PolicyEvalRequestSchema = z.object({
  actor: ActorIdentitySchema,
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  orgId: z.string().uuid(),
  context: z.record(z.unknown()).default({}),
  correlationId: z.string().uuid().optional(),
})
export type PolicyEvalRequest = z.infer<typeof PolicyEvalRequestSchema>

export const PolicyEvalResponseSchema = z.object({
  blocked: z.boolean(),
  needsApproval: z.boolean(),
  reason: z.string().optional(),
  evaluations: z.array(
    z.object({
      policyId: z.string(),
      name: z.string(),
      result: z.enum(['allow', 'block', 'approve_required']),
      reason: z.string().optional(),
    }),
  ),
  approverRoles: z.array(z.string()).default([]),
  requiredApprovers: z.number().int().min(0).default(0),
  decisionId: z.string().uuid().optional(),
  evaluatedAt: z.string().datetime(),
})
export type PolicyEvalResponse = z.infer<typeof PolicyEvalResponseSchema>

// ── Workflow Trigger Contract ────────────────────────────────────────────────

export const WorkflowTriggerRequestSchema = z.object({
  workflowId: z.string().min(1),
  orgId: z.string().uuid(),
  requestId: z.string().uuid(),
  initiatedBy: ActorIdentitySchema,
  payload: z.record(z.unknown()).default({}),
  executionContext: z
    .object({
      dryRun: z.boolean().default(false),
      priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
      timeoutMs: z.number().int().min(0).optional(),
      idempotencyKey: z.string().optional(),
    })
    .default({}),
  correlationEnvelope: CorrelationEnvelopeSchema.optional(),
})
export type WorkflowTriggerRequest = z.infer<typeof WorkflowTriggerRequestSchema>

export const WorkflowAuthorizationSchema = z.object({
  authorized: z.boolean(),
  decisionId: z.string().uuid(),
  workflowId: z.string(),
  orgId: z.string().uuid(),
  authorizedBy: z.string(),
  reason: z.string().optional(),
  requiresApproval: z.boolean().default(false),
  approvalId: z.string().optional(),
  authorizedAt: z.string().datetime(),
})
export type WorkflowAuthorization = z.infer<typeof WorkflowAuthorizationSchema>

// ── Decision Event ───────────────────────────────────────────────────────────

export const DecisionEventSchema = z.object({
  id: z.string().uuid(),
  type: DecisionEventTypeSchema,
  orgId: z.string().uuid(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  outcome: z.enum(['allowed', 'denied', 'approved_required', 'executed', 'recorded']),
  reason: z.string().optional(),
  policyIds: z.array(z.string()).default([]),
  workflowId: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
  recordedAt: z.string().datetime(),
  /** SHA-256 hash chaining immutability marker */
  entryHash: z.string().optional(),
  previousHash: z.string().optional(),
})
export type DecisionEvent = z.infer<typeof DecisionEventSchema>

// ── Execution Run Record ─────────────────────────────────────────────────────

export const ExecutionRunSchema = z.object({
  runId: z.string().uuid(),
  workflowId: z.string().min(1),
  orgId: z.string().uuid(),
  requestId: z.string().uuid(),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().optional(),
  initiatedBy: ActorIdentitySchema,
  status: ExecutionStatusSchema,
  dryRun: z.boolean().default(false),
  retryCount: z.number().int().min(0).default(0),
  failureClass: FailureClassSchema.optional(),
  failureMessage: z.string().optional(),
  decisionId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
  result: z.record(z.unknown()).optional(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  timeoutAt: z.string().datetime().optional(),
})
export type ExecutionRun = z.infer<typeof ExecutionRunSchema>

// ── Audit Reference ──────────────────────────────────────────────────────────

export const AuditReferenceSchema = z.object({
  decisionId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  governanceActionId: z.string().uuid().optional(),
  policyIds: z.array(z.string()).default([]),
  entryHash: z.string().optional(),
  auditTrailUrl: z.string().optional(),
})
export type AuditReference = z.infer<typeof AuditReferenceSchema>

// ── Action Result Shape ──────────────────────────────────────────────────────

export const ControlActionResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
    auditRef: AuditReferenceSchema.optional(),
    correlationId: z.string().uuid().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      failureClass: FailureClassSchema.optional(),
      retryable: z.boolean().default(false),
    }),
    correlationId: z.string().uuid().optional(),
  }),
])
export type ControlActionResult = z.infer<typeof ControlActionResultSchema>

// ── Break-Glass Action ───────────────────────────────────────────────────────

export const BreakGlassActionSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().min(1),
  orgId: z.string().uuid(),
  reason: z.string().min(10),
  resourceType: z.string(),
  resourceId: z.string().optional(),
  approvedBy: z.string().optional(),
  status: z.enum(['pending_approval', 'approved', 'denied', 'executed', 'expired']),
  expiresAt: z.string().datetime().optional(),
  auditRef: AuditReferenceSchema.optional(),
  invokedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
})
export type BreakGlassAction = z.infer<typeof BreakGlassActionSchema>

// ── Health Status ────────────────────────────────────────────────────────────

export const ControlSystemHealthSchema = z.object({
  controlPlane: z.enum(['healthy', 'degraded', 'unavailable']),
  orchestrator: z.enum(['healthy', 'degraded', 'unavailable']),
  database: z.enum(['healthy', 'degraded', 'unavailable']),
  eventBus: z.enum(['healthy', 'degraded', 'unavailable']),
  checkedAt: z.string().datetime(),
})
export type ControlSystemHealth = z.infer<typeof ControlSystemHealthSchema>
