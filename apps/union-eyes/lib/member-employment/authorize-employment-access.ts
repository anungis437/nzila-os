/**
 * Member-employment tenant and role boundary.
 *
 * A signed-in session is not employment authority. The caller-supplied
 * organization id is admitted only when `auth()` is a member of that
 * organization and `getUserRole` resolves that same principal to an
 * allow-listed organizational role. Platform administration is not on
 * those lists. `hasRole()` is not used.
 *
 * Member self-service is denied. This product has no verified link from
 * the authenticated user to a member record that grants employment or
 * leave visibility, and comparing a caller-supplied member id to a user
 * id is not that link.
 *
 * Compensation reads for dues use the finance allow-list plus the existing
 * `financial_intelligence_suite` entitlement. There is no separate internal
 * service caller for that action. An employment administrator who also holds
 * that finance authority receives `discloseCompensation` on the same grant.
 * Everyone else still administers employment, without individual pay figures.
 *
 * This module does not prove that a deployed database enforces row-level security.
 */

import { auth } from '@nzila/platform-auth/entra/server'
import { getUserRole, normalizeRole } from '@/lib/api-auth-guard'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { userHasOrganizationAccess } from '@/lib/organization-utils'
import {
  PLATFORM_MODULES,
  requireEntitlement,
} from '@/services/platform-economics/entitlement-guard'

/**
 * Organizational roles that already hold `EDIT_MEMBER`.
 * `super_admin` normalizes to `admin`. Platform roles, including
 * `system_admin`, are omitted on purpose.
 */
export const EMPLOYMENT_ADMIN_ROLES = [
  'admin',
  'president',
  'vice_president',
  'secretary_treasurer',
  'officer',
  'union_rep',
  'national_officer',
] as const

/**
 * Organizational roles that already hold `VIEW_FINANCIAL` or `MANAGE_FINANCES`.
 * An organization administrator is not on this list.
 */
export const EMPLOYMENT_FINANCE_ROLES = [
  'president',
  'vice_president',
  'secretary_treasurer',
] as const

export const EMPLOYMENT_DUES_ENTITLEMENT = PLATFORM_MODULES.FINANCIAL_INTELLIGENCE_SUITE

/** No member self-service employment permission is defined. */
export const MEMBER_EMPLOYMENT_SELF_SERVICE = 'denied' as const

export type EmploymentCapability = 'administer' | 'finance'

export class EmploymentBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmploymentBoundaryError'
  }
}

const registeredGrants = new WeakSet<object>()

export type EmploymentAccessGrant = {
  ok: true
  userId: string
  organizationId: string
  capability: EmploymentCapability
  discloseCompensation: boolean
}

export type EmploymentAccessDenial = {
  ok: false
  message: 'Unauthorized' | 'Forbidden' | 'Module access denied'
}

export type EmploymentAccessDecision = EmploymentAccessGrant | EmploymentAccessDenial

export function rolePermitsEmploymentAdmin(role: string | null | undefined): boolean {
  if (!role) return false
  return (EMPLOYMENT_ADMIN_ROLES as readonly string[]).includes(normalizeRole(role))
}

export function rolePermitsEmploymentFinance(role: string | null | undefined): boolean {
  if (!role) return false
  return (EMPLOYMENT_FINANCE_ROLES as readonly string[]).includes(normalizeRole(role))
}

export function leaveApprovalAttempted(data: {
  isApproved?: boolean | null
  approvedBy?: string | null
  approvedAt?: Date | string | null
}): boolean {
  return data.isApproved === true || data.approvedBy != null || data.approvedAt != null
}

/**
 * Approval needs the member row's current `userId`. A missing or blank link
 * does not prove the approver is someone else.
 */
export function leaveSubjectIdentityUnresolved(subjectUserId: string | null | undefined): boolean {
  return typeof subjectUserId !== 'string' || subjectUserId.trim() === ''
}

/**
 * The approver and the subject member must be different people.
 * `subjectUserId` comes from the member row, not from the caller payload.
 */
export function leaveSelfApprovalDenied(actorUserId: string, subjectUserId: string | null | undefined): boolean {
  if (leaveSubjectIdentityUnresolved(subjectUserId)) return false
  return subjectUserId!.trim() === actorUserId
}

export function assertRegisteredEmploymentGrant(
  value: unknown,
): asserts value is EmploymentAccessGrant {
  if (typeof value !== 'object' || value === null || !registeredGrants.has(value)) {
    throw new EmploymentBoundaryError('Forbidden')
  }
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
  capability: EmploymentCapability,
  reason: string,
): Promise<void> {
  try {
    await auditLog({
      eventType: AuditEventType.AUTHORITY_VIOLATION,
      severity: AuditSeverity.HIGH,
      userId,
      organizationId,
      resource: 'member_employment',
      action: 'member_employment_access',
      outcome: 'failure',
      metadata: { reason, capability },
    })
  } catch (error) {
    logger.warn('member-employment denial audit failed', {
      userId,
      organizationId,
      reason,
      error: error instanceof Error ? error.message : 'audit_failed',
    })
  }
}

export async function authorizeEmploymentAccess(
  organizationId: string,
  capability: EmploymentCapability,
): Promise<EmploymentAccessDecision> {
  const { userId } = await auth()
  if (!userId) {
    logger.warn('member-employment access denied', { reason: 'unauthenticated', capability })
    return { ok: false, message: 'Unauthorized' }
  }

  if (typeof organizationId !== 'string' || organizationId.trim() === '') {
    logger.warn('member-employment access denied', {
      reason: 'missing_organization',
      userId,
      capability,
    })
    return { ok: false, message: 'Forbidden' }
  }

  const requestedOrganizationId = organizationId.trim()
  const member = await userHasOrganizationAccess(userId, requestedOrganizationId)
  if (!member) {
    logger.warn('member-employment cross-tenant access denied', {
      eventType: AuditEventType.AUTHORITY_VIOLATION,
      reason: 'membership_required',
      userId,
      requestedOrganizationId,
      capability,
    })
    return { ok: false, message: 'Forbidden' }
  }

  let role: string | null
  try {
    role = await getUserRole(userId, requestedOrganizationId)
  } catch (error) {
    logger.warn('member-employment role lookup failed closed', {
      userId,
      organizationId: requestedOrganizationId,
      error: error instanceof Error ? error.message : 'role_lookup_failed',
    })
    return { ok: false, message: 'Forbidden' }
  }

  const allowed = capability === 'finance'
    ? rolePermitsEmploymentFinance(role)
    : rolePermitsEmploymentAdmin(role)
  if (!allowed) {
    await auditInOrganizationDenial(userId, requestedOrganizationId, capability, 'insufficient_role')
    return { ok: false, message: 'Forbidden' }
  }

  let discloseCompensation = false
  if (capability === 'finance' || rolePermitsEmploymentFinance(role)) {
    try {
      await requireEntitlement(requestedOrganizationId, EMPLOYMENT_DUES_ENTITLEMENT, userId)
      discloseCompensation = true
    } catch (error) {
      if (!isEntitlementDenial(error)) throw error
      if (capability === 'finance') return { ok: false, message: 'Module access denied' }
    }
  }

  const grant: EmploymentAccessGrant = {
    ok: true,
    userId,
    organizationId: requestedOrganizationId,
    capability,
    discloseCompensation,
  }
  registeredGrants.add(grant)
  return grant
}
