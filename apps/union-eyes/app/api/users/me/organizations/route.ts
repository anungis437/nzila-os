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
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { eq, inArray } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core'
import { isPlatformAdminUser } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';

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

    // Memberships are those bound to the authenticated user id.
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    // A membership is never linked to the caller here. An e-mail address is not proof of identity (the provider can
    // return an unverified one, and a roster row may carry any address), so matching on it used to rebind every
    // membership of that address, in any organization, and every membership of another user id, to the caller.
    // A membership is bound to an identity by accepting an invitation or by the canonical onboarding flow.

    logger.info('[/api/users/me/organizations] Membership resolution complete', {
      userId,
      membershipCount: memberships.length,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orgs: any[] = [];

    if (isAdmin) {
      // Platform admins can see ALL organizations
      orgs = await db.select().from(organizations).limit(500);
      logger.info('[/api/users/me/organizations] Platform admin — returning all orgs', {
        userId,
        count: orgs.length,
      });
    } else {
      // Regular users only see orgs they are members of
      const orgIds = [...new Set(memberships.map(m => m.organizationId))];

      if (orgIds.length > 0) {
        orgs = await db
          .select()
          .from(organizations)
          .where(inArray(organizations.id, orgIds));
      }

      logger.info('[/api/users/me/organizations] Non-admin org resolution complete', {
        userId,
        membershipCount: memberships.length,
        orgCount: orgs.length,
      });
    }

    return NextResponse.json({
      organizations: orgs.map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        type: o.organizationType ?? 'union',
        parentId: o.parentId ?? null,
        sector: o.sectors?.[0] ?? null,
        jurisdiction: o.provinceTerritory ?? null,
        description: o.description ?? null,
        createdAt: o.createdAt?.toISOString() ?? null,
        updatedAt: o.updatedAt?.toISOString() ?? null,
      })),
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
