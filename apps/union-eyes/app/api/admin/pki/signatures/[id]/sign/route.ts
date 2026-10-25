// =====================================================================================
// PKI Sign Document API
// =====================================================================================
// POST /api/admin/pki/signatures/[id]/sign - Sign a document
// =====================================================================================

import { NextResponse } from 'next/server'
import { signDocument } from '@/services/pki/signature-service'
import { getWorkflow, recordSignature } from '@/services/pki/workflow-engine'
import type { SignDocumentParams } from '@/services/pki/signature-service'
import { z } from 'zod'
import { withRoleAuth, type BaseAuthContext } from '@/lib/api-auth-guard'
import { logger } from '@/lib/logger'
import { and, eq } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { organizationMembers } from '@/db/schema/organization-members-schema'
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit'
import { throwIfUnprovisionedRelation } from '@/lib/api/authorization-denial'

import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'

const adminPkiSignaturesSignSchema = z.object({
  documentType: z.string().min(1, 'documentType is required'),
  documentUrl: z.string().url('Invalid URL'),
  userName: z.string().min(1, 'userName is required'),
  userTitle: z.string().min(1, 'userTitle is required'),
  userEmail: z.string().email('Invalid email address'),
  workflowId: z.string().uuid('Invalid workflowId'),
})

export const POST = withRoleAuth('admin', async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context

  try {
    if (!userId || !organizationId) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Unauthorized - Organization context required',
      )
    }

    const { id: documentId } = (context.params || {}) as { id: string }
    const body = await request.json()
    // Validate request body
    const validation = adminPkiSignaturesSignSchema.safeParse(body)
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors,
      )
    }

    const { documentType, documentUrl, userName, userTitle, userEmail, workflowId } =
      validation.data

    if (!documentType || !userName) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Missing required fields: documentType, userName',
      )
    }

    // Get client info for audit trail
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // A signature can only be recorded into one of this organization's own workflows.
    const targetWorkflow = getWorkflow(workflowId)
    if (!targetWorkflow || targetWorkflow.organizationId !== organizationId) {
      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Workflow not found')
    }

    // Sign document
    const signParams: SignDocumentParams = {
      documentId,
      documentType,
      documentUrl,
      userId,
      userName,
      userTitle,
      userEmail,
      organizationId: organizationId,
      ipAddress,
      userAgent,
    }

    // The signer's identity is the session's, not the request body's: the name and email that are bound into the
    // signature must be the caller's own membership record.
    const [member] = await withRLSContext({ organizationId }, (tx) =>
      tx
        .select({ email: organizationMembers.email })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
        .limit(1),
    )
    if (!member?.email || member.email.toLowerCase() !== userEmail.toLowerCase()) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'A document can only be signed as the authenticated member')
    }

    const signature = await performAuditedOperation(
      {
        organizationId,
        userId,
        action: 'pki.document.sign',
        resourceType: 'digital_signature',
        resourceId: documentId,
        details: { documentType, workflowId },
      },
      () => signDocument(signParams),
    )

    let workflowResult
    let workflowRecorded = true
    try {
      workflowResult = await recordSignature(workflowId, userId, signature.signatureId)
    } catch (_error) {
      workflowRecorded = false
    }

    return NextResponse.json({
      success: true,
      signature,
      workflow: workflowResult,
      workflowRecorded,
      message: workflowRecorded
        ? 'Document signed successfully'
        : 'Document signed; the signature could not be recorded into the workflow',
    })
  } catch (error) {
    const refused = operationAuditResponse(error)
    if (refused) return NextResponse.json(refused.body, { status: refused.status })
    throwIfUnprovisionedRelation(error)
    logger.error('Failed to sign document', { error })
    return NextResponse.json({ error: 'Failed to sign document' }, { status: 500 })
  }
})
