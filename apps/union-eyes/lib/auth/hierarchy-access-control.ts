/**
 * Organization access decisions: DIRECT ONLY.
 *
 * Security Context: This module operates at SYSTEM level (allowlisted in RLS scanner)
 * because it reads memberships across organizations to reach its decisions. It reads
 * membership and organization rows only, never org-scoped content.
 *
 * Security Model (#1116, owner ruling: explicit, scoped grants only):
 * - The organization hierarchy is an affiliation graph, not an access-control list.
 *   A parent, federation or congress administrator gains nothing in a child, and a
 *   child's administrator gains nothing in an ancestor or a sibling.
 * - Access to an organization requires the caller's own LIVE membership of exactly that
 *   organization (status 'active', not soft-deleted) with a role that permits the action,
 *   and the organization itself must be active.
 * - Federation and congress sharing are cross-organization grants. No ratified,
 *   grant-backed sharing instrument exists, so they are denied by default.
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
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { InferSelectModel } from 'drizzle-orm';

export interface HierarchyAccessResult {
  allowed: boolean;
  reason?: string;
  /** Only 'direct' is ever granted. The other values are retained for type compatibility and are never produced. */
  accessType?: 'direct' | 'hierarchical' | 'congress' | 'public';
  userRole?: string;
  organizationLevel?: string;
}

export type ActionType = 'read' | 'write' | 'admin' | 'share';

type Organization = InferSelectModel<typeof organizations>;
type OrganizationMember = InferSelectModel<typeof organizationMembers>;

/** Membership with eager-loaded organization relation */
type MembershipWithOrg = OrganizationMember & { organization?: Organization };

const CROSS_ORGANIZATION_DENIAL =
  'Cross-organization access requires a ratified, explicitly granted sharing instrument; none exists, so it is denied';

/** The organization is live: an archived, suspended or otherwise inactive organization confers nothing. */
const isActiveOrganization = (org: Pick<Organization, 'status'> | null | undefined) =>
  !!org && (org.status ?? 'active') === 'active';

/**
 * The caller's LIVE memberships (status 'active', not soft-deleted), optionally of one organization only.
 * A suspended, inactive, removed or soft-deleted membership is not a membership here.
 */
async function liveMemberships(userId: string, organizationId?: string): Promise<MembershipWithOrg[]> {
  const conditions = [
    eq(organizationMembers.userId, userId),
    eq(organizationMembers.status, 'active'),
    isNull(organizationMembers.deletedAt),
  ];
  if (organizationId) conditions.push(eq(organizationMembers.organizationId, organizationId));
  return (await db.query.organizationMembers.findMany({
    where: and(...conditions),
    with: {
      organization: true,
    },
  })) as MembershipWithOrg[];
}

/**
 * Validates if a user has access to a target organization.
 * Only the caller's own live membership of exactly that organization counts; hierarchy grants nothing.
 * Note: This function operates at SYSTEM context as it reads memberships across organizations.
 */
export async function validateHierarchyAccess(
  userId: string,
  targetOrgId: string,
  action: ActionType = 'read'
): Promise<HierarchyAccessResult> {
  try {
    const targetOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, targetOrgId),
    });

    // An organization that is not active reads as not found, so the answer does not disclose its lifecycle.
    if (!targetOrg || !isActiveOrganization(targetOrg)) {
      return {
        allowed: false,
        reason: 'Organization not found',
      };
    }

    const [directMembership] = await liveMemberships(userId, targetOrgId);

    if (!directMembership || directMembership.organizationId !== targetOrgId) {
      return {
        allowed: false,
        reason: 'User has no live membership of this organization',
      };
    }

    if (!checkActionPermission(directMembership.role, action)) {
      return {
        allowed: false,
        reason: 'User role does not permit this action',
        userRole: directMembership.role,
      };
    }

    return {
      allowed: true,
      accessType: 'direct',
      userRole: directMembership.role,
      organizationLevel: targetOrg.organizationType,
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
 * Validates if content can be shared at the specified level.
 * Federation and congress sharing are cross-organization grants and are denied by default (#1116).
 * Note: This function operates at SYSTEM context.
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

  if (sharingLevel === 'federation' || sharingLevel === 'congress') {
    logger.info('Cross-organization sharing denied by default', { userId, sourceOrgId, sharingLevel });
    return { allowed: false, reason: CROSS_ORGANIZATION_DENIAL };
  }

  return {
    allowed: false,
    reason: 'Invalid sharing level',
  };
}

/**
 * Gets the organizations a user may act on: exactly the active organizations of their own live memberships whose role
 * permits the action. Child, parent and sibling organizations are never added.
 * Note: This function operates at SYSTEM context.
 */
export async function getAccessibleOrganizations(
  userId: string,
  action: ActionType = 'read'
): Promise<string[]> {
  try {
    const accessibleOrgIds = new Set<string>();
    for (const membership of await liveMemberships(userId)) {
      if (!checkActionPermission(membership.role, action)) continue;
      // The membership's organization must itself be live; an absent relation fails closed.
      if (!isActiveOrganization(membership.organization)) continue;
      accessibleOrgIds.add(membership.organizationId);
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

