import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  standardErrorResponse,
  standardSuccessResponse,
  ErrorCode,
} from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { documents, documentLinks, documentVersions } from '@/db/schema/documents-schema';
import { resolveStoredBlob, storedBlobFailure } from '@/lib/services/document-blob-integrity-service';
import { getDocumentMutabilityBlockReason } from '@/lib/services/document-retention-guard';

// contentHash is a claim, not a fact: when supplied it must equal the SHA-256 the server computes from storage.
// expectedVersionNo is the version the caller edited from; a newer version makes the request stale.
const appendVersionSchema = z.object({
  fileUrl: z.string().url().optional(),
  blobPath: z.string().min(1).optional(),
  contentHash: z.string().regex(/^[0-9a-fA-F]{64}$/, 'contentHash must be a SHA-256 hex digest').optional(),
  expectedVersionNo: z.number().int().positive().optional(),
}).strict().refine((value) => Boolean(value.blobPath || value.fileUrl), {
  message: 'blobPath or fileUrl is required',
  path: ['blobPath'],
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing document ID');
  }

  const body = await request.json();
  const parsed = appendVersionSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid version payload', parsed.error.flatten());
  }

  let resolvedBlob;
  try {
    resolvedBlob = await resolveStoredBlob({
      organizationId,
      blobPath: parsed.data.blobPath,
      fileUrl: parsed.data.fileUrl,
      expectedContentHash: parsed.data.contentHash,
    });
  } catch (error) {
    const failure = storedBlobFailure(error);
    return standardErrorResponse(
      failure.status === 'conflict' ? ErrorCode.CONFLICT : ErrorCode.VALIDATION_ERROR,
      failure.message,
    );
  }

  const doc = (
    await db
      .select({
        id: documents.id,
        metadata: documents.metadata,
        uploadedBy: documents.uploadedBy,
        linkedEntityType: documentLinks.linkedEntityType,
        linkedEntityId: documentLinks.linkedEntityId,
      })
      .from(documents)
      .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
      .where(and(eq(documents.id, params.id), eq(documents.organizationId, organizationId), sql`${documents.deletedAt} IS NULL`))
      .limit(1)
  )[0];

  if (!doc) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  // Replacing a document's content is an authority, not a membership: the document's own uploader, or the kernel's
  // document-modification decision on the grievance it is linked to. Another member's, or another case's, is not.
  let mayVersion = doc.uploadedBy === userId;
  if (doc.linkedEntityType === 'grievance' && doc.linkedEntityId) {
    const access = await getEffectiveCaseAccess({ organizationId, grievanceId: doc.linkedEntityId, userId });
    mayVersion = access.canModifyDocuments;
  }
  if (!mayVersion) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  const blockedReason = getDocumentMutabilityBlockReason({ metadata: doc.metadata });
  if (blockedReason) {
    return standardErrorResponse(
      ErrorCode.CONFLICT,
      `Document versioning blocked: ${blockedReason}`,
    );
  }

  // The new version, the document's current file and the audit record commit together. The document row is locked
  // first, so the stale-base check, the blob-reuse check and the append all judge the same state.
  const outcome = await withRLSContext({ organizationId }, async (tx) => {
    const [locked] = await tx
      .select({ metadata: documents.metadata })
      .from(documents)
      .where(and(eq(documents.id, params.id), eq(documents.organizationId, organizationId), sql`${documents.deletedAt} IS NULL`))
      .for('update');
    if (!locked) return { kind: 'not_found' as const };
    const lockedBlock = getDocumentMutabilityBlockReason({ metadata: locked.metadata });
    if (lockedBlock) return { kind: 'blocked' as const, reason: lockedBlock };

    const latest = (
      await tx
        .select({ versionNo: documentVersions.versionNo })
        .from(documentVersions)
        .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.documentId, params.id)))
        .orderBy(desc(documentVersions.versionNo))
        .limit(1)
    )[0];
    if (parsed.data.expectedVersionNo !== undefined && parsed.data.expectedVersionNo !== (latest?.versionNo ?? 0)) {
      return { kind: 'stale' as const, currentVersionNo: latest?.versionNo ?? 0 };
    }
    // A stored file belongs to one document version. Attaching a file another version already holds would let one
    // document's content stand in for another's.
    const inUse = (
      await tx
        .select({ id: documentVersions.id })
        .from(documentVersions)
        .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.storageKey, resolvedBlob.blobPath)))
        .limit(1)
    )[0];
    if (inUse) return { kind: 'blob_in_use' as const };

    const nextVersion = (latest?.versionNo ?? 0) + 1;
    const [created] = await tx
      .insert(documentVersions)
      .values({
        organizationId,
        documentId: params.id,
        versionNo: nextVersion,
        storageKey: resolvedBlob.blobPath,
        contentHash: resolvedBlob.contentHash,
        uploadedBy: userId,
      })
      .returning();
    await tx
      .update(documents)
      .set({ fileUrl: resolvedBlob.fileUrl, updatedAt: new Date() })
      .where(and(eq(documents.id, params.id), eq(documents.organizationId, organizationId)));
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'document.version_append',
      resourceType: 'documents',
      resourceId: params.id,
      details: { versionNo: nextVersion, contentHash: resolvedBlob.contentHash },
    });
    return { kind: 'created' as const, version: created };
  });

  switch (outcome.kind) {
    case 'created':
      return standardSuccessResponse(outcome.version);
    case 'not_found':
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    case 'blocked':
      return standardErrorResponse(ErrorCode.CONFLICT, `Document versioning blocked: ${outcome.reason}`);
    case 'stale':
      return standardErrorResponse(ErrorCode.CONFLICT, 'The document changed since this version was prepared', {
        currentVersionNo: outcome.currentVersionNo,
      });
    case 'blob_in_use':
      return standardErrorResponse(ErrorCode.CONFLICT, 'That stored file is already attached to a document version');
  }
});
