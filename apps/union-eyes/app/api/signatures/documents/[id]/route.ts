/**
 * Document Status API
 * GET /api/signatures/documents/[id] - Get document details
 * PATCH /api/signatures/documents/[id] - Update document (void, etc.)
 * POST /api/signatures/documents/[id] - Refresh the status from the provider (sender only)
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { SignatureService, SignatureAuthorityError } from "@/lib/signature/signature-service";
import { projectSignaturePayload } from "@/lib/documents/signature-projection";
import { signatureViewForViewer } from "@/lib/signature/signer-privacy";

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

    return NextResponse.json(signatureViewForViewer(projectSignaturePayload(document), user.id, document.sentBy));
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve document',
      error
    );
  }
});


const signaturesDocumentsSchema = z.object({
  action: z.literal('void'),
  reason: z.string().trim().min(1, 'reason is required').max(1000),
}).strict();


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
    
    const body = await req.json().catch(() => null);
    const parsed = signaturesDocumentsSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A void action with a reason of at most 1000 characters is required');
    }

    await SignatureService.voidDocument(documentId, userId, parsed.data.reason);

    return NextResponse.json({
      success: true,
      message: "Document voided successfully",
    });
  } catch (error) {
    if (error instanceof SignatureAuthorityError) {
      return standardErrorResponse(
        error.code === "FORBIDDEN" ? ErrorCode.FORBIDDEN : ErrorCode.VALIDATION_ERROR,
        error.message,
      );
    }
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to update document',
      error
    );
  }
});

/**
 * Refresh the status from the provider. Only the sender may do it: the read above never calls the provider or writes.
 */
export const POST = withApiAuth(async (
  _req: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
    }
    const sender = await SignatureService.getDocumentSender(params.id);
    if (!sender || sender !== user.id) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Access denied');
    }
    const result = await SignatureService.syncDocumentStatus(params.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to refresh document status', error);
  }
});
