/**
 * @nzila/platform-auth — Authorization Primitives
 *
 * Shared role/permission/module/org checks used by all apps.
 * Replaces bespoke per-app authorization helpers.
 */
import type { OrgContext } from '@nzila/org'
import { type PlatformRole, meetsRoleRequirement } from '@nzila/platform-contracts'

// ── Role Checks ─────────────────────────────────────────────────────────────

/** Check if user meets a minimum platform role requirement. */
export function hasPlatformRole(
  userRole: PlatformRole,
  requiredRole: PlatformRole,
): boolean {
  return meetsRoleRequirement(userRole, requiredRole)
}

/** Check if user has any of the specified platform roles. */
export function hasAnyPlatformRole(
  userRole: PlatformRole,
  roles: PlatformRole[],
): boolean {
  return roles.some(r => meetsRoleRequirement(userRole, r))
}

// ── Permission Checks ───────────────────────────────────────────────────────

/** Check if org context has a specific permission. */
export function hasPermission(
  ctx: OrgContext,
  permission: string,
): boolean {
  return ctx.permissions.includes(permission)
}

/** Check if org context has ALL specified permissions. */
export function hasAllPermissions(
  ctx: OrgContext,
  permissions: string[],
): boolean {
  return permissions.every(p => ctx.permissions.includes(p))
}

/** Check if org context has ANY of the specified permissions. */
export function hasAnyPermission(
  ctx: OrgContext,
  permissions: string[],
): boolean {
  return permissions.some(p => ctx.permissions.includes(p))
}

// ── Module Access Checks ────────────────────────────────────────────────────

/**
 * Determine if a user can access a module based on their role,
 * permissions, and entitlements.
 */
export function canAccessModule(
  params: {
    userRole: PlatformRole
    permissions: readonly string[]
    enabledModules: string[]
  },
  moduleId: string,
  moduleConfig: {
    requiredRoles?: string[]
    requiredEntitlements?: string[]
  },
): { granted: boolean; reason?: string } {
  // Check module enablement
  if (!params.enabledModules.includes(moduleId)) {
    return { granted: false, reason: 'Module not enabled for this org' }
  }

  // Check required roles
  if (moduleConfig.requiredRoles && moduleConfig.requiredRoles.length > 0) {
    const hasRole = moduleConfig.requiredRoles.includes(params.userRole)
    if (!hasRole) {
      return { granted: false, reason: 'Insufficient role for this module' }
    }
  }

  // Check required entitlements
  if (moduleConfig.requiredEntitlements && moduleConfig.requiredEntitlements.length > 0) {
    const hasEntitlements = moduleConfig.requiredEntitlements.every(
      e => params.permissions.includes(e),
    )
    if (!hasEntitlements) {
      return { granted: false, reason: 'Missing required entitlement' }
    }
  }

  return { granted: true }
}

// ── Org Membership Checks ───────────────────────────────────────────────────

/** Check if a user is an active member of the specified org. */
export function isOrgMember(
  membership: { status: string } | null | undefined,
): boolean {
  return membership?.status === 'active'
}

/** Check if a user has at least a specific org role level. */
export function meetsOrgRoleRequirement(
  currentRole: string,
  requiredRole: 'org_admin' | 'org_secretary' | 'org_viewer',
): boolean {
  const hierarchy: Record<string, number> = {
    org_admin: 3,
    org_secretary: 2,
    org_viewer: 1,
  }
  return (hierarchy[currentRole] ?? 0) >= (hierarchy[requiredRole] ?? 0)
}

// ── Privileged Action Checks ────────────────────────────────────────────────

/**
 * Check if the current context allows a privileged (state-changing) action.
 * Returns a denial reason or null if allowed.
 */
export function checkPrivilegedAction(
  ctx: OrgContext,
  requiredPermission: string,
  opts?: {
    requiredRoles?: string[]
    allowServiceAccounts?: boolean
  },
): string | null {
  // Permission check
  if (!ctx.permissions.includes(requiredPermission)) {
    return `Missing permission: ${requiredPermission}`
  }

  // Role check
  if (opts?.requiredRoles && opts.requiredRoles.length > 0) {
    if (!opts.requiredRoles.includes(ctx.role)) {
      return `Requires role: ${opts.requiredRoles.join(' | ')}`
    }
  }

  // Service account check
  if (!opts?.allowServiceAccounts && ctx.actorId.startsWith('svc:')) {
    return 'Service accounts cannot perform this action'
  }

  return null
}
