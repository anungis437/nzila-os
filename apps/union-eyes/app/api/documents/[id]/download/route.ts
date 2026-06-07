import { and, desc, eq, sql } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import {
  documentAccessGrants,
  documentLinks,
  documents,
  documentVersions,
} from '@/db/schema/documents-schema';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import {
  isDocumentVisibleByPolicy,
  toGovernanceLabel,
} from '@/lib/services/document-governance-service';
import { generateSasUrl } from '@/lib/blob-client';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export const GET = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canRead = await hasMinRole('member');
  if (!canRead) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing document ID');
  }

  const row = (
    await db
      .select({
        id: documents.id,
        title: documents.title,
        name: documents.name,
        filename: documents.filename,
        fileUrl: documents.fileUrl,
        mimeType: documents.mimeType,
        privacyLabel: documents.privacyLabel,
        linkedEntityType: documentLinks.linkedEntityType,
        linkedEntityId: documentLinks.linkedEntityId,
      })
      .from(documents)
      .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
      .where(
        and(
          eq(documents.id, params.id),
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

  const isStewardPlus = await hasMinRole('steward');
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
      isStewardPlus,
      isPrimaryOwner: caseAccess.isPrimaryOwner,
      hasCaseAccess: isStewardPlus || caseAccess.canViewCase || !row.linkedEntityId,
      canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
      hasExplicitDocumentGrant: Boolean(explicitGrant),
    },
  );

  if (!allowed) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this document');
  }

  const latestVersion = (
    await db
      .select({ storageKey: documentVersions.storageKey })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.organizationId, organizationId),
          eq(documentVersions.documentId, row.id),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1)
  )[0];

  const downloadUrl = latestVersion?.storageKey
    ? await generateSasUrl(DOCUMENT_BLOB_CONTAINER, latestVersion.storageKey)
    : row.fileUrl;

  return standardSuccessResponse({
    id: row.id,
    title: row.title ?? row.filename ?? row.name,
    mimeType: row.mimeType,
    downloadUrl,
  });
});
