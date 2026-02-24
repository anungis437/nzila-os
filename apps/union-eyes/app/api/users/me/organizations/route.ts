/**
 * GET /api/users/me/organizations
 *
 * Returns the authenticated user's organizations and memberships.
 * Queries Drizzle/PostgreSQL directly (replaces Django proxy).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's organization memberships
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    // Fetch the organizations the user belongs to
    const orgIds = [...new Set(memberships.map(m => m.organizationId))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orgs: any[] = [];

    if (orgIds.length > 0) {
      // organizationMembers.organizationId is a slug/text, not UUID
      // We need to match against organizations by slug or id
      const allOrgs = await db.select().from(organizations);
      orgs = allOrgs.filter(o => orgIds.includes(o.id) || orgIds.includes(o.slug ?? ''));
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
    console.error('[/api/users/me/organizations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load organizations' },
      { status: 500 },
    );
  }
}

