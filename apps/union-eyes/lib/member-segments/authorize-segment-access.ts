/**
 * Member-segment tenant boundary.
 *
 * Server actions accept an organization id from the caller. Existence of that
 * organization is not authorization. This helper admits the id only when the
 * authenticated principal has an active membership in it and holds at least
 * the steward role used by the staff member directory. Exports also require
 * the existing `export_suite` module entitlement.
 *
 * A denied cross-tenant attempt is logged here and is not written into the
 * target organization's audit trail. Role and entitlement denials are for a
 * principal who already belongs to the organization, so those are audited
 * against that organization.
 *
 * Binding the organization into `withRLSContext({ organizationId })` happens
 * in the query layer after this grant. This module does not prove that a
 * deployed database enforces row-level security.
 */

import { auth } from '@nzila/platform-auth/entra/server'
import { getUserRole, hasRoleInOrganization, normalizeRole } from '@/lib/api-auth-guard'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { userHasOrganizationAccess } from '@/lib/organization-utils'
import {
  PLATFORM_MODULES,
  requireEntitlement,
} from '@/services/platform-economics/entitlement-guard'

/** Staff member directory minimum. Legacy role names are normalized inside hasRoleInOrganization. */
export const MEMBER_SEGMENT_MIN_ROLE = 'steward'

/**
 * Changing another member's segment, public or private, is an organization
 * administrator permission. Reading another member's private segment uses the
 * same allow-list. It is not a rank. A higher ROLE_HIERARCHY value does not
 * grant it. `super_admin` normalizes to `admin`.
 */
export const MEMBER_SEGMENT_MANAGE_ROLES = ['admin'] as const

export const MEMBER_SEGMENT_EXPORT_ENTITLEMENT = PLATFORM_MODULES.EXPORT_SUITE

export type SegmentVisibilityIntent = 'own-and-public' | 'include-others-private' | 'record'

export type SegmentVisibilityScope = {
  actorUserId: string
  includeOthersPrivate: boolean
}

export type SegmentAccessGrant = {
  ok: true
  userId: string
  organizationId: string
}

export type SegmentAccessDenial = {
  ok: false
  message: 'Unauthorized' | 'Forbidden' | 'Module access denied'
}

export type SegmentAccessDecision = SegmentAccessGrant | SegmentAccessDenial

type AuthorizeOptions = {
  entitlement?: string
}

function isEntitlementDenial(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ENTITLEMENT_REQUIRED'
  )
}

async function auditInOrganizationDenial(
  userId: string,
  organizationId: string,
  reason: string,
): Promise<void> {
  try {
    await auditLog({
      eventType: AuditEventType.AUTHORITY_VIOLATION,
      severity: AuditSeverity.HIGH,
      userId,
      organizationId,
      resource: 'member_segments',
      action: 'member_segment_access',
      outcome: 'failure',
      metadata: { reason, minRole: MEMBER_SEGMENT_MIN_ROLE },
    })
  } catch (error) {
    // The read or export does not proceed. Audit persistence failure stays a denial.
    logger.warn('member-segment denial audit failed', {
      userId,
      organizationId,
      reason,
      error: error instanceof Error ? error.message : 'audit_failed',
    })
  }
}

export async function authorizeMemberSegmentAccess(
  organizationId: string,
  options: AuthorizeOptions = {},
): Promise<SegmentAccessDecision> {
  const { userId } = await auth()
  if (!userId) {
    logger.warn('member-segment access denied', { reason: 'unauthenticated' })
    return { ok: false, message: 'Unauthorized' }
  }

  if (typeof organizationId !== 'string' || organizationId.trim() === '') {
    logger.warn('member-segment access denied', {
      reason: 'missing_organization',
      userId,
    })
    return { ok: false, message: 'Forbidden' }
  }

  const requestedOrganizationId = organizationId.trim()
  const member = await userHasOrganizationAccess(userId, requestedOrganizationId)
  if (!member) {
    // Do not write this attempt into the requested organization's audit log.
    logger.warn('member-segment cross-tenant access denied', {
      eventType: AuditEventType.AUTHORITY_VIOLATION,
      reason: 'membership_required',
      userId,
      requestedOrganizationId,
    })
    return { ok: false, message: 'Forbidden' }
  }

  const roleAllowed = await hasRoleInOrganization(
    requestedOrganizationId,
    MEMBER_SEGMENT_MIN_ROLE,
    userId,
  )
  if (!roleAllowed) {
    await auditInOrganizationDenial(userId, requestedOrganizationId, 'insufficient_role')
    return { ok: false, message: 'Forbidden' }
  }

  if (options.entitlement) {
    try {
      await requireEntitlement(requestedOrganizationId, options.entitlement, userId)
    } catch (error) {
      if (!isEntitlementDenial(error)) throw error
      return { ok: false, message: 'Module access denied' }
    }
  }

  return { ok: true, userId, organizationId: requestedOrganizationId }
}

/**
 * Same principal as `authorizeMemberSegmentAccess`: `userId` is the `auth()` id,
 * and `getUserRole` binds that id in both canonical and legacy resolution.
 * Fail closed when the role lookup throws.
 */
export async function actorCanManagePrivateSegments(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  try {
    const role = await getUserRole(userId, organizationId)
    if (!role) return false
    return (MEMBER_SEGMENT_MANAGE_ROLES as readonly string[]).includes(normalizeRole(role))
  } catch (error) {
    logger.warn('member-segment management check failed closed', {
      userId,
      organizationId,
      error: error instanceof Error ? error.message : 'role_lookup_failed',
    })
    return false
  }
}

/**
 * `own-and-public` never returns another member's private segments.
 * `include-others-private` is the explicit list request and is denied without
 * the administrator allow-list. `record` widens a single-segment read only
 * when that allow-list holds. Mutation of another member's segment is a
 * separate check: public visibility does not grant it.
 */
export function segmentMutationAllowed(
  actorUserId: string,
  segment: { createdBy: string },
  canManageOthers: boolean,
): boolean {
  return segment.createdBy === actorUserId || canManageOthers
}

export async function resolveSegmentVisibility(
  access: { userId: string; organizationId: string },
  intent: SegmentVisibilityIntent,
): Promise<{ ok: true; visibility: SegmentVisibilityScope } | SegmentAccessDenial> {
  if (intent === 'own-and-public') {
    return {
      ok: true,
      visibility: { actorUserId: access.userId, includeOthersPrivate: false },
    }
  }
  const canManage = await actorCanManagePrivateSegments(access.userId, access.organizationId)
  if (intent === 'include-others-private' && !canManage) {
    await auditInOrganizationDenial(
      access.userId,
      access.organizationId,
      'private_segment_management_required',
    )
    return { ok: false, message: 'Forbidden' }
  }
  return {
    ok: true,
    visibility: {
      actorUserId: access.userId,
      includeOthersPrivate: canManage,
    },
  }
}
