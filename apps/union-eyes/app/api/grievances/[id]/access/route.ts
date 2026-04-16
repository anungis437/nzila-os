import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceCaseAccessAssignments } from '@/db/schema/domains/claims/grievance-lifecycle';
import {
  grantCaseAccess,
  updateCaseAccessStatus,
  getEffectiveCaseAccess,
  expireElapsedCaseAccessAssignments,
} from '@/lib/services/case-access-service';
import { auditCaseMutation, CaseAuditEvent } from '@/lib/audited-case-mutations';

const accessInputSchema = z.object({
  userId: z.string().uuid(),
  accessRole: z.enum(['secondary_lro', 'reviewer', 'read_only']),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  canComment: z.boolean().optional(),
  canUploadDocuments: z.boolean().optional(),
  canEditCaseNotes: z.boolean().optional(),
  canDraftActions: z.boolean().optional(),
  canViewPrivateDocuments: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  assignmentId: z.string().uuid(),
  status: z.enum(['active', 'revoked', 'expired']),
});

async function canManageAccess(organizationId: string, grievanceId: string, userId: string) {
  const isStewardPlus = await hasMinRole('steward');
  if (isStewardPlus) {
    return true;
  }

  const access = await getEffectiveCaseAccess({
    organizationId,
    grievanceId,
    userId,
  });

  return access.isPrimaryOwner;
}

export const GET = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance ID');
  }

  const canAccess = await hasMinRole('member');
  if (!canAccess) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  await expireElapsedCaseAccessAssignments();

  const effective = await getEffectiveCaseAccess({
    organizationId,
    grievanceId: params.id,
    userId,
  });

  const isStewardPlus = await hasMinRole('steward');
  const effectiveAccessForResponse = {
    ...effective,
    canManageAssignments: isStewardPlus || effective.canManageAssignments,
  };

  if (!isStewardPlus && !effective.canViewCase) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance');
  }

  const assignments = await db
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
    primaryLroId: (await db.select({ unionRepId: grievances.unionRepId }).from(grievances).where(eq(grievances.id, params.id)).limit(1))[0]?.unionRepId ?? null,
    assignments,
    effectiveAccess: effectiveAccessForResponse,
  });
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance ID');
  }

  const canManage = await canManageAccess(organizationId, params.id, userId);
  if (!canManage) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only primary LRO or steward+ can grant collaborator access');
  }

  const body = await request.json();
  const parsed = accessInputSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid access payload', parsed.error.flatten());
  }

  const access = await grantCaseAccess({
    organizationId,
    grievanceId: params.id,
    userId: parsed.data.userId,
    grantedBy: userId,
    accessRole: parsed.data.accessRole,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    canComment: parsed.data.canComment,
    canUploadDocuments: parsed.data.canUploadDocuments,
    canEditCaseNotes: parsed.data.canEditCaseNotes,
    canDraftActions: parsed.data.canDraftActions,
    canViewPrivateDocuments: parsed.data.canViewPrivateDocuments,
  });

  await auditCaseMutation({
    event: CaseAuditEvent.CASE_ACCESS_GRANTED,
    userId,
    organizationId,
    caseId: params.id,
    action: 'update',
    newState: { assignmentId: access.id, status: access.status },
    details: {
      targetUserId: access.userId,
      accessRole: access.accessRole,
      scope: {
        canComment: access.canComment,
        canUploadDocuments: access.canUploadDocuments,
        canEditCaseNotes: access.canEditCaseNotes,
        canDraftActions: access.canDraftActions,
        canViewPrivateDocuments: access.canViewPrivateDocuments,
      },
      expiresAt: access.expiresAt,
    },
  });

  return standardSuccessResponse(access);
});

export const PATCH = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance ID');
  }

  const canManage = await canManageAccess(organizationId, params.id, userId);
  if (!canManage) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only primary LRO or steward+ can modify collaborator access');
  }

  const body = await request.json();
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid status payload', parsed.error.flatten());
  }

  const before = (
    await db
      .select()
      .from(grievanceCaseAccessAssignments)
      .where(
        and(
          eq(grievanceCaseAccessAssignments.id, parsed.data.assignmentId),
          eq(grievanceCaseAccessAssignments.organizationId, organizationId),
          eq(grievanceCaseAccessAssignments.grievanceId, params.id),
        ),
      )
      .limit(1)
  )[0];

  if (!before) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Access assignment not found');
  }

  const updated = await updateCaseAccessStatus(parsed.data.assignmentId, parsed.data.status);
  if (!updated) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update access assignment');
  }

  const event =
    parsed.data.status === 'revoked'
      ? CaseAuditEvent.CASE_ACCESS_REVOKED
      : parsed.data.status === 'expired'
        ? CaseAuditEvent.CASE_ACCESS_EXPIRED
        : CaseAuditEvent.CASE_ACCESS_UPDATED;

  await auditCaseMutation({
    event,
    userId,
    organizationId,
    caseId: params.id,
    action: 'update',
    previousState: { status: before.status },
    newState: { status: updated.status },
    details: {
      assignmentId: updated.id,
      targetUserId: updated.userId,
      scope: {
        canComment: updated.canComment,
        canUploadDocuments: updated.canUploadDocuments,
        canEditCaseNotes: updated.canEditCaseNotes,
        canDraftActions: updated.canDraftActions,
        canViewPrivateDocuments: updated.canViewPrivateDocuments,
      },
    },
  });

  return standardSuccessResponse(updated);
});
