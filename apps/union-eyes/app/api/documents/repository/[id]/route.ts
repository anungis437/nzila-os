import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import {
  standardErrorResponse,
  standardSuccessResponse,
  ErrorCode,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
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
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { hasDocumentContextAccess } from '@/lib/services/document-member-scope';
import { getDocumentMutabilityBlockReason } from '@/lib/services/document-retention-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { loadUploaderNames } from '@/lib/documents/uploader-names';

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

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    // Two short organization transactions (the document, then its versions); the case decision between them takes its own connection.
    openapi: { tags: ['Documents'], summary: 'Read one document of the repository with its versions' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }

    if (!params.id) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing document ID');
    }
    if (!isDocumentId(params.id)) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
    }
    const documentId = params.id;

    const { row, explicitGrant } = await withRLSContext({ organizationId }, async (tx) => {
      const rowInner = (
        await tx
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
              eq(documents.id, documentId),
              eq(documents.organizationId, organizationId),
              sql`${documents.deletedAt} IS NULL`,
            ),
          )
          .limit(1)
      )[0];

      if (!rowInner) {
        return { row: null as typeof rowInner, explicitGrant: null as { id: string } | null };
      }

      const explicitGrantInner = (
        await tx
          .select({ id: documentAccessGrants.id })
          .from(documentAccessGrants)
          .where(
            and(
              eq(documentAccessGrants.organizationId, organizationId),
              eq(documentAccessGrants.documentId, rowInner.id),
              eq(documentAccessGrants.userId, userId),
              eq(documentAccessGrants.status, 'active'),
              eq(documentAccessGrants.canView, true),
              sql`${documentAccessGrants.revokedAt} IS NULL`,
              sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
            ),
          )
          .limit(1)
      )[0];

      return { row: rowInner, explicitGrant: explicitGrantInner ?? null };
    });

    if (!row) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    }

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

    const versions = await withRLSContext({ organizationId }, (tx) =>
      tx
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.organizationId, organizationId),
            eq(documentVersions.documentId, row.id),
          ),
        )
        .orderBy(desc(documentVersions.versionNo)),
    );

    // The uploader is staff-only, as in the list: a member reads the document and its versions without other users' ids.
    const uploaderNames = isStaff ? await loadUploaderNames(organizationId, [row.uploadedBy, ...versions.map((version) => version.uploadedBy)]) : {};
    const nameOf = (uploaderId: string | null | undefined) => (uploaderId ? uploaderNames[uploaderId] : undefined) ?? null;
    const { uploadedBy: uploaderId, ...rowWithoutUploader } = row;

    return standardSuccessResponse({
      ...rowWithoutUploader,
      ...(isStaff ? { uploadedBy: uploaderId, uploadedByName: nameOf(uploaderId) } : {}),
      title: normalizeDocumentTitle(row),
      versions: versions.map(({ uploadedBy: versionUploader, ...version }) =>
        isStaff ? { ...version, uploadedBy: versionUploader, uploadedByName: nameOf(versionUploader) } : version,
      ),
    });
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    // The document row is locked, judged and changed in one organization transaction (the case decision takes its own connection).
    openapi: { tags: ['Documents'], summary: 'Change the privacy label of a document' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }

    if (!params.id) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing document ID');
    }
    if (!isDocumentId(params.id)) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
    }
    const documentId = params.id;

    const body = await request.json();
    const parsed = updateLabelSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid label payload', parsed.error.flatten());
    }

    // The label change and its audit record commit together, and the retention judgement is made on the locked row it applies to.
    const outcome = await withRLSContext({ organizationId }, async (tx) => {
      const before = (
        await tx
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
              eq(documents.id, documentId),
              eq(documents.organizationId, organizationId),
              sql`${documents.deletedAt} IS NULL`,
            ),
          )
          .limit(1)
          .for('update', { of: documents })
      )[0];

      if (!before) return { kind: 'not_found' as const };

      // Changing a label alters who can read a case document, so it is a case-management power.
      if (before.linkedEntityType === 'grievance' && before.linkedEntityId) {
        const relationship = await getEffectiveCaseAccess({
          organizationId,
          grievanceId: before.linkedEntityId,
          userId,
        });
        if (!relationship.isPrimaryOwner) return { kind: 'not_primary_owner' as const };
      }

      const blockedReason = getDocumentMutabilityBlockReason({ metadata: before.metadata });
      if (blockedReason) return { kind: 'blocked' as const, reason: blockedReason };

      const [updated] = await tx
        .update(documents)
        .set({
          privacyLabel: parsed.data.privacyLabel,
          updatedAt: new Date(),
        })
        .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)))
        .returning();
      if (!updated) return { kind: 'not_found' as const };
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'document.label_change',
        resourceType: 'documents',
        resourceId: updated.id,
        details: {
          previousPrivacyLabel: before.privacyLabel,
          privacyLabel: updated.privacyLabel,
          ...(before.linkedEntityType && before.linkedEntityId
            ? { linkedEntityType: before.linkedEntityType, linkedEntityId: before.linkedEntityId }
            : {}),
        },
      });
      return { kind: 'updated' as const, document: updated };
    });

    switch (outcome.kind) {
      case 'not_found':
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
      case 'not_primary_owner':
        return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only the primary owner of the linked case can change this document label');
      case 'blocked':
        return standardErrorResponse(ErrorCode.CONFLICT, `Document update blocked: ${outcome.reason}`);
      case 'updated':
        return standardSuccessResponse(outcome.document);
    }
  },
);
