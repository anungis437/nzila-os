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
import { authorizeWorkflowTrigger } from '@/server/authority/workflow-authorizer'
import { WorkflowTriggerRequestSchema } from '@nzila/platform-contracts/control-system'
import { createLogger } from '@nzila/os-core'

export const dynamic = 'force-dynamic'

const logger = createLogger('control-plane:api:authority:authorize-workflow')

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

  logger.info('Workflow authorization request received', {
    workflowId: triggerRequest.workflowId,
    orgId: triggerRequest.orgId,
    requestId: triggerRequest.requestId,
    initiatedBy: triggerRequest.initiatedBy.actorId,
  })

  const result = await authorizeWorkflowTrigger(triggerRequest)

  if (!result.authorized) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        requiresApproval: result.requiresApproval ?? false,
        error: {
          code: result.requiresApproval ? 'APPROVAL_REQUIRED' : 'WORKFLOW_DENIED',
          message: result.reason ?? 'Workflow not authorized',
        },
      },
      { status: result.requiresApproval ? 202 : 403 },
    )
  }

  return NextResponse.json({
    ok: true,
    authorized: true,
    authorization: result.authorization,
  })
}
