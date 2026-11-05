import { and, eq } from 'drizzle-orm';
import {
  externalDocumentAccessGrants,
  type NewExternalDocumentAccessGrant,
} from '@/db/schema/representation-authority-schema';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

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

  // The grant and its audit record commit together.
  return withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
    const [created] = await tx.insert(externalDocumentAccessGrants).values(grant).returning();
    await auditExternalDocumentGrant(tx, 'external_document_grant.created', created.id, grant);
    return created;
  });
}

export async function revokeExternalDocumentGrant(params: {
  grantId: string;
  organizationId: string;
  actorId: string;
}) {
  const now = new Date();
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
    const [updated] = await tx
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
      await auditExternalDocumentGrant(tx, 'external_document_grant.revoked', updated.id, {
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
  });
}

export async function expireExternalDocumentGrant(params: {
  grantId: string;
  organizationId: string;
  actorId: string;
}) {
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
    const [updated] = await tx
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
      await auditExternalDocumentGrant(tx, 'external_document_grant.expired', updated.id, {
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
  });
}

async function auditExternalDocumentGrant(
  tx: RLSTx,
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
  return persistAtomicAudit(tx, {
    userId: details.grantedBy,
    organizationId: details.organizationId,
    resourceType: 'external_document_access_grants',
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
  });
}
