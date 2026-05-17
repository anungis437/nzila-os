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
import { isSuperAdmin } from '@nzila/os-core/config/super-admins'
import { db } from "@/db/db";
import { organizationMembers } from "@/db/schema-organizations";
import { authOrganizationUsers } from '@nzila/db/schema';
import { eq, and } from "drizzle-orm";
import { UserRole, Permission, hasPermission, hasAnyPermission, hasAllPermissions, canAccessRoute } from "./roles";
import { createLogger } from '@nzila/os-core'

const logger = createLogger('rbac-server')

// ── Build a reverse-lookup from enum string values → UserRole ─────────────
const USER_ROLE_VALUES = new Set(Object.values(UserRole) as string[]);

function resolveUserRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (USER_ROLE_VALUES.has(key)) return key as UserRole;
  // Legacy + cross-app aliases
  const aliases: Record<string, UserRole> = {
    // Legacy union names
    'super_admin': UserRole.ADMIN,
    'union_steward': UserRole.STEWARD,
    'union_officer': UserRole.OFFICER,
    // Common shortcuts
    'owner': UserRole.APP_OWNER,
    'admin_owner': UserRole.APP_OWNER,
    // Nzila platform role stored in publicMetadata.role
    'platform_admin': UserRole.APP_OWNER,
    // system_admin is already in UserRole, but keep alias in case stored differently
    'sysadmin': UserRole.SYSTEM_ADMIN,
  };
  return aliases[key] ?? null;
}

/**
 * Map Nzila platform roles (used by the console / CFO apps via
 * publicMetadata.nzilaRole) to the union-eyes UserRole equivalents.
 * Returns null for viewer / non-elevated roles so they don't bypass the
 * default member resolution.
 */
function resolveNzilaRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null;
  const map: Record<string, UserRole> = {
    'platform_admin': UserRole.APP_OWNER,
    'studio_admin': UserRole.CTO,
    'ops': UserRole.PLATFORM_LEAD,
    'analyst': UserRole.DATA_ANALYST,
  };
  return map[raw.toLowerCase()] ?? null;
}

/**
 * Map platform auth organization roles to UnionEyes app roles.
 * These are roles stored in user_management.organization_users.role
 * and need to be normalized to UserRole equivalents.
 */
function resolvePlatformOrgRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  
  // Direct matches - platform roles that have equivalent app roles
  const directMap: Record<string, UserRole> = {
    'admin': UserRole.ADMIN,
    'system_admin': UserRole.SYSTEM_ADMIN,
    'app_owner': UserRole.APP_OWNER,
    'platform_lead': UserRole.PLATFORM_LEAD,
    'steward': UserRole.STEWARD,
    'chief_steward': UserRole.CHIEF_STEWARD,
    'member': UserRole.MEMBER,
    'officer': UserRole.OFFICER,
    'clerk': UserRole.CLERK,
    'president': UserRole.PRESIDENT,
    'vice_president': UserRole.VICE_PRESIDENT,
    'secretary_treasurer': UserRole.SECRETARY_TREASURER,
    'bargaining_committee': UserRole.BARGAINING_COMMITTEE,
    'health_safety_rep': UserRole.HEALTH_SAFETY_REP,
  };
  
  if (directMap[key]) return directMap[key];
  
  // Executive roles
  if (key === 'executive' || key === 'ceo') return UserRole.PRESIDENT;
  
  // Governance roles
  if (key === 'compliance_manager') return UserRole.COMPLIANCE_MANAGER;
  if (key === 'auditor' || key === 'auditor_readonly') return UserRole.COMPLIANCE_MANAGER;
  if (key === 'governance') return UserRole.OFFICER; // governance role -> officer (governance rep)
  
  // Staff roles
  if (key === 'support_agent') return UserRole.SUPPORT_AGENT;
  if (key === 'staff' || key === 'support_staff') return UserRole.SUPPORT_AGENT;
  
  // Default to null (not resolved)
  return null;
}

/**
 * Get user role from database.
 *
 * Resolution order (PRIORITIZES SELECTED ORGANIZATION):
 *   1. Platform auth `user_management.organization_users` (selected org only)
 *   2. Local `organization_members` (org-scoped, fallback if no auth record)
 *   3. `publicMetadata.role` / `publicMetadata.nzilaRole`
 *   4. Default to MEMBER
 *
 * IMPORTANT: When organizationId is provided, we prioritize platform auth
 * to ensure selected-org roles take precedence over default-org roles.
 * This prevents local organization_members default-org rows from overriding
 * correct platform roles in the selected organization.
 */
export async function getUserRole(
  userId: string,
  organizationId?: string | null,
): Promise<UserRole> {
  try {
    // DEV ONLY: DEV_ROLE_OVERRIDE forces any role for local testing.
    //   Set DEV_ROLE_OVERRIDE=steward in .env.local to simulate that role.
    //   Ignored in production (NODE_ENV !== 'development').
    if (process.env.NODE_ENV === 'development' && process.env.DEV_ROLE_OVERRIDE) {
      const override = process.env.DEV_ROLE_OVERRIDE as UserRole;
      if (Object.values(UserRole).includes(override)) {
        logger.info('[getUserRole] DEV_ROLE_OVERRIDE active', { detail: override });
        return override;
      }
    }

    // 0. PLATFORM_ADMIN_USER_IDS — explicit override, highest priority.
    //    Set PLATFORM_ADMIN_USER_IDS=user_abc,user_xyz in .env.local to
    //    grant app_owner rights regardless of DB or metadata state.
    const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (platformAdminIds.includes(userId)) {
      logger.info('[getUserRole] Granting app_owner via PLATFORM_ADMIN_USER_IDS', { detail: userId });
      return UserRole.APP_OWNER;
    }

    // 0b. SUPER_ADMIN_EMAILS — email-based override.
    try {
      const user = await currentUser();
      const email = (user as { primaryEmailAddress?: { emailAddress?: string }; emailAddresses?: { emailAddress?: string }[] })?.primaryEmailAddress?.emailAddress
                  ?? (user as { emailAddresses?: { emailAddress?: string }[] })?.emailAddresses?.[0]?.emailAddress;
      if (isSuperAdmin(email)) {
        logger.info('[getUserRole] Granting app_owner via SUPER_ADMIN_EMAILS', { detail: email });
        return UserRole.APP_OWNER;
      }
    } catch (emailCheckError) {
      logger.warn('[getUserRole] Super-admin email check failed, falling through', { detail: emailCheckError instanceof Error ? emailCheckError.message : emailCheckError });
    }

    // 1. PRIORITY: Check platform auth table FIRST when organizationId is specified.
    //    This ensures selected-org roles take precedence over default-org roles.
    //    Test users (and any users in alternate orgs) will have their roles here.
    if (organizationId) {
      const authOrgUser = await db
        .select({ role: authOrganizationUsers.role })
        .from(authOrganizationUsers)
        .where(
          and(
            eq(authOrganizationUsers.userId, userId),
            eq(authOrganizationUsers.organizationId, organizationId),
            eq(authOrganizationUsers.isActive, true),
          ),
        )
        .limit(1);

        const rawRole = authOrgUser[0]?.role;
        const fromAuthOrgUsers = resolvePlatformOrgRole(rawRole) 
                               ?? resolveUserRole(rawRole);
        if (fromAuthOrgUsers) {
          logger.info('[getUserRole] Found role via platform auth', { 
            userId, organizationId, rawRole, resolved: fromAuthOrgUsers 
          });
          return fromAuthOrgUsers;
        }
    }

    // 2. Fallback: Check local organization_members (only if auth lookup returned nothing)
    //    This is the legacy/canonical RBAC source for production orgs.
    if (organizationId) {
      const resolvedOrgId = organizationId;

      const orgMember = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, resolvedOrgId),
            eq(organizationMembers.status, 'active'),
          ),
        )
        .limit(1);

      const fromOrgMembers = resolveUserRole(orgMember[0]?.role);
      if (fromOrgMembers) {
        logger.debug('[getUserRole] Found role via local organization_members', { 
          detail: { userId, organizationId, role: orgMember[0]?.role, resolved: fromOrgMembers } 
        });
        return fromOrgMembers;
      }
    }

    // 2. Fallback to publicMetadata
    const user = await currentUser();

    // 3a. publicMetadata.role (union-eyes native key)
    const fromClerk = resolveUserRole(
      user?.publicMetadata?.role as string | undefined,
    );
    if (fromClerk) return fromClerk;

    // 3b. publicMetadata.nzilaRole (used by the rest of the Nzila platform —
    //     console, CFO, partners apps all write to this key)
    const fromNzilaRole = resolveNzilaRole(
      user?.publicMetadata?.nzilaRole as string | undefined,
    );
    if (fromNzilaRole) return fromNzilaRole;

    // 4. Default role
    return UserRole.MEMBER;
  } catch (error) {
    // SECURITY FIX: Fail closed — authorization errors must not grant access
    logger.error('[getUserRole] FATAL:', error instanceof Error ? error : { detail: error });
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


