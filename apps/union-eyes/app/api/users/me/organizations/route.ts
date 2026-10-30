/**
 * GET /api/users/me/organizations
 *
 * Returns the authenticated user's organizations and memberships.
 * Queries Drizzle/PostgreSQL directly (replaces Django proxy).
 *
 * V2 uses active private memberships, including for platform administrators.
 * Legacy mode also requires current active membership; no platform-wide roster enumeration.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { eq, inArray, and, isNull } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core'
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

    // Memberships are those bound to the authenticated user id.
    const rawMemberships = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, 'active'),
        isNull(organizationMembers.deletedAt),
      ));
    // Defense in depth if a legacy data adapter unexpectedly ignores a predicate.
    const memberships = rawMemberships.filter(m => m.status === 'active' && !m.deletedAt);

    // A membership is never linked to the caller here. An e-mail address is not proof of identity (the provider can
    // return an unverified one, and a roster row may carry any address), so matching on it used to rebind every
    // membership of that address, in any organization, and every membership of another user id, to the caller.
    // A membership is bound to an identity by accepting an invitation or by the canonical onboarding flow.

    logger.info('[/api/users/me/organizations] Membership resolution complete', {
      userId,
      membershipCount: memberships.length,
    });

    // Platform administrators have NO standing cross-tenant visibility;
    // this is a personal organization selector, never a customer directory.
    const orgIds = [...new Set(memberships.map(m => m.organizationId))];
    const orgs = orgIds.length === 0 ? [] : (await db
      .select()
      .from(organizations)
      .where(and(
        inArray(organizations.id, orgIds),
        eq(organizations.status, 'active'),
      ))).filter(org => org.status === 'active' && orgIds.includes(org.id));

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
