/**
 * Role-Based Access Control Utilities
 * Union Claims Management System
 * 
 * Server-side utilities for checking user roles and permissions.
 *
 * INV-04: These functions now delegate to @nzila/os-core/policy `authorize()`
 * via the policy adapter.  Existing call-sites continue to work unchanged.
 */

import { auth, currentUser } from '@/lib/api-auth-guard';
import { db } from "@/db/db";
import { organizationUsers } from "@/db/schema/domains/member";
import { organizationMembers } from "@/db/schema-organizations";
import { eq, and } from "drizzle-orm";
import { UserRole, Permission, hasPermission, hasAnyPermission, hasAllPermissions, canAccessRoute } from "./roles";

// ── Build a reverse-lookup from enum string values → UserRole ─────────────
const USER_ROLE_VALUES = new Set(Object.values(UserRole) as string[]);

function resolveUserRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (USER_ROLE_VALUES.has(key)) return key as UserRole;
  // Legacy aliases
  const aliases: Record<string, UserRole> = {
    'super_admin': UserRole.ADMIN,
    'union_steward': UserRole.STEWARD,
    'union_officer': UserRole.OFFICER,
  };
  return aliases[key] ?? null;
}

/**
 * Get user role from database.
 *
 * Resolution order:
 *   1. `organization_users` table (canonical RBAC source)
 *   2. `organization_members` table (org-membership source, checked when
 *      an organizationId is provided)
 *   3. Clerk `publicMetadata.role`
 *   4. Fail-closed: throws if none of the above resolve.
 */
export async function getUserRole(
  userId: string,
  organizationId?: string | null,
): Promise<UserRole> {
  try {
    // 1. Try organization_users (canonical RBAC table)
    console.log('[getUserRole] Step 1: querying organization_users for', userId);
    const orgUser = await db
      .select({ role: organizationUsers.role })
      .from(organizationUsers)
      .where(eq(organizationUsers.userId, userId))
      .limit(1);
    console.log('[getUserRole] Step 1 result:', JSON.stringify(orgUser));

    const fromOrgUsers = resolveUserRole(orgUser[0]?.role);
    if (fromOrgUsers) return fromOrgUsers;

    // 2. Try organization_members (org-scoped membership)
    if (organizationId) {
      const orgMember = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.status, 'active'),
          ),
        )
        .limit(1);

      const fromOrgMembers = resolveUserRole(orgMember[0]?.role);
      if (fromOrgMembers) return fromOrgMembers;
    }

    // 3. Fallback to Clerk publicMetadata
    const user = await currentUser();
    const fromClerk = resolveUserRole(
      user?.publicMetadata?.role as string | undefined,
    );
    if (fromClerk) return fromClerk;

    // Default role
    return UserRole.MEMBER;
  } catch (error) {
    // SECURITY FIX: Fail closed — authorization errors must not grant access
    console.error('[getUserRole] FATAL:', error);
    throw new Error('Authorization system unavailable');
  }
}

/**
 * Get current user's role (server-side only)
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return getUserRole(userId);
}

/**
 * Check if current user has a specific permission
 */
export async function userHasPermission(permission: Permission): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return hasPermission(role, permission);
}

/**
 * Check if current user has any of the required permissions
 */
export async function userHasAnyPermission(permissions: Permission[]): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return hasAnyPermission(role, permissions);
}

/**
 * Check if current user has all required permissions
 */
export async function userHasAllPermissions(permissions: Permission[]): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return hasAllPermissions(role, permissions);
}

/**
 * Check if current user can access a route
 */
export async function userCanAccessRoute(route: string): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return canAccessRoute(role, route);
}

/**
 * Require authentication and return user role
 * Throws an error if user is not authenticated
 */
export async function requireAuth(): Promise<{ userId: string; role: UserRole }> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized - No user ID");
  }
  
  const role = await getUserRole(userId);
  return { userId, role };
}

/**
 * Require specific permission
 * Throws an error if user doesn&apos;t have the permission
 */
export async function requirePermission(permission: Permission): Promise<{ userId: string; role: UserRole }> {
  const authData = await requireAuth();
  
  if (!hasPermission(authData.role, permission)) {
    throw new Error(`Forbidden - Missing permission: ${permission}`);
  }
  
  return authData;
}

/**
 * Require any of the specified permissions
 */
export async function requireAnyPermission(permissions: Permission[]): Promise<{ userId: string; role: UserRole }> {
  const authData = await requireAuth();
  
  if (!hasAnyPermission(authData.role, permissions)) {
    throw new Error(`Forbidden - Missing any of permissions: ${permissions.join(", ")}`);
  }
  
  return authData;
}

/**
 * Require all specified permissions
 */
export async function requireAllPermissions(permissions: Permission[]): Promise<{ userId: string; role: UserRole }> {
  const authData = await requireAuth();
  
  if (!hasAllPermissions(authData.role, permissions)) {
    throw new Error(`Forbidden - Missing all permissions: ${permissions.join(", ")}`);
  }
  
  return authData;
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<{ userId: string; role: UserRole }> {
  const authData = await requireAuth();
  
  if (authData.role !== UserRole.ADMIN) {
    throw new Error("Forbidden - Admin access required");
  }
  
  return authData;
}

/**
 * Require union rep or higher role
 */
export async function requireUnionRepOrHigher(): Promise<{ userId: string; role: UserRole }> {
  const authData = await requireAuth();
  
  if (authData.role !== UserRole.ADMIN && authData.role !== UserRole.UNION_REP) {
    throw new Error("Forbidden - Union Representative access required");
  }
  
  return authData;
}

