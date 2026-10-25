/**
 * POST /api/documents/[id]/ocr
 * Authorized OCR extraction. The text is not persisted and is not evidence.
 */

import { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import { documentAccessGrants, documentLinks, documents } from '@/db/schema/documents-schema';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { isDocumentVisibleByPolicy, toGovernanceLabel } from '@/lib/services/document-governance-service';
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { processDocumentOCR } from '@/lib/services/document-service';

type OcrContext = {
  userId: string;
  organizationId: string;
  params?: { id?: string };
};

function ocrFailure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'OCR_UNSUPPORTED') {
    return standardErrorResponse(ErrorCode.NOT_IMPLEMENTED, 'OCR is not available for this file type.');
  }
  if (message === 'Document not found') {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }
  if (message === 'Document blob path missing') {
    return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Document storage location is missing');
  }
  return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'OCR processing is unavailable');
}

export const POST = withRoleAuth('steward', async (_request: NextRequest, context) => {
  const { userId, organizationId, params } = context as OcrContext;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Forbidden');
  }

  await requireEntitlement(organizationId, 'grievance_case_suite');

  const documentId = params?.id ?? '';
  if (!isDocumentId(documentId)) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
  }

  const row = (
    await db
      .select({
        id: documents.id,
        privacyLabel: documents.privacyLabel,
        linkedEntityType: documentLinks.linkedEntityType,
        linkedEntityId: documentLinks.linkedEntityId,
      })
      .from(documents)
      .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          sql`${documents.deletedAt} IS NULL`,
        ),
      )
      .limit(1)
  )[0];

  if (!row) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  const explicitGrant = (
    await db
      .select({ id: documentAccessGrants.id })
      .from(documentAccessGrants)
      .where(
        and(
          eq(documentAccessGrants.organizationId, organizationId),
          eq(documentAccessGrants.documentId, row.id),
          eq(documentAccessGrants.userId, userId),
          eq(documentAccessGrants.status, 'active'),
          eq(documentAccessGrants.canView, true),
          sql`${documentAccessGrants.revokedAt} IS NULL`,
          sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
        ),
      )
      .limit(1)
  )[0];

  let caseAccess = {
    isPrimaryOwner: false,
    canViewCase: false,
    canViewPrivateDocuments: false,
  };
  if (row.linkedEntityType === 'grievance' && row.linkedEntityId) {
    const effective = await getEffectiveCaseAccess({
      organizationId,
      grievanceId: row.linkedEntityId,
      userId,
    });
    caseAccess = {
      isPrimaryOwner: effective.isPrimaryOwner,
      canViewCase: effective.canViewCase,
      canViewPrivateDocuments: effective.canViewPrivateDocuments,
    };
  }

  const allowed = isDocumentVisibleByPolicy(
    toGovernanceLabel({ privacyLabel: row.privacyLabel ?? undefined }),
    {
      isOrgMember: true,
      isStewardPlus: true,
      isPrimaryOwner: caseAccess.isPrimaryOwner,
      hasCaseAccess: true,
      canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
      hasExplicitDocumentGrant: Boolean(explicitGrant),
    },
  );
  if (!allowed) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this document');
  }

  let result;
  try {
    result = await processDocumentOCR(documentId, organizationId, { persistExtractedText: false });
  } catch (error) {
    return ocrFailure(error);
  }

  if (typeof result.text !== 'string') {
    return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'OCR processing is unavailable');
  }

  try {
    await appendMandatoryAudit(db, {
      organizationId,
      action: 'document.ocr.extract',
      resourceType: 'documents',
      resourceId: row.id,
      userId,
      details: {
        route: '/api/documents/[id]/ocr',
        privacyLabel: row.privacyLabel ?? null,
        persisted: false,
        authoritative: false,
      },
    });
  } catch {
    return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'OCR audit could not be recorded');
  }

  return standardSuccessResponse({
    documentId: row.id,
    text: result.text,
    confidence: result.confidence,
    language: result.language,
    authoritative: false,
    persisted: false,
    reviewRequired: true,
  });
});
