/**
 * GET /api/documents/[id]/transcript   the head transcript revision of the latest version and its history
 * PUT /api/documents/[id]/transcript   write the next revision: a human draft, or a human-reviewed text
 *
 * The original document is never changed. Reading, writing and reviewing are separate decisions
 * (decideTranscriptAccess); a stale edit (expectedRevisionNo is not the head) is refused with 409.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { loadDocumentAuthorityContext } from '@/lib/documents/ocr-authority';
import { decideTranscriptAccess, readTranscript, saveHumanRevision, TRANSCRIPT_MAX_CHARS } from '@/lib/documents/transcripts';

const writeSchema = z
  .object({
    action: z.enum(['draft', 'review']),
    expectedRevisionNo: z.number().int().min(1),
    text: z.string().min(1).max(TRANSCRIPT_MAX_CHARS),
    changeNote: z.string().max(1000).optional(),
  })
  .strict();

async function authorize(context: { organizationId: string; userId: string }, id: string | undefined) {
  await requireEntitlement(context.organizationId, 'grievance_case_suite');
  if (!(await hasMinRole('member'))) return { error: standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized'), ctx: undefined, access: undefined } as const;
  if (!id || !isDocumentId(id)) return { error: standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID'), ctx: undefined, access: undefined } as const;
  const ctx = await loadDocumentAuthorityContext({ organizationId: context.organizationId, userId: context.userId, documentId: id });
  // A document the principal cannot read is indistinguishable from one that does not exist.
  if (!ctx) return { error: standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found'), ctx: undefined, access: undefined } as const;
  const access = decideTranscriptAccess(ctx, context.userId);
  if (!access.canRead) return { error: standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found'), ctx: undefined, access: undefined } as const;
  return { ctx, access, error: undefined } as const;
}

export const GET = withOrganizationAuth(async (_request: NextRequest, context, params?: { id: string }) => {
  const result = await authorize(context, params?.id);
  if (result.error) return result.error;
  const transcript = await withRLSContext({ organizationId: context.organizationId }, (tx) =>
    readTranscript(tx, { organizationId: context.organizationId, documentId: result.ctx.documentId }),
  );
  if (!transcript) return standardErrorResponse(ErrorCode.NOT_FOUND, 'No transcript exists for this document');
  return standardSuccessResponse({
    documentId: result.ctx.documentId,
    versionId: transcript.versionId,
    head: transcript.head,
    history: transcript.history,
    publishedAsEvidence: transcript.publishedAsEvidence,
    access: { canWrite: result.access.canWrite, canPublish: result.access.canPublish },
  });
});

export const PUT = withOrganizationAuth(async (request: NextRequest, context, params?: { id: string }) => {
  const result = await authorize(context, params?.id);
  if (result.error) return result.error;
  if (!result.access.canWrite) return standardErrorResponse(ErrorCode.FORBIDDEN, 'You are not authorized to change this transcript');

  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid transcript payload');

  let outcome;
  try {
    outcome = await withRLSContext({ organizationId: context.organizationId }, (tx) =>
      saveHumanRevision(tx, {
        organizationId: context.organizationId,
        userId: context.userId,
        documentId: result.ctx.documentId,
        classification: result.ctx.privacyLabel ?? '',
        expectedRevisionNo: parsed.data.expectedRevisionNo,
        text: parsed.data.text,
        changeNote: parsed.data.changeNote,
        review: parsed.data.action === 'review',
      }),
    );
  } catch {
    return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'The transcript change and its audit could not be recorded');
  }

  if (!outcome.ok) {
    switch (outcome.kind) {
      case 'stale':
      case 'classification_changed':
      case 'already_reviewed':
        return standardErrorResponse(ErrorCode.CONFLICT, 'The transcript changed since it was loaded', { currentRevisionNo: outcome.currentRevisionNo });
      case 'self_review':
        return standardErrorResponse(ErrorCode.FORBIDDEN, 'A transcript cannot be reviewed by the person who wrote the draft');
      case 'no_extraction':
        return standardErrorResponse(ErrorCode.CONFLICT, 'There is no machine extraction to revise; process the document first');
      case 'invalid_text':
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid transcript text');
      default:
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    }
  }
  return standardSuccessResponse({ documentId: result.ctx.documentId, versionId: outcome.versionId, revision: outcome.revision });
});
