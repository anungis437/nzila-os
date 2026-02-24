// =====================================================================================
// PKI Sign Document API
// =====================================================================================
// POST /api/admin/pki/signatures/[id]/sign - Sign a document
// =====================================================================================

import { NextResponse } from 'next/server';
import { signDocument } from '@/services/pki/signature-service';
import { recordSignature } from '@/services/pki/workflow-engine';
import type { SignDocumentParams } from '@/services/pki/signature-service';
import { z } from "zod";
import { withRoleAuth, type BaseAuthContext } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const adminPkiSignaturesSignSchema = z.object({
  documentType: z.string().min(1, 'documentType is required'),
  documentUrl: z.string().url('Invalid URL'),
  userName: z.string().min(1, 'userName is required'),
  userTitle: z.string().min(1, 'userTitle is required'),
  userEmail: z.string().email('Invalid email address'),
  workflowId: z.string().uuid('Invalid workflowId'),
});

export const POST = withRoleAuth('admin', async (request, context: BaseAuthContext) => {
    const { userId, organizationId } = context;

  try {
      if (!userId || !organizationId) {
        return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized - Organization context required'
    );
      }

      const { id: documentId } = (context.params || {}) as { id: string };
      const body = await request.json();
    // Validate request body
    const validation = adminPkiSignaturesSignSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { documentType, documentUrl, userName, userTitle, userEmail, workflowId } = validation.data;

      if (!documentType || !userName) {
        return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields: documentType, userName'
    );
      }

      // Get client info for audit trail
      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

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
      };

      const signature = await signDocument(signParams);

      // If part of workflow, record signature
      let workflowResult;
      if (workflowId) {
        try {
          workflowResult = await recordSignature(workflowId, userId, signature.signatureId);
        } catch (_error) {
// Continue even if workflow update fails
        }
      }

      return NextResponse.json({
        success: true,
        signature,
        workflow: workflowResult,
        message: 'Document signed successfully',
      });

    } catch (error) {
return NextResponse.json(
        { error: 'Failed to sign document', details: (error as Error).message },
        { status: 500 }
      );
    }
});
