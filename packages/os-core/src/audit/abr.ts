/**
 * ABR Audit Taxonomy
 *
 * Maps all ABR backend mutations into standardized platform-form audit events.
 * Each event carries orgId, actorId, appId, correlationId for full traceability.
 *
 * This module follows the same builder pattern used by:
 * - @nzila/commerce-audit (commerce domain)
 * - @nzila/zonga-core (creator economy domain)
 * - @nzila/tax (finance domain)
 *
 * All events ultimately flow to the shared `audit_events` table with hash chains.
 */

// ── ABR Audit Actions ──────────────────────────────────────────────────────

export const AbrAuditAction = {
  // Case lifecycle
  CASE_CREATED: 'abr.case.created',
  CASE_UPDATED: 'abr.case.updated',
  CASE_STATUS_TRANSITIONED: 'abr.case.status_transitioned',
  CASE_ASSIGNED: 'abr.case.assigned',
  CASE_CLOSED: 'abr.case.closed',

  // Decision lifecycle
  DECISION_ISSUED: 'abr.decision.issued',
  DECISION_APPEALED: 'abr.decision.appealed',

  // Export/reporting
  EXPORT_GENERATED: 'abr.export.generated',
  COMPLIANCE_REPORT_CREATED: 'abr.compliance_report.created',

  // Evidence
  EVIDENCE_ATTACHED: 'abr.evidence.attached',
  EVIDENCE_SEALED: 'abr.evidence.sealed',

  // Integration events
  INTEGRATION_SENT: 'abr.integration.sent',
  INTEGRATION_FAILED: 'abr.integration.failed',

  // AI/ML actions
  AI_CLASSIFICATION_RUN: 'abr.ai.classification_run',
  AI_RISK_ASSESSMENT_RUN: 'abr.ai.risk_assessment_run',
  ML_PREDICTION_RUN: 'abr.ml.prediction_run',

  // Auth/access
  ACCESS_DENIED: 'abr.access.denied',
  RBAC_ROLE_CHANGED: 'abr.rbac.role_changed',
} as const

export type AbrAuditAction = (typeof AbrAuditAction)[keyof typeof AbrAuditAction]

// ── ABR Entity Types ───────────────────────────────────────────────────────

export const AbrEntityType = {
  CASE: 'abr_case',
  DECISION: 'abr_decision',
  EVIDENCE_BUNDLE: 'abr_evidence_bundle',
  COMPLIANCE_REPORT: 'abr_compliance_report',
  EXPORT: 'abr_export',
  USER: 'abr_user',
} as const

export type AbrEntityType = (typeof AbrEntityType)[keyof typeof AbrEntityType]

// ── Audit Event Type ───────────────────────────────────────────────────────

export interface AbrAuditEvent {
  /** The audit action identifier from the taxonomy */
  readonly action: AbrAuditAction

  /** Org that owns this event */
  readonly orgId: string

  /** User/system actor that triggered the event */
  readonly actorId: string

  /** Application identifier — always 'abr' for ABR events */
  readonly appId: 'abr'

  /** Request-scoped correlation ID for distributed tracing */
  readonly correlationId: string

  /** The type of entity being acted upon */
  readonly entityType: AbrEntityType

  /** The specific entity ID */
  readonly entityId: string

  /** Optional state transition (from → to) */
  readonly fromState?: string
  readonly toState?: string

  /** ISO 8601 timestamp */
  readonly timestamp: string

  /** Arbitrary metadata for the action */
  readonly metadata?: Record<string, unknown>
}

// ── Builder ────────────────────────────────────────────────────────────────

export interface BuildAbrAuditOpts {
  action: AbrAuditAction
  orgId: string
  actorId: string
  correlationId: string
  entityType: AbrEntityType
  entityId: string
  fromState?: string
  toState?: string
  metadata?: Record<string, unknown>
}

/**
 * Build a standardized ABR audit event.
 *
 * Pure function — no I/O. The caller is responsible for persisting
 * via the platform audit emitter (`withAudit` or direct `recordAuditEvent`).
 */
export function buildAbrAuditEvent(opts: BuildAbrAuditOpts): AbrAuditEvent {
  return {
    action: opts.action,
    orgId: opts.orgId,
    actorId: opts.actorId,
    appId: 'abr',
    correlationId: opts.correlationId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    fromState: opts.fromState,
    toState: opts.toState,
    timestamp: new Date().toISOString(),
    metadata: opts.metadata,
  }
}

/**
 * Validate that an ABR audit event has all required fields.
 * Returns an array of validation error strings (empty = valid).
 */
export function validateAbrAuditEvent(event: AbrAuditEvent): string[] {
  const errors: string[] = []

  if (!event.orgId) errors.push('orgId is required')
  if (!event.actorId) errors.push('actorId is required')
  if (!event.appId || event.appId !== 'abr') errors.push('appId must be "abr"')
  if (!event.correlationId) errors.push('correlationId is required')
  if (!event.action) errors.push('action is required')
  if (!event.entityType) errors.push('entityType is required')
  if (!event.entityId) errors.push('entityId is required')
  if (!event.timestamp) errors.push('timestamp is required')

  const validActions = Object.values(AbrAuditAction) as string[]
  if (!validActions.includes(event.action)) {
    errors.push(`Unknown action: ${event.action}`)
  }

  const validEntityTypes = Object.values(AbrEntityType) as string[]
  if (!validEntityTypes.includes(event.entityType)) {
    errors.push(`Unknown entityType: ${event.entityType}`)
  }

  return errors
}
