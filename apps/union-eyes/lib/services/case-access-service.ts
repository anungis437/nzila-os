import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
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

export async function grantCaseAccess(input: GrantCaseAccessInput) {
  const [existing] = await db
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
    const [updated] = await db
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

  const [created] = await db
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

export async function updateCaseAccessStatus(id: string, status: CaseAccessStatus) {
  const [updated] = await db
    .update(grievanceCaseAccessAssignments)
    .set({ status, updatedAt: new Date() })
    .where(eq(grievanceCaseAccessAssignments.id, id))
    .returning();

  return updated ?? null;
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
