/**
 * Organization-member tenant and role boundary.
 *
 * A signed-in session is not membership authority. The caller-supplied
 * organization id is admitted only when `auth()` is a member of that
 * organization and `getUserRole` resolves that same principal to an
 * allow-listed organizational role. Platform roles are omitted.
 * `hasRole()` is not used.
 *
 * Administering a member record, assigning a role, and removing a member
 * are different decisions. Role assignment is the organizational `admin`
 * role, which already holds `MANAGE_ROLES`. Removal follows
 * `Permission.DELETE_MEMBER`. Among organizational roles that permission
 * is held by `admin`; platform roles are still excluded here. The returned
 * grant is frozen.
 *
 * This module does not prove that a deployed database enforces row-level security.
 */

import { auth } from '@nzila/platform-auth/entra/server'
import { TENANT_SELF_SERVICE_ASSIGNABLE_ROLES } from '@nzila/platform-auth/invites'
import { PLATFORM_ELEVATED_ROLES, getUserRole, normalizeRole } from '@/lib/api-auth-guard'
import { hasPermission, Permission, UserRole } from '@/lib/auth/roles'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { userHasOrganizationAccess } from '@/lib/organization-utils'

/** Organizational roles that hold `EDIT_MEMBER` and are not platform roles. */
export const MEMBER_ADMIN_ROLES = [
  'admin',
  'president',
  'vice_president',
  'secretary_treasurer',
  'officer',
  'union_rep',
] as const

/** Organizational role that holds `MANAGE_ROLES`. */
export const MEMBER_ROLE_ADMIN_ROLES = ['admin'] as const

export type MemberCapability = 'administer' | 'assign_role' | 'remove_member'

export class MemberBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MemberBoundaryError'
  }
}

const registeredGrants = new WeakSet<object>()

export type MemberAccessGrant = {
  ok: true
  userId: string
  organizationId: string
  capability: MemberCapability
}

export type MemberAccessDenial = {
  ok: false
  message: 'Unauthorized' | 'Forbidden'
}

export type MemberAccessDecision = MemberAccessGrant | MemberAccessDenial

function organizationalRole(role: string | null | undefined): string | null {
  if (!role) return null
  if (role === 'super_admin') return null
  if ((PLATFORM_ELEVATED_ROLES as readonly string[]).includes(role)) return null
  const normalized = normalizeRole(role)
  if ((PLATFORM_ELEVATED_ROLES as readonly string[]).includes(normalized)) return null
  return normalized
}

export function rolePermitsMemberAdmin(role: string | null | undefined): boolean {
  const normalized = organizationalRole(role)
  if (!normalized) return false
  return (MEMBER_ADMIN_ROLES as readonly string[]).includes(normalized)
}

export function rolePermitsMemberRoleAdmin(role: string | null | undefined): boolean {
  const normalized = organizationalRole(role)
  if (!normalized) return false
  return (MEMBER_ROLE_ADMIN_ROLES as readonly string[]).includes(normalized)
}

function isUserRole(role: string): role is UserRole {
  return (Object.values(UserRole) as string[]).includes(role)
}

/** True only when the canonical permission matrix grants `DELETE_MEMBER`. */
export function rolePermitsMemberRemoval(role: string | null | undefined): boolean {
  const normalized = organizationalRole(role)
  if (!normalized || !isUserRole(normalized)) return false
  return hasPermission(normalized, Permission.DELETE_MEMBER)
}

export function assertTenantAssignableRole(role: string): void {
  if (
    !TENANT_SELF_SERVICE_ASSIGNABLE_ROLES.has(role) ||
    (PLATFORM_ELEVATED_ROLES as readonly string[]).includes(role)
  ) {
    throw new MemberBoundaryError('Forbidden')
  }
}

export function assertRegisteredMemberGrant(value: unknown): asserts value is MemberAccessGrant {
  if (typeof value !== 'object' || value === null || !registeredGrants.has(value)) {
    throw new MemberBoundaryError('Forbidden')
  }
}

async function auditDenial(userId: string, organizationId: string, capability: MemberCapability): Promise<void> {
  try {
    await auditLog({
      eventType: AuditEventType.AUTHORITY_VIOLATION,
      severity: AuditSeverity.HIGH,
      userId,
      organizationId,
      resource: 'organization_member',
      action: 'member_access',
      outcome: 'failure',
      metadata: { reason: 'insufficient_role', capability },
    })
  } catch (error) {
    logger.warn('member denial audit failed', {
      userId,
      organizationId,
      error: error instanceof Error ? error.message : 'audit_failed',
    })
  }
}

export async function authorizeMemberAccess(
  organizationId: string,
  capability: MemberCapability,
): Promise<MemberAccessDecision> {
  const { userId } = await auth()
  if (!userId) {
    logger.warn('member access denied', { reason: 'unauthenticated', capability })
    return { ok: false, message: 'Unauthorized' }
  }
  if (typeof organizationId !== 'string' || organizationId.trim() === '') {
    return { ok: false, message: 'Forbidden' }
  }

  const requestedOrganizationId = organizationId.trim()
  const member = await userHasOrganizationAccess(userId, requestedOrganizationId)
  if (!member) return { ok: false, message: 'Forbidden' }

  let role: string | null
  try {
    role = await getUserRole(userId, requestedOrganizationId)
  } catch (error) {
    logger.warn('member role lookup failed closed', {
      userId,
      organizationId: requestedOrganizationId,
      error: error instanceof Error ? error.message : 'role_lookup_failed',
    })
    return { ok: false, message: 'Forbidden' }
  }

  const allowed = capability === 'assign_role'
    ? rolePermitsMemberRoleAdmin(role)
    : capability === 'remove_member'
      ? rolePermitsMemberRemoval(role)
      : rolePermitsMemberAdmin(role)
  if (!allowed) {
    await auditDenial(userId, requestedOrganizationId, capability)
    return { ok: false, message: 'Forbidden' }
  }

  const grant: MemberAccessGrant = Object.freeze({
    ok: true,
    userId,
    organizationId: requestedOrganizationId,
    capability,
  })
  registeredGrants.add(grant)
  return grant
}

/**
 * Session check for the caller's own membership row. This is not member
 * administration. Authentication uses it to see whether that principal is
 * an active member of the organization already on the session.
 */
export async function authorizeOwnMembership(
  userId: string,
  organizationId: string,
): Promise<MemberAccessDenial | { ok: true; userId: string; organizationId: string }> {
  const session = await auth()
  if (!session.userId || session.userId !== userId) return { ok: false, message: 'Unauthorized' }
  if (typeof organizationId !== 'string' || organizationId.trim() === '') {
    return { ok: false, message: 'Forbidden' }
  }
  const requestedOrganizationId = organizationId.trim()
  const member = await userHasOrganizationAccess(session.userId, requestedOrganizationId)
  if (!member) return { ok: false, message: 'Forbidden' }
  return { ok: true, userId: session.userId, organizationId: requestedOrganizationId }
}
