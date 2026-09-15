import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  externalDocumentAccessGrants,
  externalMatterAccessGrants,
  representationAuthorities,
  type ExternalDocumentAccessGrant,
  type ExternalMatterAccessGrant,
  type RepresentationAuthority,
} from '@/db/schema/representation-authority-schema';
import { auditLog, AuditSeverity } from '@/lib/audit-logger';
import { evaluateRepresentationAuthority } from './representation-authority-service';

export type ExternalMatterPermission =
  | 'view'
  | 'comment'
  | 'upload_documents'
  | 'view_documents'
  | 'download_documents';

export type ExternalDocumentPermission = 'view' | 'download' | 'share';

export interface ExternalActor {
  userId: string;
  representativeOrganizationId?: string;
}

export interface ExternalAuthorizationDecision {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'authority_missing'
    | 'authority_invalid'
    | 'matter_grant_missing'
    | 'matter_grant_invalid'
    | 'document_grant_missing'
    | 'document_grant_invalid'
    | 'permission_missing';
  authorityId?: string;
  matterGrantId?: string;
  documentGrantId?: string;
}

function isActiveGrant(grant: {
  status: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
}, now: Date) {
  return grant.status === 'active' && !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now);
}

function matterGrantHasPermission(grant: ExternalMatterAccessGrant, permission: ExternalMatterPermission) {
  switch (permission) {
    case 'view':
      return grant.canView;
    case 'comment':
      return grant.canComment;
    case 'upload_documents':
      return grant.canUploadDocuments;
    case 'view_documents':
      return grant.canViewDocuments;
    case 'download_documents':
      return grant.canDownloadDocuments;
  }
}

function documentGrantHasPermission(grant: ExternalDocumentAccessGrant, permission: ExternalDocumentPermission) {
  switch (permission) {
    case 'view':
      return grant.canView;
    case 'download':
      return grant.canDownload;
    case 'share':
      return grant.canShare;
  }
}

export function evaluateExternalMatterAccess(input: {
  actor: ExternalActor;
  organizationId: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
  requiredPermission: ExternalMatterPermission;
  authority: RepresentationAuthority | null | undefined;
  matterGrant: ExternalMatterAccessGrant | null | undefined;
  now?: Date;
}): ExternalAuthorizationDecision {
  const now = input.now ?? new Date();
  const authorityDecision = evaluateRepresentationAuthority({
    authority: input.authority,
    actorUserId: input.actor.userId,
    organizationId: input.organizationId,
    representativeOrganizationId: input.actor.representativeOrganizationId,
    matterType: input.matterType,
    matterId: input.matterId,
    now,
  });

  if (!input.authority) return { allowed: false, reason: 'authority_missing' };
  if (!authorityDecision.valid) {
    return { allowed: false, reason: 'authority_invalid', authorityId: input.authority.id };
  }

  const grant = input.matterGrant;
  if (!grant) return { allowed: false, reason: 'matter_grant_missing', authorityId: input.authority.id };
  const grantMatches =
    grant.authorityId === input.authority.id &&
    grant.organizationId === input.organizationId &&
    grant.userId === input.actor.userId &&
    grant.matterType === input.matterType &&
    grant.matterId === input.matterId &&
    grant.representativeOrganizationId === input.authority.representativeOrganizationId;

  if (!grantMatches || !isActiveGrant(grant, now)) {
    return {
      allowed: false,
      reason: 'matter_grant_invalid',
      authorityId: input.authority.id,
      matterGrantId: grant.id,
    };
  }

  if (!matterGrantHasPermission(grant, input.requiredPermission)) {
    return {
      allowed: false,
      reason: 'permission_missing',
      authorityId: input.authority.id,
      matterGrantId: grant.id,
    };
  }

  return {
    allowed: true,
    reason: 'allowed',
    authorityId: input.authority.id,
    matterGrantId: grant.id,
  };
}

export function evaluateExternalDocumentAccess(input: {
  actor: ExternalActor;
  organizationId: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
  documentId: string;
  requiredPermission: ExternalDocumentPermission;
  authority: RepresentationAuthority | null | undefined;
  matterGrant: ExternalMatterAccessGrant | null | undefined;
  documentGrant: ExternalDocumentAccessGrant | null | undefined;
  now?: Date;
}): ExternalAuthorizationDecision {
  const matterDecision = evaluateExternalMatterAccess({
    actor: input.actor,
    organizationId: input.organizationId,
    matterType: input.matterType,
    matterId: input.matterId,
    requiredPermission: input.requiredPermission === 'download' ? 'download_documents' : 'view_documents',
    authority: input.authority,
    matterGrant: input.matterGrant,
    now: input.now,
  });

  if (!matterDecision.allowed) return matterDecision;

  const now = input.now ?? new Date();
  const grant = input.documentGrant;
  if (!grant) {
    return {
      allowed: false,
      reason: 'document_grant_missing',
      authorityId: matterDecision.authorityId,
      matterGrantId: matterDecision.matterGrantId,
    };
  }

  const grantMatches =
    grant.authorityId === matterDecision.authorityId &&
    grant.matterGrantId === matterDecision.matterGrantId &&
    grant.organizationId === input.organizationId &&
    grant.userId === input.actor.userId &&
    grant.matterType === input.matterType &&
    grant.matterId === input.matterId &&
    grant.documentId === input.documentId &&
    grant.representativeOrganizationId === input.authority?.representativeOrganizationId;

  if (!grantMatches || !isActiveGrant(grant, now)) {
    return {
      allowed: false,
      reason: 'document_grant_invalid',
      authorityId: matterDecision.authorityId,
      matterGrantId: matterDecision.matterGrantId,
      documentGrantId: grant.id,
    };
  }

  if (!documentGrantHasPermission(grant, input.requiredPermission)) {
    return {
      allowed: false,
      reason: 'permission_missing',
      authorityId: matterDecision.authorityId,
      matterGrantId: matterDecision.matterGrantId,
      documentGrantId: grant.id,
    };
  }

  return {
    allowed: true,
    reason: 'allowed',
    authorityId: matterDecision.authorityId,
    matterGrantId: matterDecision.matterGrantId,
    documentGrantId: grant.id,
  };
}

export async function authorizeExternalMatterAccess(input: {
  actor: ExternalActor;
  organizationId: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
  requiredPermission: ExternalMatterPermission;
}): Promise<ExternalAuthorizationDecision> {
  const [authority] = await db
    .select()
    .from(representationAuthorities)
    .where(
      and(
        eq(representationAuthorities.organizationId, input.organizationId),
        eq(representationAuthorities.matterType, input.matterType),
        eq(representationAuthorities.matterId, input.matterId),
        eq(representationAuthorities.representativeUserId, input.actor.userId),
        eq(representationAuthorities.status, 'active'),
        isNull(representationAuthorities.revokedAt),
        or(isNull(representationAuthorities.expiresAt), sql`${representationAuthorities.expiresAt} > NOW()`),
      ),
    )
    .limit(1);

  const [matterGrant] = authority
    ? await db
      .select()
      .from(externalMatterAccessGrants)
      .where(
        and(
          eq(externalMatterAccessGrants.authorityId, authority.id),
          eq(externalMatterAccessGrants.organizationId, input.organizationId),
          eq(externalMatterAccessGrants.matterType, input.matterType),
          eq(externalMatterAccessGrants.matterId, input.matterId),
          eq(externalMatterAccessGrants.userId, input.actor.userId),
          eq(externalMatterAccessGrants.status, 'active'),
          isNull(externalMatterAccessGrants.revokedAt),
          or(isNull(externalMatterAccessGrants.expiresAt), sql`${externalMatterAccessGrants.expiresAt} > NOW()`),
        ),
      )
      .limit(1)
    : [undefined];

  const decision = evaluateExternalMatterAccess({
    ...input,
    authority,
    matterGrant,
  });
  await auditExternalAuthorizationDecision({ decision, actorUserId: input.actor.userId, organizationId: input.organizationId, resource: input.matterType, resourceId: input.matterId });
  return decision;
}

export async function authorizeExternalDocumentAccess(input: {
  actor: ExternalActor;
  organizationId: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
  documentId: string;
  requiredPermission: ExternalDocumentPermission;
}): Promise<ExternalAuthorizationDecision> {
  const [authority] = await db
    .select()
    .from(representationAuthorities)
    .where(
      and(
        eq(representationAuthorities.organizationId, input.organizationId),
        eq(representationAuthorities.matterType, input.matterType),
        eq(representationAuthorities.matterId, input.matterId),
        eq(representationAuthorities.representativeUserId, input.actor.userId),
        eq(representationAuthorities.status, 'active'),
        isNull(representationAuthorities.revokedAt),
        or(isNull(representationAuthorities.expiresAt), sql`${representationAuthorities.expiresAt} > NOW()`),
      ),
    )
    .limit(1);

  const [matterGrant] = authority
    ? await db
      .select()
      .from(externalMatterAccessGrants)
      .where(
        and(
          eq(externalMatterAccessGrants.authorityId, authority.id),
          eq(externalMatterAccessGrants.organizationId, input.organizationId),
          eq(externalMatterAccessGrants.matterType, input.matterType),
          eq(externalMatterAccessGrants.matterId, input.matterId),
          eq(externalMatterAccessGrants.userId, input.actor.userId),
          eq(externalMatterAccessGrants.status, 'active'),
          isNull(externalMatterAccessGrants.revokedAt),
          or(isNull(externalMatterAccessGrants.expiresAt), sql`${externalMatterAccessGrants.expiresAt} > NOW()`),
        ),
      )
      .limit(1)
    : [undefined];

  const [documentGrant] = matterGrant
    ? await db
      .select()
      .from(externalDocumentAccessGrants)
      .where(
        and(
          eq(externalDocumentAccessGrants.authorityId, authority.id),
          eq(externalDocumentAccessGrants.matterGrantId, matterGrant.id),
          eq(externalDocumentAccessGrants.organizationId, input.organizationId),
          eq(externalDocumentAccessGrants.matterType, input.matterType),
          eq(externalDocumentAccessGrants.matterId, input.matterId),
          eq(externalDocumentAccessGrants.documentId, input.documentId),
          eq(externalDocumentAccessGrants.userId, input.actor.userId),
          eq(externalDocumentAccessGrants.status, 'active'),
          isNull(externalDocumentAccessGrants.revokedAt),
          or(isNull(externalDocumentAccessGrants.expiresAt), sql`${externalDocumentAccessGrants.expiresAt} > NOW()`),
        ),
      )
      .limit(1)
    : [undefined];

  const decision = evaluateExternalDocumentAccess({
    ...input,
    authority,
    matterGrant,
    documentGrant,
  });
  await auditExternalAuthorizationDecision({ decision, actorUserId: input.actor.userId, organizationId: input.organizationId, resource: 'document', resourceId: input.documentId });
  return decision;
}

export async function auditExternalAuthorizationDecision(params: {
  decision: ExternalAuthorizationDecision;
  actorUserId: string;
  organizationId: string;
  resource: string;
  resourceId: string;
}) {
  return auditLog({
    eventType: params.decision.allowed
      ? 'external_authorization.allowed'
      : 'external_authorization.denied',
    severity: params.decision.allowed ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
    userId: params.actorUserId,
    organizationId: params.organizationId,
    resource: params.resource,
    resourceId: params.resourceId,
    action: 'authorize',
    details: {
      reason: params.decision.reason,
      authorityId: params.decision.authorityId,
      matterGrantId: params.decision.matterGrantId,
      documentGrantId: params.decision.documentGrantId,
    },
    outcome: params.decision.allowed ? 'success' : 'failure',
  });
}
