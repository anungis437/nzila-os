/**
 * POST /api/documents/[id]/ocr
 *
 * Machine text extraction from the latest version of a document. It needs its own authority (resolveOcrAuthority):
 * the kernel's case:process_ocr on a live case relationship, or an explicit processing grant, or the uploader under an
 * adopted member policy. Viewing, downloading, a steward role and the legacy representative-identifier column are not inputs.
 *
 * The extraction is read from the exact bytes the version's recorded hash names, is stored as an immutable machine
 * revision (never as document content), is not evidence, and requires human review. It commits with its audit record
 * or not at all, and the text is withheld if either fails.
 */
import { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { documents, documentVersions } from '@/db/schema/documents-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { downloadBuffer, computeSha256 } from '@/lib/blob-client';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { resolveOcrAuthority } from '@/lib/documents/ocr-authority';
import { extractTextFromBytes } from '@/lib/documents/ocr-extract';
import { recordMachineExtraction } from '@/lib/documents/transcripts';
import { isBlobPathOwnedByOrganization } from '@/lib/services/document-blob-integrity-service';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export const POST = withOrganizationAuth(async (_request: NextRequest, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!(await hasMinRole('member'))) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  if (!params?.id || !isDocumentId(params.id)) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');

  const authority = await resolveOcrAuthority({ organizationId, userId, documentId: params.id });
  if (!authority) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  if (!authority.decision.allowed) {
    // The reason is deliberately not returned: it would tell a caller which relationship or grant they lack.
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You are not authorized to process this document');
  }

  const [document] = await db
    .select({ mimeType: documents.mimeType, fileType: documents.fileType })
    .from(documents)
    .where(and(eq(documents.id, authority.documentId), eq(documents.organizationId, organizationId)))
    .limit(1);
  const [version] = await db
    .select({ storageKey: documentVersions.storageKey, contentHash: documentVersions.contentHash })
    .from(documentVersions)
    .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.documentId, authority.documentId)))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1);
  if (!document || !version || !isBlobPathOwnedByOrganization(version.storageKey, organizationId)) {
    return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Document storage location could not be verified');
  }

  let extraction;
  try {
    const bytes = await downloadBuffer(DOCUMENT_BLOB_CONTAINER, version.storageKey);
    if (computeSha256(bytes) !== version.contentHash) {
      return standardErrorResponse(ErrorCode.CONFLICT, 'The stored file does not match the recorded version');
    }
    extraction = await extractTextFromBytes(bytes, document.mimeType ?? '', document.fileType ?? '');
  } catch (error) {
    if (error instanceof Error && error.message === 'OCR_UNSUPPORTED') {
      return standardErrorResponse(ErrorCode.NOT_IMPLEMENTED, 'OCR is not available for this file type.');
    }
    return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'OCR processing is unavailable');
  }

  const verified = { storageKey: version.storageKey, contentHash: version.contentHash };
  let outcome;
  try {
    outcome = await withRLSContext({ organizationId }, (tx) =>
      recordMachineExtraction(tx, {
        organizationId,
        userId,
        documentId: authority.documentId,
        classification: authority.privacyLabel ?? '',
        text: extraction.text,
        engine: extraction.engine,
        engineVersion: extraction.engineVersion,
        language: extraction.language,
        confidence: extraction.confidence,
        // The version may have changed while the bytes were read; only the one that was read may be attached to.
        verifySource: async (latest) => latest.storageKey === verified.storageKey && latest.contentHash === verified.contentHash,
      }),
    );
  } catch {
    // The write and its audit are one transaction: neither exists, and no text leaves.
    return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'OCR result and audit could not be recorded');
  }

  if (!outcome.ok) {
    if (outcome.kind === 'source_integrity') return standardErrorResponse(ErrorCode.CONFLICT, 'The document changed while it was processed; try again');
    if (outcome.kind === 'too_large') return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'The extracted text is too large');
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  const { revision } = outcome;
  return standardSuccessResponse({
    documentId: authority.documentId,
    versionId: outcome.versionId,
    revisionNo: revision.revisionNo,
    state: revision.state,
    created: outcome.created,
    text: revision.text,
    confidence: revision.confidence === null ? null : Number(revision.confidence),
    language: revision.language,
    textHash: revision.textHash,
    authoritative: false,
    reviewRequired: true,
  });
});
