// =====================================================================================
// PKI Verify Signature API
// =====================================================================================
// POST /api/admin/pki/signatures/[id]/verify - Verify a signature
// =====================================================================================

import { NextResponse } from 'next/server'
import { verifySignature, verifyDocumentIntegrity } from '@/services/pki/verification-service'
import { z } from 'zod'
import { withRoleAuth } from '@/lib/api-auth-guard'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'
import { logger } from '@/lib/logger'
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit'
import { throwIfUnprovisionedRelation } from '@/lib/api/authorization-denial'

const adminPkiSignaturesVerifySchema = z.object({
  verifyType: z.string().optional(),
  documentContent: z.string().optional(),
})

export const POST = withRoleAuth('admin', async (request, context) => {
  const { params } = context as { params: { id: string } }
  const { organizationId, userId } = context as { organizationId?: string; userId?: string }
  try {
    if (!organizationId || !userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized - Organization context required')
    }
    const signatureOrDocumentId = params.id
    const body = await request.json()
    // Validate request body
    const validation = adminPkiSignaturesVerifySchema.safeParse(body)
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues,
      )
    }

    const { verifyType, documentContent } = validation.data

    const content = documentContent ? Buffer.from(documentContent, 'base64') : undefined
    const isDocument = verifyType === 'document'

    // A verification can record the signature as verified, so it is attributed: who verified what, for whom.
    const result = await performAuditedOperation(
      {
        organizationId,
        userId,
        action: 'pki.signature.verify',
        resourceType: isDocument ? 'signed_document' : 'digital_signature',
        resourceId: signatureOrDocumentId,
        details: { verifyType: isDocument ? 'document' : 'signature', contentSupplied: Boolean(content) },
      },
      async () =>
        isDocument
          ? await verifyDocumentIntegrity(signatureOrDocumentId, content, organizationId)
          : await verifySignature(signatureOrDocumentId, content, organizationId),
    )

    return NextResponse.json({ success: true, verification: result })
  } catch (error) {
    const refused = operationAuditResponse(error)
    if (refused) return NextResponse.json(refused.body, { status: refused.status })
    const message = error instanceof Error ? error.message : ''
    if (message === 'Signature not found' || message === 'No signatures found for document') {
      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Signature not found')
    }
    throwIfUnprovisionedRelation(error)
    logger.error('Failed to verify signature', { error })
    return NextResponse.json({ error: 'Failed to verify signature' }, { status: 500 })
  }
})
