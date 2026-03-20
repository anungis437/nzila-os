/**
 * @nzila/zonga-control-plane — Governance Enforcer
 *
 * Zero blind spots. Every action, admin or system, produces audit metadata.
 * Policy enforcement gates prevent unauthorized or unexplained operations.
 */
import type {
  ControlPlaneContext,
  GovernancePolicyResult,
  GovernanceViolation,
  AdminActionRequest,
  AdminActionResult,
  SystemEvent,
} from './types'
import { AuditSeverity, SystemEventType } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Policy Engine ─────────────────────────────────────────────────────────

export interface GovernancePolicy {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly evaluate: (
    context: ControlPlaneContext,
    entityType: string,
    entity: Record<string, unknown>,
  ) => GovernanceViolation[]
}

const policyRegistry: GovernancePolicy[] = []

export function registerPolicy(policy: GovernancePolicy): void {
  policyRegistry.push(policy)
}

export function listPolicies(): readonly GovernancePolicy[] {
  return [...policyRegistry]
}

/**
 * Validate all registered governance policies against an entity.
 */
export function validateGovernancePolicy(
  context: ControlPlaneContext,
  entityType: string,
  entity: Record<string, unknown>,
): GovernancePolicyResult {
  const violations: GovernanceViolation[] = []

  for (const policy of policyRegistry) {
    const policyViolations = policy.evaluate(context, entityType, entity)
    violations.push(...policyViolations)
  }

  const result: GovernancePolicyResult = {
    policyId: 'aggregate',
    passed: violations.length === 0,
    violations,
    evaluatedAt: new Date(),
  }

  if (violations.length > 0) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.POLICY_VIOLATION_DETECTED,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: (entity['id'] as string) ?? 'unknown',
      entityType,
      correlationId: context.correlationId,
      payload: {
        violationCount: violations.length,
        violations: violations.map((v) => ({
          rule: v.rule,
          message: v.message,
          severity: v.severity,
        })),
      },
      severity: AuditSeverity.WARNING,
    }))
  }

  return result
}

// ── Admin Action Guard ────────────────────────────────────────────────────

/**
 * Guard for admin actions — requires a reason and logs everything.
 * No admin action can execute without passing through this gate.
 */
export function executeAdminAction(request: AdminActionRequest): AdminActionResult {
  // Validate reason is provided and meaningful
  if (!request.reason || request.reason.trim().length < 10) {
    return {
      allowed: false,
      executed: false,
      auditEventId: '',
      denialReason: 'Admin action requires a reason of at least 10 characters',
    }
  }

  // Validate actor has admin role
  if (
    request.context.actorRole !== 'admin' &&
    request.context.actorRole !== 'superadmin' &&
    request.context.actorRole !== 'finance' &&
    request.context.actorRole !== 'compliance'
  ) {
    const event = buildSystemEvent({
      type: SystemEventType.ADMIN_ACTION_EXECUTED,
      orgId: request.context.orgId,
      actorId: request.context.actorId,
      entityId: request.targetEntityId,
      entityType: request.targetEntityType,
      correlationId: request.context.correlationId,
      payload: {
        action: request.action,
        denied: true,
        reason: `Insufficient role: ${request.context.actorRole}`,
      },
      severity: AuditSeverity.WARNING,
      reason: request.reason,
    })
    emitSystemEvent(event)

    return {
      allowed: false,
      executed: false,
      auditEventId: event.id,
      denialReason: `Role "${request.context.actorRole}" is not authorized for admin actions`,
    }
  }

  // Log the admin action
  const event = buildSystemEvent({
    type: SystemEventType.ADMIN_ACTION_EXECUTED,
    orgId: request.context.orgId,
    actorId: request.context.actorId,
    entityId: request.targetEntityId,
    entityType: request.targetEntityType,
    correlationId: request.context.correlationId,
    payload: {
      action: request.action,
      denied: false,
    },
    severity: AuditSeverity.INFO,
    reason: request.reason,
  })
  emitSystemEvent(event)

  return {
    allowed: true,
    executed: true,
    auditEventId: event.id,
  }
}

// ── Built-in Policies ─────────────────────────────────────────────────────

/**
 * Policy: Payouts must have minimum threshold and no active disputes.
 */
export const payoutPolicy: GovernancePolicy = {
  id: 'payout_policy',
  name: 'Payout Governance',
  description: 'Validates payout amount thresholds and dispute status',
  evaluate: (_context, entityType, entity) => {
    if (entityType !== 'payout') return []
    const violations: GovernanceViolation[] = []

    const amount = entity['amount'] as number | undefined
    if (typeof amount === 'number' && amount < 1) {
      violations.push({
        rule: 'minimum_payout_threshold',
        entity: 'payout',
        entityId: (entity['id'] as string) ?? 'unknown',
        message: `Payout amount $${amount} is below minimum threshold ($1.00)`,
        severity: AuditSeverity.ERROR,
      })
    }

    if (entity['hasActiveDispute'] === true) {
      violations.push({
        rule: 'dispute_payout_freeze',
        entity: 'payout',
        entityId: (entity['id'] as string) ?? 'unknown',
        message: 'Payouts are frozen due to active dispute',
        severity: AuditSeverity.ERROR,
      })
    }

    return violations
  },
}

/**
 * Policy: Releases must have valid rights configuration before publishing.
 */
export const releasePolicy: GovernancePolicy = {
  id: 'release_publish_policy',
  name: 'Release Publish Governance',
  description: 'Validates rights configuration before publishing',
  evaluate: (_context, entityType, entity) => {
    if (entityType !== 'release') return []
    const violations: GovernanceViolation[] = []

    if (entity['hasValidRights'] !== true) {
      violations.push({
        rule: 'valid_rights_required',
        entity: 'release',
        entityId: (entity['id'] as string) ?? 'unknown',
        message: 'Release cannot be published without valid rights configuration',
        severity: AuditSeverity.ERROR,
      })
    }

    const splitTotal = entity['splitTotal'] as number | undefined
    if (typeof splitTotal === 'number' && Math.abs(splitTotal - 100) > 0.001) {
      violations.push({
        rule: 'splits_sum_100',
        entity: 'release',
        entityId: (entity['id'] as string) ?? 'unknown',
        message: `Splits sum to ${splitTotal}%, must equal 100%`,
        severity: AuditSeverity.ERROR,
      })
    }

    return violations
  },
}

/**
 * Policy: Events must have valid capacity and ticket configuration.
 */
export const eventPolicy: GovernancePolicy = {
  id: 'event_publish_policy',
  name: 'Event Publish Governance',
  description: 'Validates event capacity and ticket configuration',
  evaluate: (_context, entityType, entity) => {
    if (entityType !== 'event') return []
    const violations: GovernanceViolation[] = []

    const capacity = entity['capacity'] as number | undefined
    if (typeof capacity === 'number' && capacity <= 0) {
      violations.push({
        rule: 'valid_capacity',
        entity: 'event',
        entityId: (entity['id'] as string) ?? 'unknown',
        message: 'Event must have a positive capacity',
        severity: AuditSeverity.ERROR,
      })
    }

    if (entity['hasTicketTypes'] !== true) {
      violations.push({
        rule: 'ticket_types_required',
        entity: 'event',
        entityId: (entity['id'] as string) ?? 'unknown',
        message: 'Event must have at least one ticket type configured',
        severity: AuditSeverity.ERROR,
      })
    }

    return violations
  },
}

// Register built-in policies
registerPolicy(payoutPolicy)
registerPolicy(releasePolicy)
registerPolicy(eventPolicy)
