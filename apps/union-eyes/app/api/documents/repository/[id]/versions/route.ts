import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  standardErrorResponse,
  standardSuccessResponse,
  ErrorCode,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { documents, documentVersions } from '@/db/schema/documents-schema';

const appendVersionSchema = z.object({
  fileUrl: z.string().url(),
  contentHash: z.string().min(8),
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canUpload = await hasMinRole('member');
  if (!canUpload) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing document ID');
  }

  const body = await request.json();
  const parsed = appendVersionSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid version payload', parsed.error.flatten());
  }

  const doc = (
    await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, params.id), eq(documents.organizationId, organizationId)))
      .limit(1)
  )[0];

  if (!doc) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  const latest = (
    await db
      .select({ versionNo: documentVersions.versionNo })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.organizationId, organizationId),
          eq(documentVersions.documentId, params.id),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1)
  )[0];

  const nextVersion = (latest?.versionNo ?? 0) + 1;

  const [createdVersion] = await db
    .insert(documentVersions)
    .values({
      organizationId,
      documentId: params.id,
      versionNo: nextVersion,
      storageKey: parsed.data.fileUrl,
      contentHash: parsed.data.contentHash,
      uploadedBy: userId,
    })
    .returning();

  await db
    .update(documents)
    .set({ fileUrl: parsed.data.fileUrl, updatedAt: new Date() })
    .where(and(eq(documents.id, params.id), eq(documents.organizationId, organizationId)));

  return standardSuccessResponse(createdVersion);
});
