import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import type { Document } from '@/db/schema/documents-schema';
import { documentAccessGrants } from '@/db/schema/documents-schema';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { isDocumentVisibleByPolicy, toGovernanceLabel } from '@/lib/services/document-governance-service';

export interface DocumentAuthorizationActor {
  userId: string;
  isStewardPlus: boolean;
}

export interface AuthorizationCandidateDocument {
  id: string;
  privacyLabel?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}

export interface AuthorizedDocumentResult<T extends AuthorizationCandidateDocument> {
  document: T;
  allowed: boolean;
  reason: string;
}

async function getExplicitGrantDocumentIds(params: {
  organizationId: string;
  userId: string;
  documentIds: string[];
}) {
  if (params.documentIds.length === 0) {
    return new Set<string>();
  }

  const grantRows = await db
    .select({ documentId: documentAccessGrants.documentId })
    .from(documentAccessGrants)
    .where(
      and(
        eq(documentAccessGrants.organizationId, params.organizationId),
        eq(documentAccessGrants.userId, params.userId),
        inArray(documentAccessGrants.documentId, params.documentIds),
        eq(documentAccessGrants.status, 'active'),
        eq(documentAccessGrants.canView, true),
        sql`${documentAccessGrants.revokedAt} IS NULL`,
        sql`(${documentAccessGrants.expiresAt} IS NULL OR ${documentAccessGrants.expiresAt} > NOW())`,
      ),
    );

  return new Set(grantRows.map((row) => row.documentId));
}

async function getCaseAccessMap(params: {
  organizationId: string;
  actor: DocumentAuthorizationActor;
  grievanceIds: string[];
}) {
  const uniqueIds = [...new Set(params.grievanceIds.filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (grievanceId) => {
      const access = await getEffectiveCaseAccess({
        organizationId: params.organizationId,
        grievanceId,
        userId: params.actor.userId,
      });
      return [grievanceId, access] as const;
    }),
  );

  return new Map(entries);
}

export async function authorizeDocumentsForActor<T extends AuthorizationCandidateDocument>(params: {
  organizationId: string;
  actor: DocumentAuthorizationActor;
  documents: T[];
}) {
  const docIds = params.documents.map((d) => d.id);
  const explicitGrantIds = await getExplicitGrantDocumentIds({
    organizationId: params.organizationId,
    userId: params.actor.userId,
    documentIds: docIds,
  });

  const grievanceIds = params.documents
    .filter((doc) => doc.linkedEntityType === 'grievance' && doc.linkedEntityId)
    .map((doc) => doc.linkedEntityId as string);

  const caseAccessMap = await getCaseAccessMap({
    organizationId: params.organizationId,
    actor: params.actor,
    grievanceIds,
  });

  return params.documents.map((document): AuthorizedDocumentResult<T> => {
    const caseAccess =
      document.linkedEntityType === 'grievance' && document.linkedEntityId
        ? caseAccessMap.get(document.linkedEntityId)
        : null;

    const allowed = isDocumentVisibleByPolicy(
      toGovernanceLabel({ privacyLabel: document.privacyLabel } as Partial<Document>),
      {
        isOrgMember: true,
        isStewardPlus: params.actor.isStewardPlus,
        isPrimaryOwner: caseAccess?.isPrimaryOwner ?? false,
        hasCaseAccess:
          params.actor.isStewardPlus ||
          document.linkedEntityType !== 'grievance' ||
          Boolean(caseAccess?.canViewCase),
        canViewPrivateDocuments: caseAccess?.canViewPrivateDocuments ?? false,
        hasExplicitDocumentGrant: explicitGrantIds.has(document.id),
      },
    );

    if (!allowed) {
      return {
        document,
        allowed: false,
        reason: 'document_not_authorized',
      };
    }

    return {
      document,
      allowed: true,
      reason: explicitGrantIds.has(document.id)
        ? 'explicit_grant'
        : caseAccess?.isPrimaryOwner
          ? 'primary_owner_access'
          : caseAccess?.canViewCase
            ? 'case_access'
            : params.actor.isStewardPlus
              ? 'steward_access'
              : 'org_scope_access',
    };
  });
}

export async function filterAuthorizedDocumentsForActor<T extends AuthorizationCandidateDocument>(params: {
  organizationId: string;
  actor: DocumentAuthorizationActor;
  documents: T[];
}) {
  const authorized = await authorizeDocumentsForActor(params);
  return authorized.filter((item) => item.allowed).map((item) => item.document);
}
