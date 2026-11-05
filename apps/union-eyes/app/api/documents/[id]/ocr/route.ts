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
import { and, desc, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { documents, documentVersions } from '@/db/schema/documents-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { downloadBuffer, computeSha256 } from '@/lib/blob-client';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { resolveOcrAuthority } from '@/lib/documents/ocr-authority';
import { extractTextFromBytes } from '@/lib/documents/ocr-extract';
import { recordMachineExtraction } from '@/lib/documents/transcripts';
import { logger } from '@/lib/logger';
import { isBlobPathOwnedByOrganization } from '@/lib/services/document-blob-integrity-service';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    // No rlsOrgContext: the storage read and the extraction are slow and must not hold a database transaction, so the database work is
    // two short organization transactions opened below.
    openapi: { tags: ['Documents'], summary: 'Extract text from the latest version of a document (machine OCR, human review required)' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    if (!params.id || !isDocumentId(params.id)) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
    const documentId = params.id;

    // The authority decision and the version to read are made in one organization transaction, closed before storage is read.
    const prepared = await withRLSContext({ organizationId }, async (tx) => {
      const authority = await resolveOcrAuthority(tx, { organizationId, userId, documentId });
      if (!authority) return { kind: 'not_found' as const };
      if (!authority.decision.allowed) return { kind: 'denied' as const };

      const [document] = await tx
        .select({ mimeType: documents.mimeType, fileType: documents.fileType })
        .from(documents)
        .where(and(eq(documents.id, authority.documentId), eq(documents.organizationId, organizationId)))
        .limit(1);
      const [version] = await tx
        .select({ storageKey: documentVersions.storageKey, contentHash: documentVersions.contentHash })
        .from(documentVersions)
        .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.documentId, authority.documentId)))
        .orderBy(desc(documentVersions.versionNo))
        .limit(1);
      return { kind: 'ready' as const, authority, document, version };
    });
    if (prepared.kind === 'not_found') return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    // The reason is deliberately not returned: it would tell a caller which relationship or grant they lack.
    if (prepared.kind === 'denied') return standardErrorResponse(ErrorCode.FORBIDDEN, 'You are not authorized to process this document');

    const { authority, document, version } = prepared;
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
      logger.error('Document OCR failed', { documentId: authority.documentId, error: error instanceof Error ? error.message : String(error) });
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
    } catch (error) {
      // The write and its audit are one transaction: neither exists, and no text leaves.
      logger.error('Document OCR result could not be recorded', { documentId: authority.documentId, error: error instanceof Error ? error.message : String(error) });
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
  },
);
