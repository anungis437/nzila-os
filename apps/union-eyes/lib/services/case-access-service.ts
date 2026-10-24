import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { caseAssigneeEligible } from '@/lib/cases/case-authorization';
import { grievances } from '@/db/schema/domains/claims/grievances';
import {
  grievanceCaseAccessAssignments,
  type CaseAccessRole,
  type CaseAccessStatus,
} from '@/db/schema/domains/claims/grievance-lifecycle';

export interface CaseAccessScopeInput {
  canComment?: boolean;
  canUploadDocuments?: boolean;
  canEditCaseNotes?: boolean;
  canDraftActions?: boolean;
  canViewPrivateDocuments?: boolean;
}

export interface GrantCaseAccessInput extends CaseAccessScopeInput {
  organizationId: string;
  grievanceId: string;
  userId: string;
  grantedBy: string;
  accessRole: CaseAccessRole;
  expiresAt?: Date | null;
}

export interface EffectiveCaseAccess {
  canViewCase: boolean;
  canManageAssignments: boolean;
  isPrimaryOwner: boolean;
  isSecondaryCollaborator: boolean;
  accessRole: CaseAccessRole | 'primary_owner' | null;
  canComment: boolean;
  canUploadDocuments: boolean;
  canEditCaseNotes: boolean;
  canDraftActions: boolean;
  canViewPrivateDocuments: boolean;
  ownerOnly: {
    canReassignPrimary: boolean;
    canCloseCase: boolean;
    canRemovePrimaryAccess: boolean;
    canExportSealedEvidence: boolean;
  };
}

export async function grantCaseAccess(input: GrantCaseAccessInput, exec: RLSTx = db) {
  const [existing] = await exec
    .select()
    .from(grievanceCaseAccessAssignments)
    .where(
      and(
        eq(grievanceCaseAccessAssignments.organizationId, input.organizationId),
        eq(grievanceCaseAccessAssignments.grievanceId, input.grievanceId),
        eq(grievanceCaseAccessAssignments.userId, input.userId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await exec
      .update(grievanceCaseAccessAssignments)
      .set({
        accessRole: input.accessRole,
        status: 'active',
        grantedBy: input.grantedBy,
        grantedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        canComment: input.canComment ?? true,
        canUploadDocuments: input.canUploadDocuments ?? false,
        canEditCaseNotes: input.canEditCaseNotes ?? false,
        canDraftActions: input.canDraftActions ?? false,
        canViewPrivateDocuments: input.canViewPrivateDocuments ?? false,
        updatedAt: new Date(),
      })
      .where(eq(grievanceCaseAccessAssignments.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await exec
    .insert(grievanceCaseAccessAssignments)
    .values({
      organizationId: input.organizationId,
      grievanceId: input.grievanceId,
      userId: input.userId,
      accessRole: input.accessRole,
      grantedBy: input.grantedBy,
      expiresAt: input.expiresAt ?? null,
      canComment: input.canComment ?? true,
      canUploadDocuments: input.canUploadDocuments ?? false,
      canEditCaseNotes: input.canEditCaseNotes ?? false,
      canDraftActions: input.canDraftActions ?? false,
      canViewPrivateDocuments: input.canViewPrivateDocuments ?? false,
      status: 'active',
    })
    .returning();

  return created;
}

export async function updateCaseAccessStatus(id: string, status: CaseAccessStatus, exec: RLSTx = db) {
  const [updated] = await exec
    .update(grievanceCaseAccessAssignments)
    .set({ status, updatedAt: new Date() })
    .where(eq(grievanceCaseAccessAssignments.id, id))
    .returning();

  return updated ?? null;
}

export const MAX_CASE_ACCESS_GRANT_DAYS = 365;

export type CaseAccessMutationFailure = {
  ok: false;
  status: 400 | 403 | 404;
  code:
    | 'CASE_NOT_FOUND'
    | 'CASE_MANAGEMENT_AUTHORITY_REQUIRED'
    | 'GRANTEE_INELIGIBLE'
    | 'SELF_GRANT_FORBIDDEN'
    | 'PRIMARY_OWNER_GRANT_FORBIDDEN'
    | 'INVALID_EXPIRY'
    | 'EXPIRY_REQUIRED'
    | 'SCOPE_EXCEEDS_ROLE'
    | 'ASSIGNMENT_NOT_FOUND';
  message: string;
};

/**
 * Validates grant terms independent of who is asking. Pure so the policy can be
 * exercised without a database.
 */
export function validateCaseAccessGrantTerms(
  input: Pick<GrantCaseAccessInput, 'accessRole' | 'expiresAt' | 'canViewPrivateDocuments' | 'canUploadDocuments' | 'canEditCaseNotes' | 'canDraftActions'>,
  now: Date = new Date(),
): CaseAccessMutationFailure | null {
  if (input.accessRole !== 'secondary_lro' && (input.canEditCaseNotes || input.canDraftActions || input.canUploadDocuments)) {
    return { ok: false, status: 400, code: 'SCOPE_EXCEEDS_ROLE', message: 'Only a secondary LRO grant may carry editing, drafting or upload rights.' };
  }
  const requiresExpiry = input.accessRole !== 'secondary_lro' || input.canViewPrivateDocuments === true;
  if (!input.expiresAt) {
    return requiresExpiry
      ? { ok: false, status: 400, code: 'EXPIRY_REQUIRED', message: 'Reviewer, read-only and private-document grants must expire.' }
      : null;
  }
  const ms = input.expiresAt.getTime();
  if (Number.isNaN(ms) || ms <= now.getTime() || ms > now.getTime() + MAX_CASE_ACCESS_GRANT_DAYS * 86_400_000) {
    return { ok: false, status: 400, code: 'INVALID_EXPIRY', message: `Expiry must be in the future and within ${MAX_CASE_ACCESS_GRANT_DAYS} days.` };
  }
  return null;
}

async function loadCaseOwner(exec: RLSTx, organizationId: string, grievanceId: string) {
  const [grievance] = await exec
    .select({ unionRepId: grievances.unionRepId })
    .from(grievances)
    .where(and(eq(grievances.organizationId, organizationId), eq(grievances.id, grievanceId)))
    .limit(1);
  return grievance ?? null;
}

/**
 * Case-access grants are a case-management power. Org-wide role seniority does not
 * confer it: only the primary owner of this specific case may change collaborators.
 */
export async function grantCaseAccessGuarded(
  input: GrantCaseAccessInput,
): Promise<{ ok: true; access: Awaited<ReturnType<typeof grantCaseAccess>> } | CaseAccessMutationFailure> {
  // The owner check, the grant and its audit record share one transaction, so a grant can neither
  // commit unaudited nor be decided against an owner who changed in between.
  return withRLSContext({ organizationId: input.organizationId }, async (tx) => {
    const grievance = await loadCaseOwner(tx, input.organizationId, input.grievanceId);
    if (!grievance) return { ok: false as const, status: 404 as const, code: 'CASE_NOT_FOUND' as const, message: 'Grievance not found.' };
    if (grievance.unionRepId !== input.grantedBy) {
      return { ok: false as const, status: 403 as const, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED' as const, message: 'Only the primary owner of this case may grant collaborator access.' };
    }
    if (input.userId === input.grantedBy) {
      return { ok: false as const, status: 403 as const, code: 'SELF_GRANT_FORBIDDEN' as const, message: 'A case access grant cannot target the grantor.' };
    }
    if (grievance.unionRepId === input.userId) {
      return { ok: false as const, status: 400 as const, code: 'PRIMARY_OWNER_GRANT_FORBIDDEN' as const, message: 'The primary owner already holds full access.' };
    }
    const terms = validateCaseAccessGrantTerms(input);
    if (terms) return terms;

    const eligible = await caseAssigneeEligible(tx, { userId: input.grantedBy, organizationId: input.organizationId, role: 'steward' }, input.userId);
    if (!eligible) {
      return { ok: false as const, status: 400 as const, code: 'GRANTEE_INELIGIBLE' as const, message: 'Grantee is not an active representative in this organization.' };
    }

    const access = await grantCaseAccess(input, tx);
    await persistAtomicAudit(tx, {
      organizationId: input.organizationId,
      userId: input.grantedBy,
      action: 'case.access_granted',
      resourceType: 'grievance_case_access_assignments',
      resourceId: access.id,
      details: {
        grievanceId: input.grievanceId,
        targetUserId: access.userId,
        accessRole: access.accessRole,
        status: access.status,
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
    return { ok: true as const, access };
  });
}

export async function revokeCaseAccessGuarded(params: {
  organizationId: string;
  grievanceId: string;
  assignmentId: string;
  actorId: string;
}): Promise<
  | { ok: true; before: typeof grievanceCaseAccessAssignments.$inferSelect; updated: typeof grievanceCaseAccessAssignments.$inferSelect }
  | CaseAccessMutationFailure
> {
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
    const grievance = await loadCaseOwner(tx, params.organizationId, params.grievanceId);
    if (!grievance) return { ok: false as const, status: 404 as const, code: 'CASE_NOT_FOUND' as const, message: 'Grievance not found.' };
    if (grievance.unionRepId !== params.actorId) {
      return { ok: false as const, status: 403 as const, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED' as const, message: 'Only the primary owner of this case may revoke collaborator access.' };
    }
    const [before] = await tx
      .select()
      .from(grievanceCaseAccessAssignments)
      .where(
        and(
          eq(grievanceCaseAccessAssignments.id, params.assignmentId),
          eq(grievanceCaseAccessAssignments.organizationId, params.organizationId),
          eq(grievanceCaseAccessAssignments.grievanceId, params.grievanceId),
        ),
      )
      .limit(1);
    if (!before) return { ok: false as const, status: 404 as const, code: 'ASSIGNMENT_NOT_FOUND' as const, message: 'Access assignment not found.' };

    const updated = await updateCaseAccessStatus(before.id, 'revoked', tx);
    if (!updated) return { ok: false as const, status: 404 as const, code: 'ASSIGNMENT_NOT_FOUND' as const, message: 'Access assignment not found.' };

    await persistAtomicAudit(tx, {
      organizationId: params.organizationId,
      userId: params.actorId,
      action: 'case.access_revoked',
      resourceType: 'grievance_case_access_assignments',
      resourceId: updated.id,
      details: {
        grievanceId: params.grievanceId,
        targetUserId: updated.userId,
        previousStatus: before.status,
        status: updated.status,
      },
    });
    return { ok: true as const, before, updated };
  });
}

export async function expireElapsedCaseAccessAssignments() {
  const rows = await db
    .update(grievanceCaseAccessAssignments)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(grievanceCaseAccessAssignments.status, 'active'),
        sql`${grievanceCaseAccessAssignments.expiresAt} IS NOT NULL`,
        sql`${grievanceCaseAccessAssignments.expiresAt} <= NOW()`,
      ),
    )
    .returning();

  return rows;
}

export async function getEffectiveCaseAccess(params: {
  organizationId: string;
  grievanceId: string;
  userId: string;
}): Promise<EffectiveCaseAccess> {
  const [grievance] = await db
    .select({ unionRepId: grievances.unionRepId })
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, params.organizationId),
        eq(grievances.id, params.grievanceId),
      ),
    )
    .limit(1);

  const isPrimaryOwner = grievance?.unionRepId === params.userId;

  if (isPrimaryOwner) {
    return {
      canViewCase: true,
      canManageAssignments: true,
      isPrimaryOwner: true,
      isSecondaryCollaborator: false,
      accessRole: 'primary_owner',
      canComment: true,
      canUploadDocuments: true,
      canEditCaseNotes: true,
      canDraftActions: true,
      canViewPrivateDocuments: true,
      ownerOnly: {
        canReassignPrimary: true,
        canCloseCase: true,
        canRemovePrimaryAccess: true,
        canExportSealedEvidence: true,
      },
    };
  }

  const [assignment] = await db
    .select()
    .from(grievanceCaseAccessAssignments)
    .where(
      and(
        eq(grievanceCaseAccessAssignments.organizationId, params.organizationId),
        eq(grievanceCaseAccessAssignments.grievanceId, params.grievanceId),
        eq(grievanceCaseAccessAssignments.userId, params.userId),
        eq(grievanceCaseAccessAssignments.status, 'active'),
        or(
          isNull(grievanceCaseAccessAssignments.expiresAt),
          sql`${grievanceCaseAccessAssignments.expiresAt} > NOW()`,
        ),
      ),
    )
    .limit(1);

  return {
    canViewCase: Boolean(assignment),
    canManageAssignments: false,
    isPrimaryOwner: false,
    isSecondaryCollaborator: Boolean(assignment),
    accessRole: assignment?.accessRole ?? null,
    canComment: assignment?.canComment ?? false,
    canUploadDocuments: assignment?.canUploadDocuments ?? false,
    canEditCaseNotes: assignment?.canEditCaseNotes ?? false,
    canDraftActions: assignment?.canDraftActions ?? false,
    canViewPrivateDocuments: assignment?.canViewPrivateDocuments ?? false,
    ownerOnly: {
      canReassignPrimary: false,
      canCloseCase: false,
      canRemovePrimaryAccess: false,
      canExportSealedEvidence: false,
    },
  };
}
