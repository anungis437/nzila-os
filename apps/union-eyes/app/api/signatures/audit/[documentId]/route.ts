/**
 * Signature Audit Trail API
 * GET /api/signatures/audit/[documentId] - Get document audit trail
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { AuditTrailService, SignatureService } from "@/lib/signature/signature-service";
import { signatureViewForViewer } from "@/lib/signature/signer-privacy";
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// The access check, the sender lookup and the audit reads run in the caller organization's tenant transaction (`rlsOrgContext`). A signed-in
// identity without an active organization is refused by the wrapper before any document lookup: it cannot read signer identities, IP
// addresses or audit events.
export const GET = withApi(
  {
    auth: { required: true },
    rlsOrgContext: true,
    openapi: { tags: ['Signatures'], summary: 'Read the audit trail of a signature document' },
  },
  async ({ request, userId, organizationId, params }) => {
  try {
    const documentId = params.documentId;
    // A malformed id is a client error here, never a database fault handed back as a 500.
    if (!z.guid().safeParse(documentId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document id');
    }

    // SECURITY FIX (PR #752 round 49): verify the caller has access to this
    // document before returning its audit trail (prevent cross-tenant IDOR
    // — previously any authenticated user of any organization could read
    // any document's signer identities, IPs, and timestamps by guessing a
    // documentId). Reuses the same check already applied to
    // app/api/signatures/documents/[id]/route.ts.
    const hasAccess = await SignatureService.verifyDocumentAccess(documentId, userId!, organizationId!);
    if (!hasAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Access denied'
      );
    }
    
    const senderId = await SignatureService.getDocumentSender(documentId, organizationId!);

    // Get query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format"); // 'json' or 'report'

    if (format === "report") {
      // Generate comprehensive audit report
      const report = await AuditTrailService.generateAuditReport(documentId, organizationId!);
      
      return NextResponse.json({
        report: signatureViewForViewer(report, userId!, senderId),
        message: "Audit report generated successfully",
      });
    } else {
      // Return raw audit trail
      const auditTrail = await AuditTrailService.getDocumentAudit(documentId, organizationId!);
      
      return NextResponse.json({
        documentId,
        events: signatureViewForViewer(auditTrail, userId!, senderId),
        totalEvents: auditTrail.length,
      });
    }
  } catch (error) {
    logger.error('Failed to retrieve the signature audit trail', { error });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve audit trail',
      error
    );
  }
  },
);
