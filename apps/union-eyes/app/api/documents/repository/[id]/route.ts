import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  standardErrorResponse,
  standardSuccessResponse,
  ErrorCode,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import {
  documents,
  documentAccessGrants,
  documentLinks,
  documentVersions,
} from '@/db/schema/documents-schema';
import {
  isDocumentVisibleByPolicy,
  normalizeDocumentTitle,
  toGovernanceLabel,
} from '@/lib/services/document-governance-service';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { auditCaseMutation, CaseAuditEvent } from '@/lib/audited-case-mutations';
import { getDocumentMutabilityBlockReason } from '@/lib/services/document-retention-guard';

const updateLabelSchema = z.object({
  privacyLabel: z.enum([
    'public_internal',
    'team_confidential',
    'lro_confidential',
    'privileged',
    'case_restricted',
    'highly_sensitive',
  ]),
});

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
        filename: documents.filename,
        name: documents.name,
        fileUrl: documents.fileUrl,
        documentType: documents.documentType,
        privacyLabel: documents.privacyLabel,
        uploadedBy: documents.uploadedBy,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
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

  const versions = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.organizationId, organizationId),
        eq(documentVersions.documentId, row.id),
      ),
    )
    .orderBy(desc(documentVersions.versionNo));

  return standardSuccessResponse({
    ...row,
    title: normalizeDocumentTitle(row),
    versions,
  });
});

export const PATCH = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canEditLabel = await hasMinRole('steward');
  if (!canEditLabel) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only steward+ can change privacy labels');
  }

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing document ID');
  }

  const body = await request.json();
  const parsed = updateLabelSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid label payload', parsed.error.flatten());
  }

  const before = (
    await db
      .select({
        id: documents.id,
        privacyLabel: documents.privacyLabel,
        metadata: documents.metadata,
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

  if (!before) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
  }

  const blockedReason = getDocumentMutabilityBlockReason({ metadata: before.metadata });
  if (blockedReason) {
    return standardErrorResponse(
      ErrorCode.CONFLICT,
      `Document update blocked: ${blockedReason}`,
    );
  }

  const [updated] = await db
    .update(documents)
    .set({
      privacyLabel: parsed.data.privacyLabel,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, params.id), eq(documents.organizationId, organizationId)))
    .returning();

  if (before.linkedEntityType === 'grievance' && before.linkedEntityId) {
    await auditCaseMutation({
      event: CaseAuditEvent.DOCUMENT_LABEL_CHANGED,
      userId,
      organizationId,
      caseId: before.linkedEntityId,
      action: 'update',
      previousState: { privacyLabel: before.privacyLabel },
      newState: { privacyLabel: updated.privacyLabel },
      details: {
        documentId: updated.id,
      },
    });
  }

  return standardSuccessResponse(updated);
});
