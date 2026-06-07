/**
 * GET /api/users/me/organizations
 *
 * Returns the authenticated user's organizations and memberships.
 * Queries Drizzle/PostgreSQL directly (replaces Django proxy).
 *
 * Platform admins (PLATFORM_ADMIN_USER_IDS) see ALL organizations
 * so they can switch into any org context for support / administration.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { profiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core'

const logger = createLogger('users:me:organizations')

export const dynamic = 'force-dynamic';

/** Check if the given userId is in the PLATFORM_ADMIN_USER_IDS env var. */
function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[/api/users/me/organizations] Request started', { userId });

    const isAdmin = isPlatformAdmin(userId);

    // Fetch memberships by current auth user ID.
    let memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    // Self-heal legacy/seeded memberships that were created by email but not
    // yet linked to the current Entra object ID.
    if (memberships.length === 0) {
      const user = await currentUser();
      let userEmail = user?.emailAddresses?.[0]?.emailAddress?.trim();

      if (!userEmail) {
        const profileRow = await db
          .select({ email: profiles.email })
          .from(profiles)
          .where(eq(profiles.userId, userId))
          .limit(1);
        userEmail = profileRow[0]?.email?.trim();
      }

      logger.info('[/api/users/me/organizations] No direct memberships by userId', {
        userId,
        hasEmail: Boolean(userEmail),
        emailPreview: userEmail ? `${userEmail.slice(0, 3)}***` : null,
      });

      if (userEmail) {
        const emailMemberships = await db
          .select()
          .from(organizationMembers)
          .where(sql`lower(${organizationMembers.email}) = lower(${userEmail})`);

        logger.info('[/api/users/me/organizations] Memberships by email lookup', {
          userId,
          matchCount: emailMemberships.length,
        });

        if (emailMemberships.length > 0) {
          await db
            .update(organizationMembers)
            .set({ userId })
            .where(sql`lower(${organizationMembers.email}) = lower(${userEmail})`);

          memberships = await db
            .select()
            .from(organizationMembers)
            .where(eq(organizationMembers.userId, userId));

          logger.info('[/api/users/me/organizations] Linked memberships by email', {
            userId,
            email: userEmail,
            linkedCount: emailMemberships.length,
          });
        } else {
          // Fallback for older seeded data: membership rows may have no email,
          // but profile.email still maps to a legacy userId.
          const legacyProfiles = await db
            .select({ legacyUserId: profiles.userId })
            .from(profiles)
            .where(sql`lower(${profiles.email}) = lower(${userEmail})`)
            .limit(1);

          const legacyUserId = legacyProfiles[0]?.legacyUserId;
          if (legacyUserId && legacyUserId !== userId) {
            await db
              .update(organizationMembers)
              .set({ userId })
              .where(eq(organizationMembers.userId, legacyUserId));

            memberships = await db
              .select()
              .from(organizationMembers)
              .where(eq(organizationMembers.userId, userId));

            logger.info('[/api/users/me/organizations] Linked memberships by legacy profile userId', {
              userId,
              legacyUserId,
              linkedCount: memberships.length,
            });
          }
        }
      }
    }

    logger.info('[/api/users/me/organizations] Membership resolution complete', {
      userId,
      membershipCount: memberships.length,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orgs: unknown[] = [];

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
        const allOrgs = await db.select().from(organizations);
        orgs = allOrgs.filter(o =>
          orgIds.includes(o.id) ||
          orgIds.includes(o.slug ?? ''),
        );
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
        createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: o.updatedAt?.toISOString() ?? new Date().toISOString(),
      })),
      memberships: memberships.map(m => ({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role,
        isPrimary: m.isPrimary ?? false,
        joinedAt: m.joinedAt?.toISOString() ?? m.createdAt?.toISOString() ?? new Date().toISOString(),
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

