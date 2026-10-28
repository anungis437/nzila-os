/**
 * Signature Request API
 * POST /api/signatures/documents - Create signature request
 * GET /api/signatures/documents - Get user's documents
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import { clientErrorResponse } from '@/lib/api/authorization-denial';
import { SignatureService, SignatureAuthorityError } from "@/lib/signature/signature-service";
import { MAX_SIGNING_FILE_BYTES, signerListSchema } from "@/lib/signature/signer-verification";
import { projectSignaturePayload } from "@/lib/documents/signature-projection";

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * Create signature request
 */
export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
    
    const userId = user.id;
    // organizationId is derived from the authenticated user, never the
    // request body — a client-supplied value here would let any signed-in
    // user create a signature workflow/signers under another organization.
    const organizationId = user.organizationId;
    if (!organizationId) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Organization context required'
    );
    }

    // Sending a document through the organization's signature provider account is a staff act, not a member's.
    if (!(await hasMinRole('steward'))) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Sending documents for signature requires a steward or officer role');
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const documentType = formData.get("documentType") as string;
    const signersJson = formData.get("signers") as string;
    const provider = formData.get("provider") as string | null;
    const expirationDays = formData.get("expirationDays") as string;
    const requireAuthentication = formData.get("requireAuthentication") as string;
    const sequentialSigning = formData.get("sequentialSigning") as string;

    if (!file || !title || !signersJson) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields'
    );
    }

    let rawSigners: unknown;
    try {
      rawSigners = JSON.parse(signersJson);
    } catch {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid signers JSON'
      );
    }
    const parsedSigners = signerListSchema.safeParse(rawSigners);
    if (!parsedSigners.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid signers', parsedSigners.error.issues);
    }
    const signers = parsedSigners.data;

    if (file.size > MAX_SIGNING_FILE_BYTES) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'The document is too large to send for signature');
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create signature request
    const document = await SignatureService.createSignatureRequest({
      organizationId,
      title,
      description,
      documentType: documentType || "contract",
      file: buffer,
      fileName: file.name,
      sentBy: userId,
      signers,
      provider: (provider as "internal" | "docusign" | "hellosign" | null) || undefined,
      expirationDays: expirationDays ? parseInt(expirationDays) : undefined,
      requireAuthentication: requireAuthentication === "true",
      sequentialSigning: sequentialSigning === "true",
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof SignatureAuthorityError) {
      return standardErrorResponse(
        error.code === 'FORBIDDEN' ? ErrorCode.FORBIDDEN : ErrorCode.VALIDATION_ERROR,
        error.message,
      );
    }
    const denied = clientErrorResponse(error);
    if (denied) return denied;
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to create signature request',
      error
    );
  }
});

/**
 * Get user's documents
 */
export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
    
    const userId = user.id;
    // organizationId is derived from the authenticated user, never the
    // query string — a client-supplied value here would let any signed-in
    // user read another organization's signature documents.
    const organizationId = user.organizationId;

    if (!organizationId) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Organization context required'
    );
    }

    const documents = await SignatureService.getUserDocuments( userId,
      organizationId
    );

    return NextResponse.json(projectSignaturePayload(documents));
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve documents',
      error
    );
  }
});

