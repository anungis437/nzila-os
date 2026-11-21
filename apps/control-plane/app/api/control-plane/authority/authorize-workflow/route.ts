/**
 * Control Plane API — Workflow Authorization
 *
 * POST /api/control-plane/authority/authorize-workflow
 *
 * All workflow trigger requests MUST be authorized here before reaching
 * the Orchestrator. This endpoint evaluates policy, checks entitlements,
 * and returns a signed authorization token.
 *
 * No workflow may execute without a valid authorization decision from here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { authorizeWorkflowTrigger } from '@/lib/services/authority/workflow-authorizer'
import { WorkflowTriggerRequestSchema } from '@nzila/platform-contracts/control-system'
import { createLogger } from '@nzila/os-core'
import { enforceDecision } from '@nzila/decision-core'
import { createPlatformNarProofAdapter } from '@/lib/services/platform-nar-proof'

export const dynamic = 'force-dynamic'

const logger = createLogger('control-plane:api:authority:authorize-workflow')

const narProofAdapter = createPlatformNarProofAdapter()

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
  } catch (err) {
    return handleAuthError(err)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    )
  }

  const parsed = WorkflowTriggerRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid workflow trigger request',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    )
  }

  const triggerRequest = parsed.data

  const actorType =
    triggerRequest.initiatedBy.actorType === 'system'
      ? 'system'
      : triggerRequest.initiatedBy.actorType === 'service'
        ? 'api'
        : 'user'

  const decisionEvaluation = await enforceDecision({
    decisionType: 'platform.workflow.authorized',
    organizationId: triggerRequest.orgId,
    resourceId: triggerRequest.workflowId,
    actor: {
      id: triggerRequest.initiatedBy.actorId,
      type: actorType,
      role: triggerRequest.initiatedBy.actorType,
      authorityScope: ['workflow:authorize'],
    },
    authorityScope: ['workflow:authorize'],
    input: {
      workflowId: triggerRequest.workflowId,
      requestId: triggerRequest.requestId,
      dryRun: triggerRequest.executionContext.dryRun,
      priority: triggerRequest.executionContext.priority,
    },
    policy: {
      id: 'platform.workflow.authorization',
      version: '1.0.0',
      domain: 'platform',
    },
    actionType: 'workflow:authorize',
    proofAdapter: narProofAdapter,
    emitAuditPayload: true,
  })

  if (!decisionEvaluation.allowed) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        error: {
          code: 'DECISION_VALIDATION_FAILED',
          message: 'Decision validation failed before workflow authorization',
        },
        decision: decisionEvaluation.decision,
      },
      { status: 422 },
    )
  }

  logger.info('Workflow authorization request received', {
    workflowId: triggerRequest.workflowId,
    orgId: triggerRequest.orgId,
    requestId: triggerRequest.requestId,
    initiatedBy: triggerRequest.initiatedBy.actorId,
  })

  const result = await authorizeWorkflowTrigger(triggerRequest)

  if (!result.authorized) {
    const decision = {
      ...decisionEvaluation.decision,
      outcome: {
        status: result.requiresApproval ? 'pending' : 'rejected',
        reasonCode: result.requiresApproval ? 'APPROVAL_REQUIRED' : 'WORKFLOW_DENIED',
        explanationTrace: [result.reason ?? 'Workflow not authorized'],
      },
    }

    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        requiresApproval: result.requiresApproval ?? false,
        error: {
          code: result.requiresApproval ? 'APPROVAL_REQUIRED' : 'WORKFLOW_DENIED',
          message: result.reason ?? 'Workflow not authorized',
        },
        decision,
      },
      { status: result.requiresApproval ? 202 : 403 },
    )
  }

  const decision = {
    ...decisionEvaluation.decision,
    outcome: {
      status: 'approved',
      reasonCode: 'WORKFLOW_AUTHORIZED',
      explanationTrace: [result.reason ?? 'Workflow authorized'],
    },
  }

  return NextResponse.json({
    ok: true,
    authorized: true,
    authorization: result.authorization,
    decision,
  })
}
