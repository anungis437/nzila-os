/**
 * POST /api/documents/intakes   multipart: file, operation ('create_document' | 'append_version'), targetDocumentId?
 *
 * Opens a temporary intake. The server stores the file under a key it issues, computes the checksum, and answers with
 * an intake id and the facts it recorded. The storage key is never returned and never accepted: the intake id is the
 * only handle, and it is consumed by creating a document or version (POST /api/documents/repository with intakeId, or
 * POST /api/documents/repository/[id]/versions with intakeId) before it expires. Unused intakes expire and their
 * objects are deleted.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { isMalwareScanError } from '@/lib/security/clamav';
import { OCR_MIME_TYPES, OCR_MAX_BYTES } from '@/lib/documents/ocr-intake';
import { openIntake } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';
import { loadDocumentAuthorityContext } from '@/lib/documents/ocr-authority';
import { decideTranscriptAccess } from '@/lib/documents/transcripts';

export const dynamic = 'force-dynamic';

const fieldsSchema = z.object({
  operation: z.enum(['create_document', 'append_version']),
  targetDocumentId: z.guid().optional(),
});

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');
  if (!(await hasMinRole('member'))) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');

  const rate = await checkRateLimit(`doc-upload:${userId}`, RATE_LIMITS.DOCUMENT_UPLOAD);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rate.resetIn }, { status: 429, headers: createRateLimitHeaders(rate) });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) return standardErrorResponse(ErrorCode.MISSING_REQUIRED_FIELD, 'File is required');
  const fields = fieldsSchema.safeParse({
    operation: form.get('operation') ?? 'create_document',
    targetDocumentId: form.get('targetDocumentId') || undefined,
  });
  if (!fields.success || (fields.data.operation === 'append_version') !== Boolean(fields.data.targetDocumentId)) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid intake request');
  }
  if (file.size <= 0 || file.size > OCR_MAX_BYTES) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'File size is not allowed');
  if (!(OCR_MIME_TYPES as readonly string[]).includes(file.type)) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'File type is not allowed');

  // An intake that will become a new version of a document is only opened by someone who could modify that document.
  if (fields.data.targetDocumentId) {
    const target = await loadDocumentAuthorityContext({ organizationId, userId, documentId: fields.data.targetDocumentId });
    if (!target || !decideTranscriptAccess(target, userId).canWrite) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  const opened = await openIntake(
    {
      organizationId,
      userId,
      operation: fields.data.operation,
      targetDocumentId: fields.data.targetDocumentId ?? null,
      filename: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    },
    blobIntakeStorage,
  );
  if (!opened.ok) {
    if (opened.kind === 'upload_failed' && isMalwareScanError(opened.error)) {
      return opened.error.result.status === 'infected'
        ? standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'File blocked by malware scan')
        : standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'Malware scanner unavailable; upload blocked by policy');
    }
    return opened.kind === 'invalid'
      ? standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid intake request')
      : standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'The file could not be stored');
  }
  return NextResponse.json({ success: true, data: opened.intake }, { status: 201 });
});
