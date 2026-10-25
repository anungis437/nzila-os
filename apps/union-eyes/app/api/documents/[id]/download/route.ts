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
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { hasDocumentContextAccess } from '@/lib/services/document-member-scope';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

export const GET = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canRead = await hasMinRole('member');
  if (!canRead) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  if (!params?.id || !isDocumentId(params.id)) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
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
        uploadedBy: documents.uploadedBy,
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
      .select({
        id: documentAccessGrants.id,
        canDownload: documentAccessGrants.canDownload,
      })
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

  // Representative-level role: eligibility for organization-level (unlinked) documents only, never case content.
  const isStaff = await hasMinRole('steward');
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
      isPrimaryOwner: caseAccess.isPrimaryOwner,
      hasCaseAccess: hasDocumentContextAccess({
        isStaff,
        canViewCase: caseAccess.canViewCase,
        hasExplicitGrant: Boolean(explicitGrant),
        linkedEntityId: row.linkedEntityId,
        privacyLabel: row.privacyLabel,
        uploadedBy: row.uploadedBy,
        userId,
      }),
      canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
      hasExplicitDocumentGrant: Boolean(explicitGrant),
    },
  );

  if (!allowed) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this document');
  }

  if (explicitGrant && !explicitGrant.canDownload) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to download this document');
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

  let downloadUrl: string | null;
  try {
    downloadUrl = latestVersion?.storageKey
      ? await generateSasUrl(DOCUMENT_BLOB_CONTAINER, latestVersion.storageKey)
      : row.fileUrl;
  } catch {
    return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Document storage is unavailable');
  }

  if (!downloadUrl) {
    return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Document storage location is missing');
  }

  // Access evidence is mandatory: no download URL is issued without its canonical audit record. persistAtomicAudit
  // either records the access (hash-chained in Canonical V2, audit_logs otherwise) or throws; there is no
  // "audit skipped" result for a URL to slip through.
  try {
    await persistAtomicAudit(db as unknown as RLSTx, {
      organizationId,
      action: 'document.download',
      resourceType: 'documents',
      resourceId: row.id,
      userId,
      details: { route: '/api/documents/[id]/download', privacyLabel: row.privacyLabel ?? null },
    });
  } catch {
    return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'Document download audit could not be recorded');
  }

  return standardSuccessResponse({
    id: row.id,
    title: row.title ?? row.filename ?? row.name,
    mimeType: row.mimeType,
    downloadUrl,
  });
});
