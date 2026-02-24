/**
 * Permission Matrix & Authorization Utilities
 * Re-exports and augments the permission system from roles.ts
 */

import { UserRole, Permission, ROLE_PERMISSIONS } from './roles';
import type { PermissionCheckOptions, RoleCheckOptions } from './types';
import { db } from '@/db';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { eq, and } from 'drizzle-orm';

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  return rolePermissions.includes(permission);
}

/**
 * Check if any of the given roles have a specific permission
 */
export function anyRoleHasPermission(roles: UserRole[], permission: Permission): boolean {
  return roles.some(role => roleHasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for multiple roles (union)
 */
export function getPermissionsForRoles(roles: UserRole[]): Permission[] {
  const permissionSet = new Set<Permission>();
  roles.forEach(role => {
    const permissions = getPermissionsForRole(role);
    permissions.forEach(p => permissionSet.add(p));
  });
  return Array.from(permissionSet);
}

/**
 * @deprecated Use withPermission() from lib/enterprise-role-middleware.ts instead
 * This function is deprecated and will be removed in a future version.
 * 
 * MIGRATION GUIDE:
 * Replace: checkUserPermission({ userId, organizationId, permission: 'MANAGE_MEMBERS' })
 * With: withPermission('MANAGE_MEMBERS', async (request, context) => { ... })
 * 
 * Check if a user has required permissions by querying organization_members table
 */
export async function checkUserPermission(options: PermissionCheckOptions): Promise<boolean> {
  if (!options.organizationId) {
return false;
  }

  try {
    const [member] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, options.organizationId),
          eq(organizationMembers.userId, options.userId)
        )
      )
      .limit(1);

    if (!member?.role) {
      return false;
    }

    const mappedRole = mapOrganizationRoleToUserRole(member.role);
    return roleHasPermission(mappedRole, options.permission);
  } catch (_error) {
return false;
  }
}

/**
 * @deprecated Use withEnhancedRoleAuth() from lib/enterprise-role-middleware.ts instead
 * This function is deprecated and will be removed in a future version.
 * 
 * MIGRATION GUIDE:
 * Replace: checkUserRole({ userId, organizationId, role: 'admin' })
 * With: withEnhancedRoleAuth(ROLE_LEVELS.ADMIN, async (request, context) => { ... })
 * 
 * Check if a user has required role by querying organization_members table
 */
export async function checkUserRole(options: RoleCheckOptions): Promise<boolean> {
  if (!options.organizationId) {
return false;
  }

  try {
    const [member] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, options.organizationId),
          eq(organizationMembers.userId, options.userId)
        )
      )
      .limit(1);

    if (!member?.role) {
      return false;
    }

    const mappedRole = mapOrganizationRoleToUserRole(member.role);
    const requiredRoles = Array.isArray(options.role) ? options.role : [options.role];
    return requiredRoles.includes(mappedRole);
  } catch (_error) {
return false;
  }
}

function mapOrganizationRoleToUserRole(role: string): UserRole {
  switch (role) {
    case 'admin':
      return UserRole.ADMIN;
    case 'officer':
      return UserRole.STAFF_REP;
    case 'steward':
      return UserRole.UNION_REP;
    default:
      return UserRole.MEMBER;
  }
}

/**
 * Re-export permission system (UserRole excluded - exported via unified-auth)
 */
export { Permission, ROLE_PERMISSIONS };

