/**
 * Single Grievance API
 *
 * GET /api/grievances/[id] — Fetch grievance detail with events
 */

import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { documents, documentAccessGrants, documentLinks } from "@/db/schema/documents-schema";
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { getEffectiveCaseAccess, listCaseCollaborators } from "@/lib/services/case-access-service";
import { isDocumentVisibleByPolicy, toGovernanceLabel } from "@/lib/services/document-governance-service";
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and, desc, sql } from "drizzle-orm";
import { withRLSContext } from '@/lib/db/with-rls-context';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    // Every read below goes through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Fetch a grievance with its events and governed documents' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const grievanceId = params.id;
    if (!grievanceId || !zUUID.safeParse(grievanceId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid grievance ID");
    }

    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, grievanceId),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    // Row-level access check: seniority grants nothing. Only the creator, the primary owner, or an
    // active unexpired case-access assignment may read this grievance.
    const effectiveAccess = await getEffectiveCaseAccess({
      organizationId,
      grievanceId,
      userId,
    });

    if (grievance.createdBy !== userId && !effectiveAccess.canViewCase) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "You do not have access to this grievance.");
    }

    // Fetch related events
    const events = await db
      .select()
      .from(grievanceEvents)
      .where(eq(grievanceEvents.grievanceId, grievanceId))
      .orderBy(desc(grievanceEvents.createdAt));

    // Governed repository documents linked to this case/grievance.
    const linkedDocuments = await db
      .select({
        id: documents.id,
        title: documents.title,
        name: documents.name,
        filename: documents.filename,
        fileUrl: documents.fileUrl,
        documentType: documents.documentType,
        privacyLabel: documents.privacyLabel,
        uploadedBy: documents.uploadedBy,
        createdAt: documents.createdAt,
        linkedEntityType: documentLinks.linkedEntityType,
      })
      .from(documents)
      .innerJoin(documentLinks, eq(documentLinks.documentId, documents.id))
      .where(
        and(
          eq(documents.organizationId, organizationId),
          eq(documentLinks.organizationId, organizationId),
          sql`${documentLinks.linkedEntityId} = ${grievanceId}::uuid`,
          sql`${documents.deletedAt} IS NULL`,
        ),
      )
      .orderBy(desc(documents.createdAt));

    const explicitGrantIds = new Set(
      (
        await db
          .select({ documentId: documentAccessGrants.documentId })
          .from(documentAccessGrants)
          .where(
            and(
              eq(documentAccessGrants.organizationId, organizationId),
              eq(documentAccessGrants.userId, userId),
              eq(documentAccessGrants.canView, true),
              sql`${documentAccessGrants.revokedAt} IS NULL`,
              sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
            ),
          )
      ).map((g) => g.documentId),
    );

    const governedDocuments = linkedDocuments.filter((doc) =>
      isDocumentVisibleByPolicy(toGovernanceLabel({ privacyLabel: doc.privacyLabel ?? undefined }), {
        isOrgMember: true,
        isPrimaryOwner: effectiveAccess.isPrimaryOwner,
        hasCaseAccess: grievance.createdBy === userId || effectiveAccess.canViewCase,
        canViewPrivateDocuments: effectiveAccess.canViewPrivateDocuments,
        hasExplicitDocumentGrant: explicitGrantIds.has(doc.id),
      }),
    );

    if (governedDocuments.length > 0) {
      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:${grievanceId}`,
        eventType: 'document_accessed',
        metadata: {
          grievanceId,
          governedCount: governedDocuments.length,
        },
      });
    }

    // The roster shows who holds live kernel relationships to this case; expiry is evaluated by the kernel.
    const collaborators = effectiveAccess.canViewCase
      ? await withRLSContext({ organizationId }, (tx) => listCaseCollaborators(tx, organizationId, grievanceId))
      : [];
    const primaryLroId = collaborators.find((c) => c.relation !== 'collaborator')?.userId ?? null;

    return standardSuccessResponse({
      ...grievance,
      events,
      documents: governedDocuments,
      governedDocuments,
      primaryLroId,
      collaborators,
      effectiveAccess,
    });
  },
);
