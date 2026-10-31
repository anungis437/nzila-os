// cognition-governance-ci: allow-route-bypass — Per-interview document upload; not a single-engine cognition output.
/**
 * POST /api/exit-interviews/[id]/documents/upload — store a document for an exit interview and attach it.
 *
 * The producer of the location the attach route accepts: the file is scanned, stored under the organization's own area
 * (interviews/<organizationId>/<interviewId>/<random>-<name>) of the approved storage account, and registered in the same request.
 * The stored location is the object path without any signed-access token, so access is always granted at read time.
 *
 * Access: steward+ or interview owner, as for attaching a document. A reviewed, published or archived interview takes no more documents.
 */

import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewDocuments } from '@/db/schema';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';
import { uploadBuffer, container, deleteBlob } from '@/lib/blob-client';
import { assertBufferSafeForUpload } from '@/lib/security/clamav';
import { interviewDocumentBlobPath, checkDocumentLocation } from '@/lib/knowledge-transfer/governance/document-location';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
]);
const UE_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Upload and attach a document to an exit interview',
      description: 'Scans and stores the file in the organization storage area, then registers it against the interview.',
    },
  },
  async ({ params, request, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');

    const [interview] = await db
      .select({ id: exitInterviews.id, createdBy: exitInterviews.createdBy, status: exitInterviews.status })
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId)))
      .limit(1);
    if (!interview) throw ApiError.notFound('Exit interview');

    const normalized = normalizeRole((user?.role ?? 'member') as never);
    const stewardPlus = (ROLE_HIERARCHY[normalized] ?? 0) >= ROLE_HIERARCHY.steward;
    if (!stewardPlus && interview.createdBy !== userId) {
      throw ApiError.forbidden('Only the interview owner or steward-level users can attach documents');
    }
    if (interview.status === 'reviewed' || interview.status === 'published' || interview.status === 'archived') {
      throw ApiError.conflict('Cannot attach documents to a reviewed, published or archived interview');
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw ApiError.badRequest('A file is required (multipart field "file")');
    const title = String(form?.get('title') ?? file.name).trim().slice(0, 200);
    if (!title) throw ApiError.badRequest('A title is required');
    if (!ALLOWED_MIME_TYPES.has(file.type)) throw ApiError.badRequest('Unsupported file type. Allowed: PDF, Word, TXT, PNG, JPEG');
    if (file.size <= 0 || file.size > MAX_BYTES) throw ApiError.badRequest('File must be between 1 byte and 50 MB');

    const buffer = Buffer.from(await file.arrayBuffer());
    // A file that fails the malware scan is refused before anything is stored.
    await assertBufferSafeForUpload(buffer, file.name);

    const blobPath = interviewDocumentBlobPath(organizationId, params.id, file.name, crypto.randomBytes(8).toString('hex'));
    const stored = await uploadBuffer({ container: UE_CONTAINER, blobPath, buffer, contentType: file.type });

    // The location is the object path of the approved account with no signed-access token.
    const fileUrl = container(UE_CONTAINER).getBlockBlobClient(stored.blobPath).url.split('?')[0];
    const location = checkDocumentLocation(fileUrl, organizationId);
    if (!location.ok) {
      await deleteBlob(stored.blobPath).catch(() => undefined);
      throw ApiError.externalService('Document storage', 'The stored location is outside the approved storage area');
    }

    try {
      const row = await withRLSContext({ organizationId }, async (tx) => {
        const [created] = await tx
          .insert(exitInterviewDocuments)
          .values({
            interviewId: params.id,
            organizationId,
            title,
            fileUrl,
            mimeType: file.type,
            sizeBytes: stored.sizeBytes,
            createdBy: userId,
          })
          .returning();
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'exit_interview.document_upload',
          resourceType: 'exit_interview_documents',
          resourceId: created.id,
          details: { interviewId: params.id, mimeType: file.type, sizeBytes: stored.sizeBytes, sha256: stored.sha256 },
        });
        return created;
      });
      return { data: row };
    } catch (error) {
      // No record, no object: a stored file with nothing referring to it is removed.
      await deleteBlob(stored.blobPath).catch(() => undefined);
      throw error;
    }
  },
);
