/**
 * GET /api/users/me/organizations
 *
 * Returns the authenticated user's organizations and memberships.
 * Queries Drizzle/PostgreSQL directly (replaces Django proxy).
 *
 * V2 uses active private memberships, including for platform administrators.
 * Legacy PLATFORM_ADMIN_USER_IDS can still enumerate all organizations when V2 is off.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core'
import { isPlatformAdminUser } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { organizationWire } from '@/lib/organizations/organization-wire';

const logger = createLogger('users:me:organizations')

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    if (currentStateContextEnabled()) {
      const { getCanonicalOrganizationChoices, canonicalOrganizationError } =
        await import('@/lib/auth/canonical-organization-selection')
      try {
        return NextResponse.json(await getCanonicalOrganizationChoices())
      } catch (error) {
        return canonicalOrganizationError(error, 'load')
      }
    }
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[/api/users/me/organizations] Request started', { userId });

    const isAdmin = await isPlatformAdminUser(userId);

    // A person's memberships span organizations, which no single-organization transaction can show, so they are read by the system role,
    // as the organization read authority does (lib/organizations/read-authority.ts). Only an active, non-removed membership is the caller's:
    // a suspended or removed member is not offered an organization they can no longer switch into.
    const { memberships, orgs } = await withSystemContext(async (tx) => {
      const ownMemberships = await tx
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'active'),
          isNull(organizationMembers.deletedAt),
        ));

      // A membership is never linked to the caller here. An e-mail address is not proof of identity (the provider can
      // return an unverified one, and a roster row may carry any address), so matching on it used to rebind every
      // membership of that address, in any organization, and every membership of another user id, to the caller.
      // A membership is bound to an identity by accepting an invitation or by the canonical onboarding flow.

      logger.info('[/api/users/me/organizations] Membership resolution complete', {
        userId,
        membershipCount: ownMemberships.length,
      });

      if (isAdmin) {
        // Platform admins can see ALL organizations
        const allOrgs = await tx.select().from(organizations).limit(500);
        logger.info('[/api/users/me/organizations] Platform admin — returning all orgs', {
          userId,
          count: allOrgs.length,
        });
        return { memberships: ownMemberships, orgs: allOrgs };
      }

      // Regular users only see the active organizations they are members of
      const orgIds = [...new Set(ownMemberships.map(m => m.organizationId))];
      const memberOrgs = orgIds.length > 0
        ? await tx.select().from(organizations).where(inArray(organizations.id, orgIds))
        : [];
      const activeOrgs = memberOrgs.filter(o => (o.status ?? 'active') === 'active');
      const activeIds = new Set(activeOrgs.map(o => o.id));

      logger.info('[/api/users/me/organizations] Non-admin org resolution complete', {
        userId,
        membershipCount: ownMemberships.length,
        orgCount: activeOrgs.length,
      });
      return { memberships: ownMemberships.filter(m => activeIds.has(m.organizationId)), orgs: activeOrgs };
    });

    return NextResponse.json({
      organizations: orgs.map(organizationWire),
      memberships: memberships.map(m => ({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role,
        isPrimary: m.isPrimary ?? false,
        joinedAt: m.joinedAt?.toISOString() ?? m.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    logger.error('[/api/users/me/organizations] Error:', error instanceof Error ? error : { detail: error });
    return NextResponse.json(
      { error: 'Failed to load organizations' },
      { status: 500 },
    );
  }
}
