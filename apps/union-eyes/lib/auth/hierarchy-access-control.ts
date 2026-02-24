/**
 * Hierarchy-Based Access Control
 * 
 * Implements organizational hierarchy validation for federation/congress sharing.
 * Ensures users can only access resources within their authorized hierarchy.
 * 
 * Security Context: This module operates at SYSTEM level (allowlisted in RLS scanner)
 * as it needs to validate access across organizational boundaries. All queries here
 * are for hierarchy validation only and do not access tenant-scoped data.
 * 
 * Security Model:
 * - Federation admins can access child union resources
 * - Union admins can access child local resources
 * - Local admins can only access their own resources
 * - Congress sharing requires explicit congress membership
 * 
 * Usage:
 * ```typescript
 * const access = await validateHierarchyAccess(userId, targetOrgId, 'read');
 * if (!access.allowed) {
 *   return NextResponse.json({ error: access.reason }, { status: 403 });
 * }
 * ```
 */

import { db } from '@/db';
import { organizations, organizationMembers, congressMemberships } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { InferSelectModel } from 'drizzle-orm';

export interface HierarchyAccessResult {
  allowed: boolean;
  reason?: string;
  accessType?: 'direct' | 'hierarchical' | 'congress' | 'public';
  userRole?: string;
  organizationLevel?: string;
}

export type ActionType = 'read' | 'write' | 'admin' | 'share';

type Organization = InferSelectModel<typeof organizations>;
type OrganizationMember = InferSelectModel<typeof organizationMembers>;

/** Membership with eager-loaded organization relation */
type MembershipWithOrg = OrganizationMember & { organization?: Organization };

/**
 * Validates if a user has access to a target organization based on hierarchy
 * Note: This function operates at SYSTEM context as it validates access across organizations
 */
export async function validateHierarchyAccess(
  userId: string,
  targetOrgId: string,
  action: ActionType = 'read'
): Promise<HierarchyAccessResult> {
  try {
    // Get target organization details
    const targetOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, targetOrgId),
    });

    if (!targetOrg) {
      return {
        allowed: false,
        reason: 'Organization not found',
      };
    }

    // Get user's organization memberships with organization details
    const userMemberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, userId),
      with: {
        organization: true,
      },
    }) as MembershipWithOrg[];

    if (userMemberships.length === 0) {
      return {
        allowed: false,
        reason: 'User has no organization memberships',
      };
    }

    // Check for direct membership
    const directMembership = userMemberships.find(
      m => m.organizationId === targetOrgId
    );

    if (directMembership) {
      const hasPermission = checkActionPermission(directMembership.role, action);
      if (hasPermission) {
        return {
          allowed: true,
          accessType: 'direct',
          userRole: directMembership.role,
          organizationLevel: targetOrg.organizationType,
        };
      }
    }

    // Check hierarchical access (parent org admins can access child orgs)
    for (const membership of userMemberships) {
      if (['admin', 'super_admin', 'owner'].includes(membership.role)) {
        // Check if user's org is in target org's hierarchy path
        if (targetOrg.hierarchyPath?.includes(membership.organizationId)) {
          // Validate action is allowed for hierarchical access
          if (action === 'read' || action === 'share') {
            return {
              allowed: true,
              accessType: 'hierarchical',
              userRole: membership.role,
              organizationLevel: membership.organization?.organizationType,
            };
          }
        }

        // Check if target org is in user's org hierarchy path (parent access)
        if (membership.organization?.hierarchyPath?.includes(targetOrgId)) {
          if (action === 'read') {
            return {
              allowed: true,
              accessType: 'hierarchical',
              userRole: membership.role,
              organizationLevel: membership.organization?.organizationType,
            };
          }
        }
      }
    }

    return {
      allowed: false,
      reason: 'User does not have hierarchical access to this organization',
    };
  } catch (error) {
    logger.error('Hierarchy access validation error', error as Error, { userId, targetOrgId });
    return {
      allowed: false,
      reason: 'Access validation failed',
    };
  }
}

/**
 * Validates if content can be shared at the specified level
 * Note: This function operates at SYSTEM context for hierarchy validation
 */
export async function validateSharingLevel(
  userId: string,
  sourceOrgId: string,
  sharingLevel: 'private' | 'federation' | 'congress' | 'public'
): Promise<{ allowed: boolean; reason?: string }> {
  if (sharingLevel === 'public') {
    return { allowed: true };
  }

  if (sharingLevel === 'private') {
    // Only direct org members can access
    return {
      allowed: true,
      reason: 'Private content requires direct membership (enforced at query time)',
    };
  }

  // Get user's organization hierarchy
  const userMemberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: {
      organization: true,
    },
  }) as MembershipWithOrg[];

  const userOrg = userMemberships.find((m) => m.organizationId === sourceOrgId)?.organization;
  if (!userOrg) {
    return {
      allowed: false,
      reason: 'User is not a member of the source organization',
    };
  }

  if (sharingLevel === 'federation') {
    // Requires parent organization to be a federation
    if (userOrg.organizationType === 'federation') {
      return { allowed: true };
    }

    // Or user's organization must be within a federation hierarchy
    const hasValidHierarchy = userOrg.hierarchyPath && userOrg.hierarchyPath.length > 0;
    if (!hasValidHierarchy) {
      return {
        allowed: false,
        reason: 'Federation sharing requires organization to be part of a federation hierarchy',
      };
    }

    return { allowed: true };
  }

  if (sharingLevel === 'congress') {
    // Congress sharing requires CLC affiliation
    const sourceOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, sourceOrgId),
      columns: { clcAffiliated: true, id: true },
    });

    if (!sourceOrg?.clcAffiliated) {
      return {
        allowed: false,
        reason: 'Congress sharing requires source organization to be CLC affiliated',
      };
    }

    // User's organization must also be CLC affiliated
    if (!userOrg.clcAffiliated) {
      return {
        allowed: false,
        reason: 'Congress sharing requires your organization to be CLC affiliated',
      };
    }

    const [userOrgMembershipValid, sourceOrgMembershipValid] = await Promise.all([
      validateCongressMembership(userId, userOrg.id),
      validateCongressMembership(userId, sourceOrgId),
    ]);

    if (!userOrgMembershipValid || !sourceOrgMembershipValid) {
      return {
        allowed: false,
        reason: 'Congress sharing requires active congress memberships for both organizations',
      };
    }

    logger.info('Congress sharing validated', {
      userId,
      sourceOrgId,
      userOrgId: userOrg.id,
      sharingLevel: 'congress',
    });

    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Invalid sharing level',
  };
}

/**
 * Gets all organizations accessible to a user based on hierarchy
 * Note: This function operates at SYSTEM context for hierarchy traversal
 */
export async function getAccessibleOrganizations(
  userId: string,
  action: ActionType = 'read'
): Promise<string[]> {
  try {
    // Get user's direct memberships
    const userMemberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, userId),
      with: {
        organization: true,
      },
    }) as MembershipWithOrg[];

    const accessibleOrgIds = new Set<string>();

    // Add direct memberships
    for (const membership of userMemberships) {
      if (checkActionPermission(membership.role, action)) {
        accessibleOrgIds.add(membership.organizationId);
      }

      // If user is admin in this org, add child organizations
      if (['admin', 'super_admin', 'owner'].includes(membership.role)) {
        const org = membership.organization;
        if (org && org.hierarchyPath) {
          // Get all child organizations
          const childOrgs = await db.query.organizations.findMany({
            where: or(
              ...org.hierarchyPath.map((parentId: string) =>
                eq(organizations.parentId, parentId)
              )
            ),
          });

          for (const childOrg of childOrgs) {
            if (action === 'read' || action === 'share') {
              accessibleOrgIds.add(childOrg.id);
            }
          }
        }
      }
    }

    return Array.from(accessibleOrgIds);
  } catch (error) {
    logger.error('Get accessible organizations error', error as Error, { userId });
    return [];
  }
}

/**
 * Check if a role has permission for an action
 */
function checkActionPermission(role: string, action: ActionType): boolean {
  const rolePermissions: Record<string, ActionType[]> = {
    super_admin: ['read', 'write', 'admin', 'share'],
    admin: ['read', 'write', 'admin', 'share'],
    owner: ['read', 'write', 'admin', 'share'],
    steward: ['read', 'write', 'share'],
    member: ['read'],
    guest: ['read'],
  };

  return rolePermissions[role]?.includes(action) ?? false;
}

/**
 * Validates congress membership (CLC federation membership validation)
 * 
 * Checks if an organization is an active member of a congress/federation.
 * This is used to validate cross-organizational sharing within a federation.
 * 
 * @param userId - The user requesting validation (for audit logging)
 * @param organizationId - The organization to check membership for
 * @returns Promise<boolean> - True if the organization has active congress membership
 */
export async function validateCongressMembership(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Query congress_memberships table for active membership
    const memberships = await db
      .select()
      .from(congressMemberships)
      .where(
        and(
          eq(congressMemberships.organizationId, organizationId),
          eq(congressMemberships.status, 'active')
        )
      )
      .limit(1);

    const hasActiveMembership = memberships.length > 0;

    if (hasActiveMembership) {
      logger.info('Congress membership validated', {
        userId,
        organizationId,
        membershipId: memberships[0].id,
        congressId: memberships[0].congressId,
      });
    } else {
      logger.debug('No active congress membership found', {
        userId,
        organizationId,
      });
    }

    return hasActiveMembership;
  } catch (error) {
    logger.error('Congress membership validation error', error as Error, {
      userId,
      organizationId,
    });
    return false;
  }
}

