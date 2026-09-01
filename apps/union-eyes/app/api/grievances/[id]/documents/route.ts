/**
 * Grievance Documents API
 *
 * POST /api/grievances/[id]/documents — Upload a document to a grievance
 */

import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import {
  documents,
  documentVersions,
  documentLinks,
} from "@/db/schema/documents-schema";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { recordUsage } from '@/services/platform-economics';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { auditCaseMutation, CaseAuditEvent } from '@/lib/audited-case-mutations';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const docSchema = z.object({
  fileUrl: z.string().url(),
  title: z.string().min(1).max(300),
  filename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(150),
  fileSize: z.number().int().nonnegative().optional(),
  documentType: z.enum([
    "intake_form", "evidence", "witness_statement", "employer_response",
    "union_brief", "arbitration_submission", "settlement_agreement",
    "correspondence", "photo", "other",
  ]),
  privacyLabel: z.enum([
    'public_internal',
    'team_confidential',
    'lro_confidential',
    'privileged',
    'case_restricted',
    'highly_sensitive',
  ]),
  containsPii: z.boolean().optional(),
  containsMedicalSensitive: z.boolean().optional(),
  containsLegalPrivilege: z.boolean().optional(),
  memberPii: z.boolean().optional(),
  medicalSensitive: z.boolean().optional(),
  disciplinarySensitive: z.boolean().optional(),
  contentHash: z.string().min(8).optional(),
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canAccess = await hasMinRole("member");
    if (!canAccess) {
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

    const isStewardPlus = await hasMinRole('steward');
    const effectiveAccess = await getEffectiveCaseAccess({
      organizationId,
      grievanceId: params.id,
      userId,
    });

    const canUpload =
      isStewardPlus ||
      grievance.createdBy === userId ||
      effectiveAccess.isPrimaryOwner ||
      effectiveAccess.canUploadDocuments;

    if (!canUpload) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to upload documents to this case');
    }

    const result = await withRLSContext(async () => {
      const [governedDoc] = await db
        .insert(documents)
        .values({
          organizationId,
          title: parsed.data.title,
          filename: parsed.data.filename,
          name: parsed.data.title,
          fileUrl: parsed.data.fileUrl,
          fileType: parsed.data.documentType,
          documentType: parsed.data.documentType,
          mimeType: parsed.data.mimeType,
          fileSize: parsed.data.fileSize,
          uploadedBy: userId,
          privacyLabel: parsed.data.privacyLabel,
          containsPii: parsed.data.containsPii ?? false,
          containsMedicalSensitive: parsed.data.containsMedicalSensitive ?? false,
          containsLegalPrivilege: parsed.data.containsLegalPrivilege ?? false,
          memberPii: parsed.data.memberPii ?? false,
          medicalSensitive: parsed.data.medicalSensitive ?? false,
          disciplinarySensitive: parsed.data.disciplinarySensitive ?? false,
        })
        .returning();

      await db.insert(documentVersions).values({
        organizationId,
        documentId: governedDoc.id,
        versionNo: 1,
        storageKey: parsed.data.fileUrl,
        contentHash: parsed.data.contentHash ?? `unverified:${governedDoc.id}`,
        uploadedBy: userId,
      });

      await db.insert(documentLinks).values({
        organizationId,
        documentId: governedDoc.id,
        linkedEntityType: 'grievance',
        linkedEntityId: params.id,
        linkedBy: userId,
      });

      // Emit event
      await db.insert(grievanceEvents).values({
        grievanceId: params.id,
        eventType: "document_uploaded",
        actorUserId: userId,
        notes: `Document uploaded: ${parsed.data.documentType}`,
      });

      return { governedDoc };
    });

    // Audit
    await auditDataMutation({
      userId,
      organizationId,
      resource: "grievance_documents",
      action: "create",
      resourceId: result.governedDoc.id,
      newState: {
        id: result.governedDoc.id,
        privacyLabel: result.governedDoc.privacyLabel,
        documentType: result.governedDoc.documentType,
      },
    });

    await auditCaseMutation({
      event: CaseAuditEvent.CASE_ATTACHMENT_UPLOADED,
      userId,
      organizationId,
      caseId: params.id,
      action: 'create',
      newState: {
        documentId: result.governedDoc.id,
      },
      details: {
        privacyLabel: result.governedDoc.privacyLabel,
        documentType: parsed.data.documentType,
      },
    });

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_DOCUMENT_UPLOADED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance_document', data: { grievanceId: params.id, documentId: result.governedDoc.id, documentType: parsed.data.documentType, privacyLabel: parsed.data.privacyLabel } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_DOCUMENT_UPLOADED' }));

    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:${params.id}`,
      eventType: 'document_uploaded',
      metadata: {
        grievanceId: params.id,
        documentId: result.governedDoc.id,
        documentType: parsed.data.documentType,
      },
    });

    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:${params.id}`,
      eventType: 'document_attached',
      metadata: {
        grievanceId: params.id,
        documentId: result.governedDoc.id,
        privacyLabel: parsed.data.privacyLabel,
      },
    });

    await recordUsage({
      meterCode: 'document_uploaded',
      organizationId,
      userId,
      quantity: 1,
      idempotencyKey: `usage:document_uploaded:${result.governedDoc.id}`,
      metadata: {
        grievanceId: params.id,
        documentId: result.governedDoc.id,
        documentType: parsed.data.documentType,
      },
    }).catch((err) => logger.warn('Usage meter write skipped', { error: String(err), meterCode: 'document_uploaded' }));

    return standardSuccessResponse({
      ...result.governedDoc,
    });
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to upload document");
  }
});
