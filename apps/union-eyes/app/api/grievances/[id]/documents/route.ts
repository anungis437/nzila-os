/**
 * Grievance Documents API
 *
 * POST /api/grievances/[id]/documents — Upload a document to a grievance
 */

import { z } from "zod";
import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import {
  grievanceDocuments,
  grievanceEvents,
} from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const docSchema = z.object({
  fileUrl: z.string().url(),
  documentType: z.enum([
    "intake_form", "evidence", "witness_statement", "employer_response",
    "union_brief", "arbitration_submission", "settlement_agreement",
    "correspondence", "photo", "other",
  ]),
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canUpload = await hasMinRole("member");
    if (!canUpload) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Unauthorized");
    }

    const body = await request.json();
    const parsed = docSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // Verify grievance belongs to org
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

    const [doc] = await db
      .insert(grievanceDocuments)
      .values({
        grievanceId: params.id,
        fileUrl: parsed.data.fileUrl,
        documentType: parsed.data.documentType,
        uploadedBy: userId,
      })
      .returning();

    // Emit event
    await db.insert(grievanceEvents).values({
      grievanceId: params.id,
      eventType: "document_uploaded",
      actorUserId: userId,
      notes: `Document uploaded: ${parsed.data.documentType}`,
    });

    // Audit
    await auditDataMutation({
      userId,
      organizationId,
      resource: "grievance_documents",
      action: "create",
      resourceId: doc.id,
      newState: doc,
    });

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_DOCUMENT_UPLOADED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance_document', data: { grievanceId: params.id, documentId: doc.id, documentType: parsed.data.documentType } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_DOCUMENT_UPLOADED' }));

    return standardSuccessResponse(doc);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to upload document");
  }
});
