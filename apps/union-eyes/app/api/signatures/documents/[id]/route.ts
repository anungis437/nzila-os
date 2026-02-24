/**
 * Document Status API
 * GET /api/signatures/documents/[id] - Get document details
 * PATCH /api/signatures/documents/[id] - Update document (void, etc.)
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { SignatureService } from "@/lib/signature/signature-service";

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withApiAuth(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
    
    const documentId = params.id;
    
    // SECURITY FIX: Verify user has access to this document (prevent IDOR)
    const hasAccess = await SignatureService.verifyDocumentAccess(documentId, user.id);
    if (!hasAccess) {
      return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Access denied'
    );
    }

    const document = await SignatureService.getDocumentStatus(documentId);

    return NextResponse.json(document);
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve document',
      error
    );
  }
});


const _signaturesDocumentsSchema = z.object({
  action: z.unknown().optional(),
  reason: z.string().min(1, 'reason is required'),
});


export const PATCH = withApiAuth(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
    
    const userId = user.id;
    const documentId = params.id;
    
    // SECURITY FIX: Verify user has access to this document (prevent IDOR)
    const hasAccess = await SignatureService.verifyDocumentAccess(documentId, userId);
    if (!hasAccess) {
      return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Access denied'
    );
    }
    
    const body = await req.json();
    const { action, reason } = body;

    if (action === "void") {
      if (!reason) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Void reason required'
    );
      }

      await SignatureService.voidDocument(documentId, userId, reason);

      return NextResponse.json({
        success: true,
        message: "Document voided successfully",
      });
    }

    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid action'
    );
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to update document',
      error
    );
  }
});
