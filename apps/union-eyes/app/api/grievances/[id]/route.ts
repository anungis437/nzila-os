/**
 * Single Grievance API
 *
 * GET /api/grievances/[id] — Fetch grievance detail with events
 */

import { NextRequest as _NextRequest, NextResponse as _NextResponse } from "next/server";
import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { grievanceDocuments } from "@/db/schema/domains/claims/grievance-lifecycle";
import { grievanceCaseAccessAssignments } from "@/db/schema/domains/claims/grievance-lifecycle";
import { documents, documentAccessGrants, documentLinks } from "@/db/schema/documents-schema";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { getEffectiveCaseAccess, expireElapsedCaseAccessAssignments } from "@/lib/services/case-access-service";
import { isDocumentVisibleByPolicy, toGovernanceLabel } from "@/lib/services/document-governance-service";
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export const GET = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canAccess = await hasMinRole("member");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Unauthorized");
    }

    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    await expireElapsedCaseAccessAssignments();

    // Row-level access check:
    // steward+ can view any grievance in org,
    // creator can view own grievance,
    // primary LRO or delegated collaborator can view by explicit assignment.
    const isStewardPlus = await hasMinRole("steward");
    const effectiveAccess = await getEffectiveCaseAccess({
      organizationId,
      grievanceId: params.id,
      userId,
    });
    const effectiveAccessForResponse = {
      ...effectiveAccess,
      canManageAssignments: isStewardPlus || effectiveAccess.canManageAssignments,
    };

    if (!isStewardPlus && grievance.createdBy !== userId && !effectiveAccess.canViewCase) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "You can only view your own submissions.");
    }

    // Fetch related events
    const events = await db
      .select()
      .from(grievanceEvents)
      .where(eq(grievanceEvents.grievanceId, params.id))
      .orderBy(desc(grievanceEvents.createdAt));

    // Legacy grievance documents (kept for backward compatibility).
    const legacyDocuments = await db
      .select()
      .from(grievanceDocuments)
      .where(eq(grievanceDocuments.grievanceId, params.id));

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
          sql`${documentLinks.linkedEntityId} = ${params.id}::uuid`,
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
        isStewardPlus,
        isPrimaryOwner: effectiveAccessForResponse.isPrimaryOwner,
        hasCaseAccess: isStewardPlus || grievance.createdBy === userId || effectiveAccessForResponse.canViewCase,
        canViewPrivateDocuments: effectiveAccessForResponse.canViewPrivateDocuments,
        hasExplicitDocumentGrant: explicitGrantIds.has(doc.id),
      }),
    );

    if (governedDocuments.length > 0 || legacyDocuments.length > 0) {
      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:${params.id}`,
        eventType: 'document_accessed',
        metadata: {
          grievanceId: params.id,
          governedCount: governedDocuments.length,
          legacyCount: legacyDocuments.length,
        },
      });
    }

    const collaborators = await db
      .select()
      .from(grievanceCaseAccessAssignments)
      .where(
        and(
          eq(grievanceCaseAccessAssignments.organizationId, organizationId),
          eq(grievanceCaseAccessAssignments.grievanceId, params.id),
        ),
      )
      .orderBy(desc(grievanceCaseAccessAssignments.grantedAt));

    return standardSuccessResponse({
      ...grievance,
      events,
      documents: legacyDocuments,
      governedDocuments,
      primaryLroId: grievance.unionRepId,
      collaborators,
      effectiveAccess: effectiveAccessForResponse,
    });
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to fetch grievance");
  }
});
