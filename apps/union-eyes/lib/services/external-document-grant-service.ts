import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  externalDocumentAccessGrants,
  type NewExternalDocumentAccessGrant,
} from '@/db/schema/representation-authority-schema';
import { auditLog, AuditSeverity } from '@/lib/audit-logger';

export interface CreateExternalDocumentGrantInput extends NewExternalDocumentAccessGrant {
  grantorCanViewDocument: boolean;
  grantorCanShareDocument: boolean;
}

export function assertGrantorMayCreateDocumentGrant(input: {
  grantorCanViewDocument: boolean;
  grantorCanShareDocument: boolean;
}) {
  if (!input.grantorCanViewDocument || !input.grantorCanShareDocument) {
    throw new Error('Grantor is not authorized to share this document');
  }
}

export async function createExternalDocumentGrant(input: CreateExternalDocumentGrantInput) {
  assertGrantorMayCreateDocumentGrant(input);
  const { grantorCanViewDocument, grantorCanShareDocument, ...grant } = input;
  void grantorCanViewDocument;
  void grantorCanShareDocument;

  const [created] = await db.insert(externalDocumentAccessGrants).values(grant).returning();
  await auditExternalDocumentGrant('external_document_grant.created', created.id, grant);
  return created;
}

export async function revokeExternalDocumentGrant(params: {
  grantId: string;
  organizationId: string;
  actorId: string;
}) {
  const now = new Date();
  const [updated] = await db
    .update(externalDocumentAccessGrants)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedBy: params.actorId,
      updatedAt: now,
    })
    .where(
      and(
        eq(externalDocumentAccessGrants.id, params.grantId),
        eq(externalDocumentAccessGrants.organizationId, params.organizationId),
      ),
    )
    .returning();

  if (updated) {
    await auditExternalDocumentGrant('external_document_grant.revoked', updated.id, {
      organizationId: updated.organizationId,
      userId: updated.userId,
      grantedBy: params.actorId,
      matterId: updated.matterId,
      documentId: updated.documentId,
      authorityId: updated.authorityId,
      matterGrantId: updated.matterGrantId,
      representativeOrganizationId: updated.representativeOrganizationId,
      matterType: updated.matterType,
    });
  }

  return updated ?? null;
}

export async function expireExternalDocumentGrant(params: {
  grantId: string;
  organizationId: string;
  actorId: string;
}) {
  const [updated] = await db
    .update(externalDocumentAccessGrants)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(externalDocumentAccessGrants.id, params.grantId),
        eq(externalDocumentAccessGrants.organizationId, params.organizationId),
      ),
    )
    .returning();

  if (updated) {
    await auditExternalDocumentGrant('external_document_grant.expired', updated.id, {
      organizationId: updated.organizationId,
      userId: updated.userId,
      grantedBy: params.actorId,
      matterId: updated.matterId,
      documentId: updated.documentId,
      authorityId: updated.authorityId,
      matterGrantId: updated.matterGrantId,
      representativeOrganizationId: updated.representativeOrganizationId,
      matterType: updated.matterType,
    });
  }

  return updated ?? null;
}

async function auditExternalDocumentGrant(
  eventType: string,
  grantId: string,
  details: Pick<
    NewExternalDocumentAccessGrant,
    | 'organizationId'
    | 'userId'
    | 'grantedBy'
    | 'matterId'
    | 'documentId'
    | 'authorityId'
    | 'matterGrantId'
    | 'representativeOrganizationId'
    | 'matterType'
  >,
) {
  return auditLog({
    eventType,
    severity: AuditSeverity.MEDIUM,
    userId: details.grantedBy,
    organizationId: details.organizationId,
    resource: 'external_document_access_grants',
    resourceId: grantId,
    action: eventType,
    details: {
      targetUserId: details.userId,
      authorityId: details.authorityId,
      matterGrantId: details.matterGrantId,
      matterType: details.matterType,
      matterId: details.matterId,
      documentId: details.documentId,
      representativeOrganizationId: details.representativeOrganizationId,
    },
    outcome: 'success',
  });
}
