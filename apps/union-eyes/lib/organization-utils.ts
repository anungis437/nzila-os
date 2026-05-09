/**
 * Organization Utilities
 * 
 * Helper functions for organization management and resolution.
 * Supports hierarchical multi-tenancy with organizations.
 */

import { db } from "@/db/db";
import { organizations, organizationMembers } from "@/db/schema-organizations";
import { eq, and } from "drizzle-orm";
import { authOrganizationUsers } from '@nzila/db/schema'
import { cookies } from "next/headers";
import { logger } from "./logger";
/**
 * Default organization ID used for system operations
 * This points to the Default Organization where all users start
 */
export const DEFAULT_ORGANIZATION_ID = "458a56cb-251a-4c91-a0b5-81bb8ac39087"; // Default Organization

/**
 * Get the organization ID for a given user ID.
 * 
 * Priority order:
 * 1. Selected organization from cookie
 * 2. User's primary organization
 * 3. User's first available organization
 * 4. Default organization (fallback)
 * 
 * @param userId - The Clerk user ID (from auth())
 * @returns The organization ID UUID string
 * @throws Error if no organization found
 */
export async function getOrganizationIdForUser(userId: string): Promise<string> {
  try {
    // Check if user selected a specific organization UUID via cookie.
    // This is the primary selector written by the client org switcher.
    const cookieStore = await cookies();
    const selectedOrgId =
      cookieStore.get("selected_org_id")?.value ||
      cookieStore.get("selected_organization_id")?.value;

    if (selectedOrgId) {
      const orgById = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, selectedOrgId))
        .limit(1);

      if (orgById.length > 0) {
        const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
          .split(',').map(s => s.trim()).filter(Boolean);
        if (platformAdminIds.includes(userId)) {
          return orgById[0].id;
        }

        const isSuperAdmin = await db
          .select({ role: organizationMembers.role })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId),
              eq(organizationMembers.organizationId, DEFAULT_ORGANIZATION_ID)
            )
          )
          .limit(1);

        const hasAdminAccess = isSuperAdmin.length > 0 &&
          ['admin', 'super_admin', 'app_owner'].includes(isSuperAdmin[0].role);

        if (hasAdminAccess) {
          return orgById[0].id;
        }

        const userOrg = await db
          .select({ organizationId: organizationMembers.organizationId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId),
              eq(organizationMembers.organizationId, orgById[0].id)
            )
          )
          .limit(1);

        if (userOrg.length > 0) {
          return orgById[0].id;
        }

        const authUserOrg = await db
          .select({ organizationId: authOrganizationUsers.organizationId })
          .from(authOrganizationUsers)
          .where(
            and(
              eq(authOrganizationUsers.userId, userId),
              eq(authOrganizationUsers.organizationId, orgById[0].id),
              eq(authOrganizationUsers.isActive, true),
            )
          )
          .limit(1)

        if (authUserOrg.length > 0) {
          return orgById[0].id
        }
      }
    }

    // Secondary selector: slug-based cookie.
    const selectedOrgSlug = cookieStore.get("active-organization")?.value;
    
    if (selectedOrgSlug) {
      // Look up organization by slug to get UUID
      const org = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, selectedOrgSlug))
        .limit(1);
      
      if (org.length > 0) {
        // Platform admin user IDs have unrestricted org access
        const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
          .split(',').map(s => s.trim()).filter(Boolean);
        if (platformAdminIds.includes(userId)) {
          return org[0].id;
        }

        // Check if user is a super admin (has admin role in default org)
        const isSuperAdmin = await db
          .select({ role: organizationMembers.role })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId),
              eq(organizationMembers.organizationId, DEFAULT_ORGANIZATION_ID)
            )
          )
          .limit(1);
        
        const hasAdminAccess = isSuperAdmin.length > 0 && 
          ['admin', 'super_admin', 'app_owner'].includes(isSuperAdmin[0].role);
        
        // If super admin, grant access to all organizations
        if (hasAdminAccess) {
          return org[0].id;
        }
        
        // Otherwise, verify user has explicit membership in this organization
        const userOrg = await db
          .select({ organizationId: organizationMembers.organizationId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId),
              eq(organizationMembers.organizationId, org[0].id)
            )
          )
          .limit(1);
        
        if (userOrg.length > 0) {
          return org[0].id;
        }

        const authUserOrg = await db
          .select({ organizationId: authOrganizationUsers.organizationId })
          .from(authOrganizationUsers)
          .where(
            and(
              eq(authOrganizationUsers.userId, userId),
              eq(authOrganizationUsers.organizationId, org[0].id),
              eq(authOrganizationUsers.isActive, true),
            )
          )
          .limit(1)

        if (authUserOrg.length > 0 && authUserOrg[0].organizationId) {
          return authUserOrg[0].organizationId
        }
      }
    }
    
    // No explicit org selection: prefer platform auth primary membership.
    // This keeps organization context aligned with centralized auth state and
    // avoids default local org rows masking true tenant membership.
    const authPrimaryOrg = await db
      .select({ organizationId: authOrganizationUsers.organizationId })
      .from(authOrganizationUsers)
      .where(
        and(
          eq(authOrganizationUsers.userId, userId),
          eq(authOrganizationUsers.isActive, true),
          eq(authOrganizationUsers.isPrimary, true),
        )
      )
      .limit(1)

    if (authPrimaryOrg.length > 0 && authPrimaryOrg[0].organizationId) {
      return authPrimaryOrg[0].organizationId
    }

    // Fallback to any active platform auth membership.
    const authUserOrgs = await db
      .select({ organizationId: authOrganizationUsers.organizationId })
      .from(authOrganizationUsers)
      .where(
        and(
          eq(authOrganizationUsers.userId, userId),
          eq(authOrganizationUsers.isActive, true),
        )
      )
      .limit(1)

    if (authUserOrgs.length > 0 && authUserOrgs[0].organizationId) {
      return authUserOrgs[0].organizationId
    }

    // Legacy fallback: local organization membership.
    const userOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    
    if (userOrgs.length > 0 && userOrgs[0].organizationId) {
      return userOrgs[0].organizationId;
    }
    
    // Final fallback to default organization
    const organizationId = DEFAULT_ORGANIZATION_ID;
    
    // Validate that organization exists
    const org = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    
    if (org.length === 0) {
      throw new Error(`Organization ${organizationId} not found. Run database migrations to seed organizations.`);
    }
    
    return organizationId;
  } catch (error) {
    logger.error('Error resolving organization for user', error);
    throw error;
  }
}

/**
 * Get the default organization ID.
 * 
 * Use this function when you need an organization ID but don&apos;t have a user context,
 * such as in background jobs or system operations.
 * 
 * @returns The default organization ID
 */
export function getDefaultOrganizationId(): string {
  return DEFAULT_ORGANIZATION_ID;
}

/**
 * Validate that an organization exists in the database.
 * 
 * @param organizationId - The organization ID to validate
 * @returns True if the organization exists, false otherwise
 */
export async function validateOrganizationExists(organizationId: string): Promise<boolean> {
  try {
    const result = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    logger.error('Error validating organization exists', error);
    return false;
  }
}

/**
 * Get basic organization information.
 * 
 * @param organizationId - The organization ID
 * @returns Organization info or null if not found
 */
export async function getOrganizationInfo(organizationId: string) {
  try {
    const result = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        type: organizations.organizationType,
        parentId: organizations.parentId,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    logger.error('Error fetching organization info', error);
    return null;
  }
}

/**
 * Check if a user has access to a specific organization.
 * 
 * @param userId - The Clerk user ID
 * @param organizationId - The organization ID to check
 * @returns True if the user has access, false otherwise
 */
export async function userHasOrganizationAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const result = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    logger.error('Error checking organization access', error);
    return false;
  }
}

/**
 * Get user's role in an organization from organizationMembers table
 * 
 * @param userId - The Clerk user ID
 * @param organizationId - The organization ID
 * @returns The user's role or null if not found
 */
/** All recognised sidebar roles — keep in sync with SidebarProps */
export type AppRole =
  // Base Membership
  | "member"
  // Front-line Representatives
  | "steward" | "bargaining_committee"
  // Specialized Representatives
  | "health_safety_rep"
  // Senior Representatives
  | "chief_steward" | "officer"
  // Local Union Executives
  | "president" | "vice_president" | "secretary_treasurer" | "admin"
  // Union National Level
  | "national_officer"
  // System Administration
  | "system_admin"
  // Federation Level
  | "fed_staff" | "fed_executive"
  // CLC National Level
  | "clc_staff" | "clc_executive"
  // Legacy (backward compatibility)
  | "congress_staff" | "federation_staff"
  // App Operations (Nzila platform)
  | "app_owner" | "coo" | "cto" | "platform_lead"
  | "customer_success_director" | "support_manager"
  | "data_analytics_manager" | "billing_manager"
  | "support_agent" | "data_analyst" | "billing_specialist";

export async function getUserRoleInOrganization(
  userId: string,
  organizationId: string
): Promise<AppRole | null> {
  try {
    const result = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    // Map database roles to UI roles
    const dbRole = result[0].role;
    const roleMap: Record<string, AppRole> = {
      // Union membership roles
      'member': 'member',
      'steward': 'steward',
      'union_steward': 'steward',
      'chief_steward': 'chief_steward',
      'bargaining_committee': 'bargaining_committee',
      'health_safety_rep': 'health_safety_rep',
      'officer': 'officer',
      'union_officer': 'officer',
      'president': 'president',
      'vice_president': 'vice_president',
      'secretary_treasurer': 'secretary_treasurer',
      'national_officer': 'national_officer',
      'admin': 'admin',
      'super_admin': 'admin',
      'system_admin': 'system_admin',
      // Federation / CLC
      'congress_staff': 'congress_staff',
      'federation_staff': 'federation_staff',
      'fed_staff': 'fed_staff',
      'fed_executive': 'fed_executive',
      'clc_staff': 'clc_staff',
      'clc_executive': 'clc_executive',
      // Nzila platform ops
      'app_owner': 'app_owner',
      'coo': 'coo',
      'cto': 'cto',
      'platform_lead': 'platform_lead',
      'customer_success_director': 'customer_success_director',
      'support_manager': 'support_manager',
      'data_analytics_manager': 'data_analytics_manager',
      'billing_manager': 'billing_manager',
      'support_agent': 'support_agent',
      'data_analyst': 'data_analyst',
      'billing_specialist': 'billing_specialist',
    };
    
    return roleMap[dbRole] || 'member';
  } catch (error) {
    logger.error('Error fetching user role', error);
    return null;
  }
}

