// =====================================================================================
// PKI Workflow Details API - Status, Advance, Cancel
// =====================================================================================
// GET /api/admin/pki/workflows/[id] - Get workflow status
// PUT /api/admin/pki/workflows/[id] - Advance workflow manually (admin)
// DELETE /api/admin/pki/workflows/[id] - Cancel workflow
// =====================================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkflow,
  getWorkflowStatus,
  cancelWorkflow,
} from '@/services/pki/workflow-engine'
import { z } from 'zod'
import { withAdminAuth } from '@/lib/api-auth-guard'
import { logger } from '@/lib/logger'
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit'

import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'
// The in-memory workflow engine reports unknown and already-settled workflows with plain Errors;
// those are client conditions (404/409), not server faults.
function workflowErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Workflow not found')
    return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found')
  if (
    message === 'Workflow is not in progress' ||
    message === 'Workflow already started or completed' ||
    message === 'Cannot cancel completed workflow'
  )
    return NextResponse.json({ error: message }, { status: 409 })
  return null
}

// A workflow belongs to one organization. A workflow of another organization is indistinguishable from a missing one,
// so an administrator cannot read, advance or cancel it by guessing its id.
function ownedWorkflow(workflowId: string, organizationId: string | null | undefined) {
  const workflow = getWorkflow(workflowId)
  if (!workflow || !organizationId || workflow.organizationId !== organizationId) return null
  return workflow
}

export const GET = async (
  request: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams
  return withAdminAuth(async (request, context) => {
    try {
      const workflowId = params.id
      const { searchParams } = new URL(request.url)
      const detailLevel = searchParams.get('detail') || 'status'

      const workflow = ownedWorkflow(workflowId, context.organizationId)
      if (!workflow) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found')
      }

      if (detailLevel === 'full') {

        return NextResponse.json({
          success: true,
          workflow,
        })
      } else {
        // Get workflow status summary (default)
        const status = getWorkflowStatus(workflowId)

        return NextResponse.json({
          success: true,
          status,
        })
      }
    } catch (error) {
      const clientError = workflowErrorResponse(error)
      if (clientError) return clientError
      logger.error('Failed to fetch workflow', { error })
      return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 })
    }
  })(request, { params })
}

const adminPkiWorkflowsSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
})

export const PUT = async (
  request: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams
  return withAdminAuth(async (_request, context) => {
    // Advancing a workflow by hand moves it past signatures that have not been given. A workflow advances only when
    // its current signers sign (recordSignature), so no administrator override is offered.
    const workflow = ownedWorkflow(params.id, context.organizationId)
    if (!workflow) return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found')
    return NextResponse.json(
      {
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'A signing workflow advances only when its signers sign; it cannot be advanced manually.',
        },
      },
      { status: 501 },
    )
  })(request, { params })
}

export const DELETE = async (
  request: NextRequest,
  { params: pendingParams }: { params: Promise<{ id: string }> },
) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams
  return withAdminAuth(async (request, context) => {
    const { userId } = context

    try {
      const workflowId = params.id
      if (!ownedWorkflow(workflowId, context.organizationId)) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found')
      }
      const body = await request.json()
      // Validate request body
      const validation = adminPkiWorkflowsSchema.safeParse(body)
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid request data',
          validation.error.issues,
        )
      }

      const { reason } = validation.data

      if (!reason) {
        return standardErrorResponse(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Cancellation reason required',
        )
      }

      await performAuditedOperation(
        {
          organizationId: context.organizationId,
          userId,
          action: 'pki.workflow.cancel',
          resourceType: 'signing_workflow',
          resourceId: workflowId,
          details: { reason },
        },
        async () => cancelWorkflow(workflowId, userId as string, reason),
      )

      return NextResponse.json({
        success: true,
        message: 'Workflow cancelled successfully',
      })
    } catch (error) {
      const refused = operationAuditResponse(error)
      if (refused) return NextResponse.json(refused.body, { status: refused.status })
      const clientError = workflowErrorResponse(error)
      if (clientError) return clientError
      logger.error('Failed to cancel workflow', { error })
      return NextResponse.json({ error: 'Failed to cancel workflow' }, { status: 500 })
    }
  })(request, { params })
}
