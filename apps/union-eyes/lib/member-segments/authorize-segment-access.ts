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
import { hasRoleInOrganization } from '@/lib/api-auth-guard'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { userHasOrganizationAccess } from '@/lib/organization-utils'
import {
  PLATFORM_MODULES,
  requireEntitlement,
} from '@/services/platform-economics/entitlement-guard'

/** Staff member directory minimum. Legacy role names are normalized inside hasRoleInOrganization. */
export const MEMBER_SEGMENT_MIN_ROLE = 'steward'

export const MEMBER_SEGMENT_EXPORT_ENTITLEMENT = PLATFORM_MODULES.EXPORT_SUITE

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
