import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { withRLSContext } from '@/lib/db/with-rls-context';
import {
  grantCaseAccessGuarded,
  revokeCaseAccessGuarded,
  getEffectiveCaseAccess,
  listCaseCollaborators,
  type CaseAccessMutationFailure,
} from '@/lib/services/case-access-service';
import { auditCaseMutation, CaseAuditEvent } from '@/lib/audited-case-mutations';

const accessInputSchema = z.object({
  userId: z.string().min(1).max(255),
  accessRole: z.enum(['secondary_lro', 'reviewer', 'read_only']),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  canComment: z.boolean().optional(),
  canUploadDocuments: z.boolean().optional(),
  canEditCaseNotes: z.boolean().optional(),
  canDraftActions: z.boolean().optional(),
  canViewPrivateDocuments: z.boolean().optional(),
});

// Re-activating a grant would bypass grantee, scope and expiry validation; only revocation is a status change.
const updateStatusSchema = z.object({
  assignmentId: z.string().uuid(),
  status: z.literal('revoked'),
});

function accessMutationFailure(failure: CaseAccessMutationFailure) {
  return standardErrorResponse(
    failure.status === 403 ? ErrorCode.FORBIDDEN : failure.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.VALIDATION_ERROR,
    failure.message,
    { code: failure.code },
  );
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

  const effective = await getEffectiveCaseAccess({
    organizationId,
    grievanceId: params.id,
    userId,
  });

  // The grant roster discloses who may see a case; it is limited to people with a relationship to this case.
  if (!effective.canViewCase) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance');
  }

  const assignments = await withRLSContext({ organizationId }, (tx) => listCaseCollaborators(tx, organizationId, params.id!));

  return standardSuccessResponse({
    primaryLroId: assignments.find((c) => c.relation !== 'collaborator')?.userId ?? null,
    assignments,
    effectiveAccess: effective,
  });
});

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance ID');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON');
  }
  const parsed = accessInputSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid access payload', parsed.error.flatten());
  }

  const granted = await grantCaseAccessGuarded({
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

  if (!granted.ok) {
    await auditCaseMutation({
      event: CaseAuditEvent.CASE_ACCESS_DENIED,
      userId,
      organizationId,
      caseId: params.id,
      action: 'update',
      details: { denied: true, reason: granted.code, targetUserId: parsed.data.userId },
    });
    return accessMutationFailure(granted);
  }
  const access = granted.access;

  return standardSuccessResponse(access);
});

export const PATCH = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance ID');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON');
  }
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid status payload', parsed.error.flatten());
  }

  const revoked = await revokeCaseAccessGuarded({
    organizationId,
    grievanceId: params.id,
    assignmentId: parsed.data.assignmentId,
    actorId: userId,
  });
  if (!revoked.ok) {
    await auditCaseMutation({
      event: CaseAuditEvent.CASE_ACCESS_DENIED,
      userId,
      organizationId,
      caseId: params.id,
      action: 'update',
      details: { denied: true, reason: revoked.code, assignmentId: parsed.data.assignmentId },
    });
    return accessMutationFailure(revoked);
  }
  const { updated } = revoked;

  return standardSuccessResponse(updated);
});
