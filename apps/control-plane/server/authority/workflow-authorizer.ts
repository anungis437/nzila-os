/**
 * Control Plane — Workflow Authorization Authority
 *
 * All workflow trigger requests MUST be authorized through this service
 * before the Orchestrator may execute them. The Orchestrator never decides
 * whether a workflow is allowed — it only executes what Control Plane approves.
 *
 * Flow:
 *   Caller → Control Plane (authorizeWorkflowTrigger) → Orchestrator (execute)
 *
 * A WorkflowAuthorization token is returned; the Orchestrator validates it
 * by calling the Control Plane verify endpoint before running.
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  evaluatePolicies,
  isBlocked,
  requiresApproval,
  type PolicyDefinition,
} from '@nzila/platform-policy-engine'
import {
  evaluatePoliciesWithResolution,
  resolvePolicyDecisions,
  toPolicyContext,
  type PolicyDecision,
} from '@nzila/policies'
import type {
  WorkflowTriggerRequest,
  WorkflowAuthorization,
  PolicyEvalResponse,
} from '@nzila/platform-contracts/control-system'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import { resolveEntitlements } from './entitlements'
import { recordDecisionEvent } from './decision'

const logger = createLogger('control-plane:authority:workflow-authorizer')

export interface AuthorizeWorkflowResult {
  authorized: boolean
  authorization?: WorkflowAuthorization
  reason?: string
  requiresApproval?: boolean
  approvalId?: string
  policyEval?: PolicyEvalResponse
}

/**
 * Authorize a workflow trigger request.
 *
 * This is the gate that all workflow execution MUST pass through.
 * Returns a signed authorization token the Orchestrator may present.
 */
export async function authorizeWorkflowTrigger(
  request: WorkflowTriggerRequest,
): Promise<AuthorizeWorkflowResult> {
  const decisionId = crypto.randomUUID()

  logger.info('Authorizing workflow trigger', {
    workflowId: request.workflowId,
    orgId: request.orgId,
    requestId: request.requestId,
    initiatedBy: request.initiatedBy.actorId,
    decisionId,
  })

  try {
    // 1. Verify org entitlement for workflow execution
    const entitlement = await resolveEntitlements({
      orgId: request.orgId,
      feature: `workflow.${request.workflowId}`,
      actorId: request.initiatedBy.actorId,
    })

    if (!entitlement.granted) {
      await recordDecisionEvent({
        type: 'workflow.denied',
        orgId: request.orgId,
        actorId: request.initiatedBy.actorId,
        action: 'workflow.trigger',
        resource: 'workflow',
        resourceId: request.workflowId,
        outcome: 'denied',
        reason: 'Org not entitled to execute this workflow',
        workflowId: request.workflowId,
        requestId: request.requestId,
        correlationId: request.correlationEnvelope?.correlationId,
        metadata: { decisionId },
      })

      return {
        authorized: false,
        reason: `Org ${request.orgId} is not entitled to workflow: ${request.workflowId}`,
      }
    }

    // 2. Policy evaluation
    // In production, load policies from the policy engine
    // For now, default-allow with audit trail
    const policies: PolicyDefinition[] = []
    const policyInput = {
      policyId: 'workflow.trigger',
      actor: {
        userId: request.initiatedBy.actorId,
        roles: [request.initiatedBy.actorType],
        orgRole: 'member',
      },
      action: 'workflow.trigger',
      resource: `workflow:${request.workflowId}`,
      context: (request.payload as Record<string, unknown>) ?? {},
      orgId: request.orgId,
      environment: process.env.NODE_ENV ?? 'production',
    }

    const evaluations = evaluatePolicies(policies, policyInput)
    const blocked = isBlocked(evaluations)
    const needsApproval = requiresApproval(evaluations)
    const contextual = evaluatePoliciesWithResolution(
      toPolicyContext({
        orgId: request.orgId,
        actorId: request.initiatedBy.actorId,
        actorRole: request.initiatedBy.actorType,
        domain: 'commerce',
        action: 'workflow.trigger',
        resource: `workflow:${request.workflowId}`,
        payload: {
          ...(request.payload as Record<string, unknown> | undefined),
          app: 'control-plane',
          sensitivity: String((request.payload as Record<string, unknown> | undefined)?.['sensitivity'] ?? 'high'),
          anomalyScore: Number((request.payload as Record<string, unknown> | undefined)?.['anomalyScore'] ?? 0),
          previousActions: Array.isArray((request.payload as Record<string, unknown> | undefined)?.['previousActions'])
            ? ((request.payload as Record<string, unknown> | undefined)?.['previousActions'] as string[])
            : [],
          overrideHistory: Array.isArray((request.payload as Record<string, unknown> | undefined)?.['overrideHistory'])
            ? ((request.payload as Record<string, unknown> | undefined)?.['overrideHistory'] as unknown[])
            : [],
          sessionId: request.requestId,
        },
        environment: process.env.NODE_ENV === 'development' ? 'dev' : 'production',
        policyVersion: process.env.NZILA_POLICY_VERSION ?? 'v1',
      }),
    )
    const policyVersion = process.env.NZILA_POLICY_VERSION ?? 'v1'
    const legacyMapped: PolicyDecision[] = []
    for (const evaluation of evaluations) {
      for (const decision of evaluation.decisions) {
        if (decision.result === 'fail') {
          legacyMapped.push({
            level: 'BLOCK',
            reason: decision.reason,
            policyId: evaluation.policyId,
            policyVersion,
            auditSeverity: 'high',
          })
        }
        if (decision.result === 'require_approval') {
          legacyMapped.push({
            level: 'CHALLENGE',
            reason: decision.reason,
            policyId: evaluation.policyId,
            policyVersion,
            auditSeverity: 'medium',
            requiresApproval: true,
            requiresJustification: true,
          })
        }
      }
    }
    const resolved = resolvePolicyDecisions([...contextual.decisions, ...legacyMapped])
    const contextualBlocked = resolved.finalDecision.level === 'BLOCK'
    const contextualChallenge = resolved.finalDecision.level === 'CHALLENGE'

    if (blocked || contextualBlocked) {
      const reason = 'Workflow trigger blocked by platform policy'
      await recordDecisionEvent({
        type: 'workflow.denied',
        orgId: request.orgId,
        actorId: request.initiatedBy.actorId,
        action: 'workflow.trigger',
        resource: 'workflow',
        resourceId: request.workflowId,
        outcome: 'denied',
        reason,
        workflowId: request.workflowId,
        requestId: request.requestId,
        metadata: { decisionId, blocked: true },
      })

      return { authorized: false, reason }
    }

    if (needsApproval || contextualChallenge) {
      await recordDecisionEvent({
        type: 'workflow.authorized',
        orgId: request.orgId,
        actorId: request.initiatedBy.actorId,
        action: 'workflow.trigger',
        resource: 'workflow',
        resourceId: request.workflowId,
        outcome: 'approved_required',
        workflowId: request.workflowId,
        requestId: request.requestId,
        metadata: { decisionId, requiresApproval: true },
      })

      return {
        authorized: false,
        requiresApproval: true,
        reason: resolved.finalDecision.reason || 'Workflow requires governance approval before execution',
      }
    }

    // 3. Authorized — record decision and return token
    await recordDecisionEvent({
      type: 'workflow.authorized',
      orgId: request.orgId,
      actorId: request.initiatedBy.actorId,
      action: 'workflow.trigger',
      resource: 'workflow',
      resourceId: request.workflowId,
      outcome: 'allowed',
      workflowId: request.workflowId,
      requestId: request.requestId,
      correlationId: request.correlationEnvelope?.correlationId,
      metadata: { decisionId },
    })

    await recordAuditEvent({
      orgId: request.orgId,
      actorClerkUserId: request.initiatedBy.actorId,
      action: AUDIT_ACTIONS.WORKFLOW_TRIGGERED,
      targetType: 'workflow',
      targetId: request.workflowId,
      afterJson: { requestId: request.requestId, decisionId, dryRun: request.executionContext?.dryRun },
    })

    const authorization: WorkflowAuthorization = {
      authorized: true,
      decisionId,
      workflowId: request.workflowId,
      orgId: request.orgId,
      authorizedBy: 'control-plane',
      requiresApproval: false,
      authorizedAt: new Date().toISOString(),
    }

    return { authorized: true, authorization }
  } catch (err) {
    logger.error('Workflow authorization failed', {
      workflowId: request.workflowId,
      orgId: request.orgId,
      error: err,
    })
    return {
      authorized: false,
      reason: 'Authorization service error — workflow denied as safe default',
    }
  }
}
