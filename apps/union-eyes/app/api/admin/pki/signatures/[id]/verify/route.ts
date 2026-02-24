
// =====================================================================================
// PKI Verify Signature API
// =====================================================================================
// POST /api/admin/pki/signatures/[id]/verify - Verify a signature
// =====================================================================================

import { NextResponse } from 'next/server';
import { verifySignature, verifyDocumentIntegrity } from '@/services/pki/verification-service';
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';


const adminPkiSignaturesVerifySchema = z.object({
  verifyType: z.string().optional(),
  documentContent: z.string().optional(),
});

export const POST = withRoleAuth('admin', async (request, context) => {
  const { params } = context as { params: { id: string } };
  try {
      const signatureOrDocumentId = params.id;
      const body = await request.json();
    // Validate request body
    const validation = adminPkiSignaturesVerifySchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { verifyType, documentContent } = validation.data;

      // Determine verification type
      if (verifyType === 'document') {
        // Verify entire document integrity
        const result = await verifyDocumentIntegrity(
          signatureOrDocumentId,
          documentContent ? Buffer.from(documentContent, 'base64') : undefined
        );

        return NextResponse.json({
          success: true,
          verification: result,
        });
      } else {
        // Verify single signature (default)
        const result = await verifySignature(
          signatureOrDocumentId,
          documentContent ? Buffer.from(documentContent, 'base64') : undefined
        );

        return NextResponse.json({
          success: true,
          verification: result,
        });
      }

    } catch (error) {
return NextResponse.json(
        { error: 'Failed to verify signature', details: (error as Error).message },
        { status: 500 }
      );
    }
});
