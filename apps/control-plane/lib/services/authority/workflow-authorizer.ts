/**
 * Control Plane — Workflow Authorization Authority
 *
 * All workflow trigger requests MUST be authorized through this service
 * before the Orchestrator may execute them. The Orchestrator never decides
 * whether a workflow is allowed — it only executes what Control Plane approves.
 *
 * Authorization pipeline (deny-by-default at every gate):
 *   1.  Look up the workflow's registered policy.        →  NO_POLICY_REGISTERED
 *   2.  Verify org entitlement for the workflow feature. →  ORG_NOT_ENTITLED
 *   3.  Evaluate the policy (actor/role/action gates).   →  policy reason code
 *   4.  Persist the decision in `decision_events`.
 *   5.  Return a WorkflowAuthorization token to the Orchestrator.
 *
 * No path returns `authorized: true` without (a) a matching registered
 * policy, (b) a granted entitlement, and (c) a successfully persisted
 * decision event. Persistence failures are treated as denials.
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import type {
  PolicyEvalResponse,
  WorkflowAuthorization,
  WorkflowTriggerRequest,
} from '@nzila/platform-contracts/control-system'

import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'

import { recordDecisionEvent } from './decision'
import { resolveEntitlements } from './entitlements'
import {
  evaluateWorkflowPolicy,
  type PolicyEvaluationContext,
  type WorkflowPolicy,
} from './policy-registry'

const logger = createLogger('control-plane:authority:workflow-authorizer')

export interface AuthorizeWorkflowResult {
  authorized: boolean
  authorization?: WorkflowAuthorization
  decisionId?: string
  policyId?: string
  policyVersion?: string
  reasonCode?: string
  reason?: string
  requiresApproval?: boolean
  approvalId?: string
  approverRoles?: readonly string[]
  policyEval?: PolicyEvalResponse
}

/**
 * Authorize a workflow trigger request. Returns a WorkflowAuthorization
 * token when authorized, or a structured denial with a stable reasonCode.
 */
export async function authorizeWorkflowTrigger(
  request: WorkflowTriggerRequest,
): Promise<AuthorizeWorkflowResult> {
  const correlationId = request.correlationEnvelope?.correlationId
  const traceId = request.correlationEnvelope?.traceId

  logger.info('Authorizing workflow trigger', {
    workflowId: request.workflowId,
    orgId: request.orgId,
    requestId: request.requestId,
    initiatedBy: request.initiatedBy.actorId,
    correlationId,
  })

  // Derive the actor role. The transport contract does not yet carry a role
  // separate from actorType, so we use actorType as the canonical role. When
  // a richer role claim arrives via the payload or correlation envelope we
  // prefer it explicitly — never silently default to a privileged value.
  const payloadRole = (request.payload as Record<string, unknown> | undefined)?.['actorRole']
  const actorRole = typeof payloadRole === 'string' && payloadRole.length > 0
    ? payloadRole
    : request.initiatedBy.actorType

  const baseContext: PolicyEvaluationContext = {
    workflowId: request.workflowId,
    orgId: request.orgId,
    action: 'workflow.trigger',
    resourceType: 'workflow',
    resourceId: request.workflowId,
    actor: request.initiatedBy,
    actorRole,
    payload: (request.payload as Record<string, unknown>) ?? {},
    executionContext: request.executionContext,
    correlationId,
    requestId: request.requestId,
  }

  // ── 1. Policy lookup ──────────────────────────────────────────────────
  const { policy, decision: policyDecision } = evaluateWorkflowPolicy(baseContext)

  if (!policy) {
    return persistDenialAndReturn({
      request,
      actorRole,
      domain: 'platform',
      policyId: 'unregistered',
      policyVersion: '0',
      reasonCode: policyDecision.reasonCode,
      reason: policyDecision.explanation,
      correlationId,
      traceId,
    })
  }

  // ── 2. Entitlement check ──────────────────────────────────────────────
  let entitlement
  try {
    entitlement = await resolveEntitlements({
      orgId: request.orgId,
      feature: `workflow.${request.workflowId}`,
      actorId: request.initiatedBy.actorId,
    })
  } catch (err) {
    logger.error('Entitlement resolution failed — denying workflow', {
      workflowId: request.workflowId,
      orgId: request.orgId,
      error: err instanceof Error ? err.message : String(err),
    })
    return persistDenialAndReturn({
      request,
      actorRole,
      policy,
      reasonCode: 'ENTITLEMENT_RESOLUTION_ERROR',
      reason: 'Entitlement service error — workflow denied as safe default',
      correlationId,
      traceId,
    })
  }

  if (!entitlement.granted) {
    return persistDenialAndReturn({
      request,
      actorRole,
      policy,
      reasonCode: 'ORG_NOT_ENTITLED',
      reason: `Org ${request.orgId} is not entitled to workflow ${request.workflowId}.`,
      correlationId,
      traceId,
    })
  }

  // ── 3. Honor policy decision ──────────────────────────────────────────
  if (policyDecision.decision === 'denied') {
    return persistDenialAndReturn({
      request,
      actorRole,
      policy,
      reasonCode: policyDecision.reasonCode,
      reason: policyDecision.explanation,
      correlationId,
      traceId,
    })
  }

  if (policyDecision.decision === 'approval_required') {
    let record
    try {
      record = await recordDecisionEvent({
        type: 'workflow.authorized',
        orgId: request.orgId,
        domain: policy.domain,
        actorId: request.initiatedBy.actorId,
        actorRole,
        action: 'workflow.trigger',
        resource: 'workflow',
        resourceId: request.workflowId,
        outcome: 'approved_required',
        reasonCode: policyDecision.reasonCode,
        reason: policyDecision.explanation,
        policyId: policy.id,
        policyVersion: policy.version,
        workflowId: request.workflowId,
        requestId: request.requestId,
        correlationId,
        traceId,
        evaluatedContext: buildEvaluatedContext(baseContext, policy),
      })
    } catch (err) {
      logger.error('Persistence failure during approval-required path', {
        workflowId: request.workflowId,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        authorized: false,
        reasonCode: 'DECISION_PERSISTENCE_FAILED',
        reason: 'Could not durably record the policy decision; workflow denied.',
      }
    }

    return {
      authorized: false,
      requiresApproval: true,
      decisionId: record.id,
      policyId: policy.id,
      policyVersion: policy.version,
      reasonCode: policyDecision.reasonCode,
      reason: policyDecision.explanation,
      approverRoles: policyDecision.approverRoles,
    }
  }

  // ── 4. Allowed — persist + audit ──────────────────────────────────────
  let record
  try {
    record = await recordDecisionEvent({
      type: 'workflow.authorized',
      orgId: request.orgId,
      domain: policy.domain,
      actorId: request.initiatedBy.actorId,
      actorRole,
      action: 'workflow.trigger',
      resource: 'workflow',
      resourceId: request.workflowId,
      outcome: 'allowed',
      reasonCode: policyDecision.reasonCode,
      reason: policyDecision.explanation,
      policyId: policy.id,
      policyVersion: policy.version,
      workflowId: request.workflowId,
      requestId: request.requestId,
      correlationId,
      traceId,
      evaluatedContext: buildEvaluatedContext(baseContext, policy),
    })
  } catch (err) {
    logger.error('Persistence failure during authorized path — denying', {
      workflowId: request.workflowId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      authorized: false,
      reasonCode: 'DECISION_PERSISTENCE_FAILED',
      reason: 'Could not durably record the policy decision; workflow denied.',
    }
  }

  // Mirror to audit ledger (non-fatal — decision_events is canonical).
  try {
    await recordAuditEvent({
      orgId: request.orgId,
      actorClerkUserId: request.initiatedBy.actorId,
      action: AUDIT_ACTIONS.WORKFLOW_TRIGGERED,
      targetType: 'workflow',
      targetId: request.workflowId,
      afterJson: {
        requestId: request.requestId,
        decisionId: record.id,
        policyId: policy.id,
        policyVersion: policy.version,
        dryRun: request.executionContext?.dryRun,
      },
    })
  } catch (auditErr) {
    logger.warn('Audit mirror failed for workflow authorization', {
      decisionId: record.id,
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    })
  }

  const authorization: WorkflowAuthorization = {
    authorized: true,
    decisionId: record.id,
    workflowId: request.workflowId,
    orgId: request.orgId,
    authorizedBy: 'control-plane',
    requiresApproval: false,
    authorizedAt: record.recordedAt,
  }

  return {
    authorized: true,
    authorization,
    decisionId: record.id,
    policyId: policy.id,
    policyVersion: policy.version,
    reasonCode: policyDecision.reasonCode,
    reason: policyDecision.explanation,
  }
}

// ── Internals ────────────────────────────────────────────────────────────────

interface PersistDenialArgs {
  request: WorkflowTriggerRequest
  actorRole: string
  policy?: WorkflowPolicy
  domain?: string
  policyId?: string
  policyVersion?: string
  reasonCode: string
  reason: string
  correlationId?: string
  traceId?: string
}

async function persistDenialAndReturn(args: PersistDenialArgs): Promise<AuthorizeWorkflowResult> {
  const policyId = args.policy?.id ?? args.policyId ?? 'unregistered'
  const policyVersion = args.policy?.version ?? args.policyVersion ?? '0'
  const domain = args.policy?.domain ?? args.domain ?? 'platform'

  try {
    const record = await recordDecisionEvent({
      type: 'workflow.denied',
      orgId: args.request.orgId,
      domain,
      actorId: args.request.initiatedBy.actorId,
      actorRole: args.actorRole,
      action: 'workflow.trigger',
      resource: 'workflow',
      resourceId: args.request.workflowId,
      outcome: 'denied',
      reasonCode: args.reasonCode,
      reason: args.reason,
      policyId,
      policyVersion,
      workflowId: args.request.workflowId,
      requestId: args.request.requestId,
      correlationId: args.correlationId,
      traceId: args.traceId,
      evaluatedContext: {
        actorType: args.request.initiatedBy.actorType,
        actorRole: args.actorRole,
        dryRun: args.request.executionContext?.dryRun ?? false,
        priority: args.request.executionContext?.priority ?? 'normal',
      },
    })
    return {
      authorized: false,
      decisionId: record.id,
      policyId,
      policyVersion,
      reasonCode: args.reasonCode,
      reason: args.reason,
    }
  } catch (err) {
    logger.error('Failed to persist workflow denial — surfacing denial without decisionId', {
      workflowId: args.request.workflowId,
      reasonCode: args.reasonCode,
      error: err instanceof Error ? err.message : String(err),
    })
    // Persistence failed but the denial stands. Caller receives a denial
    // without a decisionId; the orchestrator will reject regardless.
    return {
      authorized: false,
      policyId,
      policyVersion,
      reasonCode: args.reasonCode,
      reason: args.reason,
    }
  }
}

function buildEvaluatedContext(
  ctx: PolicyEvaluationContext,
  policy: WorkflowPolicy,
): Record<string, unknown> {
  return {
    actorType: ctx.actor.actorType,
    actorRole: ctx.actorRole,
    action: ctx.action,
    resourceType: ctx.resourceType,
    resourceId: ctx.resourceId,
    dryRun: ctx.executionContext?.dryRun ?? false,
    priority: ctx.executionContext?.priority ?? 'normal',
    policyDomain: policy.domain,
    payloadKeys: Object.keys(ctx.payload ?? {}),
    // Governance lifecycle traceability — set for governed_policies rows,
    // null for statically-registered policies not yet migrated.
    policyHash: policy.policyHash ?? null,
  }
}
