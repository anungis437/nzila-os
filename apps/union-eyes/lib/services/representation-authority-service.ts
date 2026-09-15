import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import {
  representationAuthorities,
  type NewRepresentationAuthority,
  type RepresentationAuthority,
} from '@/db/schema/representation-authority-schema';
import { auditLog, AuditSeverity } from '@/lib/audit-logger';

export const RepresentationAuthorityAuditEvent = {
  AUTHORITY_CREATED: 'representation_authority.created',
  AUTHORITY_ACTIVATED: 'representation_authority.activated',
  AUTHORITY_REVOKED: 'representation_authority.revoked',
  AUTHORITY_EXPIRED: 'representation_authority.expired',
  AUTHORITY_SUPERSEDED: 'representation_authority.superseded',
} as const;

export type RepresentationAuthorityAuditEventType =
  (typeof RepresentationAuthorityAuditEvent)[keyof typeof RepresentationAuthorityAuditEvent];

export interface AuthorityValidityResult {
  valid: boolean;
  reason:
    | 'ok'
    | 'missing'
    | 'not_active'
    | 'not_yet_effective'
    | 'expired'
    | 'revoked'
    | 'wrong_user'
    | 'wrong_organization'
    | 'wrong_specialist_organization'
    | 'wrong_matter';
}

export function evaluateRepresentationAuthority(input: {
  authority: Pick<
    RepresentationAuthority,
    | 'status'
    | 'effectiveAt'
    | 'expiresAt'
    | 'revokedAt'
    | 'organizationId'
    | 'representativeUserId'
    | 'representativeOrganizationId'
    | 'matterType'
    | 'matterId'
  > | null | undefined;
  actorUserId: string;
  organizationId: string;
  representativeOrganizationId?: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
  now?: Date;
}): AuthorityValidityResult {
  const { authority } = input;
  const now = input.now ?? new Date();

  if (!authority) return { valid: false, reason: 'missing' };
  if (authority.status !== 'active') return { valid: false, reason: 'not_active' };
  if (authority.revokedAt) return { valid: false, reason: 'revoked' };
  if (authority.effectiveAt > now) return { valid: false, reason: 'not_yet_effective' };
  if (authority.expiresAt && authority.expiresAt <= now) return { valid: false, reason: 'expired' };
  if (authority.representativeUserId !== input.actorUserId) {
    return { valid: false, reason: 'wrong_user' };
  }
  if (authority.organizationId !== input.organizationId) {
    return { valid: false, reason: 'wrong_organization' };
  }
  if (
    input.representativeOrganizationId &&
    authority.representativeOrganizationId !== input.representativeOrganizationId
  ) {
    return { valid: false, reason: 'wrong_specialist_organization' };
  }
  if (authority.matterType !== input.matterType || authority.matterId !== input.matterId) {
    return { valid: false, reason: 'wrong_matter' };
  }

  return { valid: true, reason: 'ok' };
}

export async function createRepresentationAuthority(input: NewRepresentationAuthority) {
  const [created] = await db.insert(representationAuthorities).values(input).returning();
  await auditRepresentationAuthorityEvent({
    event: RepresentationAuthorityAuditEvent.AUTHORITY_CREATED,
    authority: created,
    actorId: input.createdBy,
  });
  return created;
}

export async function activateRepresentationAuthority(params: {
  authorityId: string;
  organizationId: string;
  actorId: string;
}) {
  const [updated] = await db
    .update(representationAuthorities)
    .set({ status: 'active', updatedAt: new Date() })
    .where(
      and(
        eq(representationAuthorities.id, params.authorityId),
        eq(representationAuthorities.organizationId, params.organizationId),
      ),
    )
    .returning();

  if (updated) {
    await auditRepresentationAuthorityEvent({
      event: RepresentationAuthorityAuditEvent.AUTHORITY_ACTIVATED,
      authority: updated,
      actorId: params.actorId,
    });
  }

  return updated ?? null;
}

export async function revokeRepresentationAuthority(params: {
  authorityId: string;
  organizationId: string;
  actorId: string;
}) {
  const now = new Date();
  const [updated] = await db
    .update(representationAuthorities)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedBy: params.actorId,
      updatedAt: now,
    })
    .where(
      and(
        eq(representationAuthorities.id, params.authorityId),
        eq(representationAuthorities.organizationId, params.organizationId),
      ),
    )
    .returning();

  if (updated) {
    await auditRepresentationAuthorityEvent({
      event: RepresentationAuthorityAuditEvent.AUTHORITY_REVOKED,
      authority: updated,
      actorId: params.actorId,
    });
  }

  return updated ?? null;
}

export async function auditRepresentationAuthorityEvent(params: {
  event: RepresentationAuthorityAuditEventType;
  authority: RepresentationAuthority;
  actorId: string;
  correlationId?: string;
}) {
  return auditLog({
    eventType: params.event,
    severity: AuditSeverity.MEDIUM,
    userId: params.actorId,
    organizationId: params.authority.organizationId,
    resource: 'representation_authorities',
    resourceId: params.authority.id,
    action: params.event,
    details: {
      authorityId: params.authority.id,
      matterId: params.authority.matterId,
      matterType: params.authority.matterType,
      representedPersonId: params.authority.representedPersonId,
      representativeUserId: params.authority.representativeUserId,
      representativeOrganizationId: params.authority.representativeOrganizationId,
      status: params.authority.status,
      correlationId: params.correlationId,
    },
    outcome: 'success',
  });
}
