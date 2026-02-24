/**
 * Role-Based Authorization Middleware
 * 
 * Extends organization middleware with role-based access control.
 * Validates user roles and permissions within organization context.
 */

import { NextRequest, NextResponse } from "next/server";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { getMemberByUserId } from "@/db/queries/organization-members-queries";

export type MemberRole = "member" | "steward" | "officer" | "admin" | "super_admin";

export interface RoleContext {
  organizationId: string;
  userId: string;
  role: MemberRole;
  memberId: string;
}

/**
 * Role hierarchy levels (higher = more permissions)
 */
const ROLE_HIERARCHY: Record<MemberRole, number> = {
  super_admin: 5,
  admin: 4,
  officer: 3,
  steward: 2,
  member: 1,
};

/**
 * Check if a role has permission to access a resource
 */
export function hasRolePermission(
  userRole: MemberRole,
  requiredRole: MemberRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
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

      // Check for super admin access (admin or super_admin in default org)
      if (!member) {
        const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
        const superAdminMember = await getMemberByUserId(DEFAULT_ORG_ID, userId);
        const superAdminRole = superAdminMember?.role as MemberRole | undefined;
        
        if (superAdminMember && (superAdminRole === 'admin' || superAdminRole === 'super_admin')) {
          // Grant admin access to super admins
          const roleContext: RoleContext = {
            organizationId,
            userId,
            role: superAdminRole,
            memberId: superAdminMember.id,
          };
          return await handler(request, roleContext, params);
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

      // Check for super admin access (admin or super_admin in default org)
      if (!member) {
        const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
        const superAdminMember = await getMemberByUserId(DEFAULT_ORG_ID, userId);
        const superAdminRole = superAdminMember?.role as MemberRole | undefined;
        
        if (superAdminMember && (superAdminRole === 'admin' || superAdminRole === 'super_admin')) {
          // Grant admin access to super admins
          const roleContext: RoleContext = {
            organizationId,
            userId,
            role: superAdminRole,
            memberId: superAdminMember.id,
          };
          return await handler(request, roleContext, params);
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

