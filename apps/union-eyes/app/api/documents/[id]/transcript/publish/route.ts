/**
 * POST /api/documents/[id]/transcript/publish
 *
 * Publishes the head, human-reviewed transcript revision as evidence of the linked case. This is a separate governed
 * action from review: it needs the kernel's case:upload_evidence on a live case relationship, and an unlinked
 * document has no case to carry evidence. A machine extraction or an unreviewed draft is never publishable.
 */
import { z } from 'zod';
import { withApi, ApiError } from '@/lib/api/framework';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { loadDocumentAuthorityContext } from '@/lib/documents/ocr-authority';
import { decideTranscriptAccess, publishTranscriptAsEvidence } from '@/lib/documents/transcripts';
import { logger } from '@/lib/logger';

const publishSchema = z.object({ revisionNo: z.number().int().min(2), purpose: z.string().trim().min(3).max(500) }).strict();

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    openapi: { tags: ['Documents'], summary: 'Publish the head human-reviewed transcript revision as evidence of the linked case' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    if (!params.id || !isDocumentId(params.id)) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
    const documentId = params.id;

    const ctx = await withRLSContext({ organizationId }, (tx) => loadDocumentAuthorityContext(tx, { organizationId, userId, documentId }));
    if (!ctx) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    const access = decideTranscriptAccess(ctx, userId);
    if (!access.canRead) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    if (!access.canPublish || !ctx.linkedCaseId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'You are not authorized to publish this transcript as evidence');
    }

    const parsed = publishSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid publication payload');

    const linkedCaseId = ctx.linkedCaseId;
    let outcome;
    try {
      outcome = await withRLSContext({ organizationId }, (tx) =>
        publishTranscriptAsEvidence(tx, { organizationId, userId, documentId: ctx.documentId, linkedCaseId, revisionNo: parsed.data.revisionNo, purpose: parsed.data.purpose }),
      );
    } catch (error) {
      logger.error('Transcript publication could not be recorded', { documentId: ctx.documentId, error: error instanceof Error ? error.message : String(error) });
      return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'The publication and its audit could not be recorded');
    }

    if (!outcome.ok) {
      switch (outcome.kind) {
        case 'not_reviewed':
          return standardErrorResponse(ErrorCode.CONFLICT, 'Only a human-reviewed revision can be published as evidence');
        case 'stale':
          return standardErrorResponse(ErrorCode.CONFLICT, 'The transcript changed since it was reviewed', { currentRevisionNo: outcome.currentRevisionNo });
        case 'already_published':
          return standardErrorResponse(ErrorCode.CONFLICT, 'This revision is already published as evidence');
        default:
          return standardErrorResponse(ErrorCode.NOT_FOUND, 'No transcript exists for this document');
      }
    }
    return standardSuccessResponse({ documentId: ctx.documentId, versionId: outcome.versionId, publication: outcome.publication });
  },
);
