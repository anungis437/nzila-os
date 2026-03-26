/**
 * Client-side RBAC Hooks
 * Union Claims Management System
 * 
 * React hooks for checking user roles and permissions on the client side.
 *
 * INV-04 NOTE: Server-side authorization is enforced by @nzila/os-core/policy
 * `authorize()`.  These client hooks exist only for UI gating — they do NOT
 * replace server-side checks.  All mutations and data access MUST call
 * `authorizeRoute()` or `withAuthorizedRoute()` from the policy adapter.
 */

"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { UserRole, Permission, hasPermission, hasAnyPermission, hasAllPermissions, canAccessRoute, getAccessibleNavItems } from "./roles";
import type { NavItem } from "./roles";

/**
 * Hook to get user role from the server
 */
export function useUserRole() {
  const { user, isLoaded } = useUser();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!isLoaded) return;
      
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Try to get role from Clerk metadata first (faster)
        const roleMap: Record<string, UserRole> = {
          // Current roles
          app_owner: UserRole.APP_OWNER,
          coo: UserRole.COO,
          cto: UserRole.CTO,
          platform_lead: UserRole.PLATFORM_LEAD,
          system_admin: UserRole.SYSTEM_ADMIN,
          admin: UserRole.ADMIN,
          president: UserRole.PRESIDENT,
          vice_president: UserRole.VICE_PRESIDENT,
          secretary_treasurer: UserRole.SECRETARY_TREASURER,
          chief_steward: UserRole.CHIEF_STEWARD,
          officer: UserRole.OFFICER,
          steward: UserRole.STEWARD,
          bargaining_committee: UserRole.BARGAINING_COMMITTEE,
          health_safety_rep: UserRole.HEALTH_SAFETY_REP,
          member: UserRole.MEMBER,
          national_officer: UserRole.NATIONAL_OFFICER,
          clc_executive: UserRole.CLC_EXECUTIVE,
          clc_staff: UserRole.CLC_STAFF,
          fed_executive: UserRole.FED_EXECUTIVE,
          fed_staff: UserRole.FED_STAFF,
          // Legacy aliases
          congress_staff: UserRole.CONGRESS_STAFF,
          federation_staff: UserRole.FEDERATION_STAFF,
          union_rep: UserRole.UNION_REP,
          staff_rep: UserRole.STAFF_REP,
          guest: UserRole.GUEST,
        };

        if (user.publicMetadata?.role) {
          const metadataRole = String(user.publicMetadata.role).toLowerCase();
          setRole(roleMap[metadataRole] ?? UserRole.MEMBER);
          setLoading(false);
          return;
        }

        // Try Clerk organization membership role (e.g. "org:steward" → "steward")
        const orgMembership = user.organizationMemberships?.[0];
        if (orgMembership?.role) {
          const orgRole = orgMembership.role.replace(/^org:/, '').toLowerCase();
          const mapped = roleMap[orgRole];
          if (mapped) {
            setRole(mapped);
            setLoading(false);
            return;
          }
        }

        // Fallback: fetch from API
        const response = await fetch("/api/auth/user-role");
        if (response.ok) {
          const data = await response.json();
          setRole(data.role as UserRole);
        } else {
          // Default to member if API fails
          setRole(UserRole.MEMBER);
        }
      } catch (_error) {
setRole(UserRole.MEMBER); // Default to member on error
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user, isLoaded]);

  return { role, loading, isLoaded };
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(permission: Permission): boolean {
  const { role } = useUserRole();
  if (!role) return false;
  return hasPermission(role, permission);
}

/**
 * Hook to check if user has any of the required permissions
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
  const { role } = useUserRole();
  if (!role) return false;
  return hasAnyPermission(role, permissions);
}

/**
 * Hook to check if user has all required permissions
 */
export function useHasAllPermissions(permissions: Permission[]): boolean {
  const { role } = useUserRole();
  if (!role) return false;
  return hasAllPermissions(role, permissions);
}

/**
 * Hook to check if user can access a route
 */
export function useCanAccessRoute(route: string): boolean {
  const { role } = useUserRole();
  if (!role) return false;
  return canAccessRoute(role, route);
}

/**
 * Hook to get accessible navigation items
 */
export function useAccessibleNavItems(adminMode: boolean = false): NavItem[] {
  const { role } = useUserRole();
  if (!role) return [];
  return getAccessibleNavItems(role, adminMode);
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin(): boolean {
  const { role } = useUserRole();
  return role === UserRole.ADMIN;
}

/**
 * Hook to check if user is union rep or higher
 */
export function useIsUnionRepOrHigher(): boolean {
  const { role } = useUserRole();
  return role === UserRole.ADMIN || role === UserRole.UNION_REP;
}

/**
 * Hook to check if user is staff rep or higher
 */
export function useIsStaffRepOrHigher(): boolean {
  const { role } = useUserRole();
  return role === UserRole.ADMIN || role === UserRole.CONGRESS_STAFF || role === UserRole.FEDERATION_STAFF || role === UserRole.UNION_REP || role === UserRole.STAFF_REP;
}

/**
 * Hook to check if user is congress staff
 */
export function useIsCongressStaff(): boolean {
  const { role } = useUserRole();
  return role === UserRole.CONGRESS_STAFF;
}

/**
 * Hook to check if user is federation staff
 */
export function useIsFederationStaff(): boolean {
  const { role } = useUserRole();
  return role === UserRole.FEDERATION_STAFF;
}

/**
 * Hook to check if user is congress or federation staff
 */
export function useIsCrossOrgStaff(): boolean {
  const { role } = useUserRole();
  return role === UserRole.CONGRESS_STAFF || role === UserRole.FEDERATION_STAFF;
}

/**
 * Hook to check if user has cross-organizational analytics access
 */
export function useHasCrossOrgAccess(): boolean {
  const { role } = useUserRole();
  return role === UserRole.ADMIN || role === UserRole.CONGRESS_STAFF || role === UserRole.FEDERATION_STAFF;
}

