/**
 * Role-Based Authorization Middleware
 * 
 * Extends organization middleware with role-based access control.
 * Validates user roles and permissions within organization context.
 */

import { NextRequest, NextResponse } from "next/server";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { getMemberByUserId } from "@/db/queries/organization-members-queries";
import { logger } from '@/lib/logger';
import { UserRole, getRoleLevel } from "@/lib/auth/roles";

/**
 * Super-admin organization ID — the platform-level org whose admins
 * get cross-org access.  Set via SUPER_ADMIN_ORG_ID env var.
 */
const SUPER_ADMIN_ORG_ID = (() => {
  const id = process.env.SUPER_ADMIN_ORG_ID;
  if (!id) {
    logger.warn(
      '[role-middleware] SUPER_ADMIN_ORG_ID is not set. Super-admin cross-org access will be disabled.',
    );
  }
  return id ?? null;
})();

/**
 * MemberRole includes all UserRole values plus "super_admin" for cross-org
 * platform access.  Previously this was a simplified 5-value union; it now
 * covers every role defined in the RBAC system so that fine-grained roles
 * (e.g. health_safety_rep, bargaining_committee) are not collapsed.
 */
export type MemberRole = UserRole | "super_admin";

export interface RoleContext {
  organizationId: string;
  userId: string;
  role: MemberRole;
  memberId: string;
}

/**
 * Resolve the numeric privilege level for any MemberRole.
 * Delegates to the canonical getRoleLevel() from roles.ts;
 * "super_admin" is treated as the highest possible level.
 */
function getLevel(role: MemberRole): number {
  if (role === "super_admin") return 999;
  return getRoleLevel(role as UserRole);
}

/**
 * Check if a role has permission to access a resource
 */
export function hasRolePermission(
  userRole: MemberRole,
  requiredRole: MemberRole
): boolean {
  return getLevel(userRole) >= getLevel(requiredRole);
}

/**
 * Middleware to enforce role-based authorization
 * 
 * Usage in API routes:
 * ```typescript
 * import { withRoleAuth } from "@/lib/role-middleware";
 * 
 * // Require at least steward role
 * export const POST = withRoleAuth("steward", async (request, context) => {
 *   const { organizationId, userId, role, memberId } = context;
 *   // Your role-protected logic here
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRoleAuth<T = any>(
  requiredRole: MemberRole,
  handler: (
    request: NextRequest,
    context: RoleContext,
    params?: T
  ) => Promise<NextResponse> | NextResponse
) {
  return withOrganizationAuth<T>(async (request, orgContext, params) => {
    try {
      const { organizationId, userId } = orgContext;

      // Get user's member record to check role
      const member = await getMemberByUserId(organizationId, userId);

      // Check for super admin access (admin or super_admin in platform org)
      if (!member) {
        if (SUPER_ADMIN_ORG_ID) {
          const superAdminMember = await getMemberByUserId(SUPER_ADMIN_ORG_ID, userId);
          const superAdminRole = superAdminMember?.role as MemberRole | undefined;

          if (superAdminMember && (superAdminRole === 'admin' || superAdminRole === 'super_admin')) {
            const roleContext: RoleContext = {
              organizationId,
              userId,
              role: superAdminRole,
              memberId: superAdminMember.id,
            };
            return await handler(request, roleContext, params);
          }
        }

        return NextResponse.json(
          { 
            success: false, 
            error: "Forbidden - User is not a member of this organization" 
          },
          { status: 403 }
        );
      }

      // Check if user has required role
      if (!hasRolePermission(member.role as MemberRole, requiredRole)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Forbidden - ${requiredRole} role or higher required. Your role: ${member.role}` 
          },
          { status: 403 }
        );
      }

      // Create role context
      const roleContext: RoleContext = {
        organizationId,
        userId,
        role: member.role as MemberRole,
        memberId: member.id,
      };

      // Call the handler with role context
      return await handler(request, roleContext, params);
    } catch (_error) {
return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

/**
 * Middleware variant that allows multiple roles
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAnyRole<T = any>(
  allowedRoles: MemberRole[],
  handler: (
    request: NextRequest,
    context: RoleContext,
    params?: T
  ) => Promise<NextResponse> | NextResponse
) {
  return withOrganizationAuth<T>(async (request, orgContext, params) => {
    try {
      const { organizationId, userId } = orgContext;

      // Get user's member record to check role
      const member = await getMemberByUserId(organizationId, userId);

      // Check for super admin access (admin or super_admin in platform org)
      if (!member) {
        if (SUPER_ADMIN_ORG_ID) {
          const superAdminMember = await getMemberByUserId(SUPER_ADMIN_ORG_ID, userId);
          const superAdminRole = superAdminMember?.role as MemberRole | undefined;

          if (superAdminMember && (superAdminRole === 'admin' || superAdminRole === 'super_admin')) {
            const roleContext: RoleContext = {
              organizationId,
              userId,
              role: superAdminRole,
              memberId: superAdminMember.id,
            };
            return await handler(request, roleContext, params);
          }
        }

        return NextResponse.json(
          { 
            success: false, 
            error: "Forbidden - User is not a member of this organization" 
          },
          { status: 403 }
        );
      }

      // Check if user has any of the allowed roles
      const userRole = member.role as MemberRole;
      const hasAccess = allowedRoles.some(role => 
        hasRolePermission(userRole, role)
      );

      if (!hasAccess) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Forbidden - One of these roles required: ${allowedRoles.join(", ")}. Your role: ${userRole}` 
          },
          { status: 403 }
        );
      }

      // Create role context
      const roleContext: RoleContext = {
        organizationId,
        userId,
        role: userRole,
        memberId: member.id,
      };

      // Call the handler with role context
      return await handler(request, roleContext, params);
    } catch (_error) {
return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}

/**
 * Helper to check if user has a specific role (for use inside handlers)
 */
export function checkRole(context: RoleContext, requiredRole: MemberRole): boolean {
  return hasRolePermission(context.role, requiredRole);
}

/**
 * Helper to ensure admin role (for use inside handlers)
 */
export function requireAdmin(context: RoleContext): void {
  if (context.role !== "admin") {
    throw new Error("Admin role required");
  }
}

