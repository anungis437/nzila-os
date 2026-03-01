/**
 * POST /api/organizations/switch
 *
 * Validates that the authenticated user is a member of the requested organization
 * (or is a platform admin) and returns the org data so the client can update its context.
 * Replaces Django proxy with direct Drizzle/PostgreSQL query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { organizations, organizationMembers } from '@/db/schema-organizations';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** Check if the given userId is in the PLATFORM_ADMIN_USER_IDS env var. */
function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let organizationId: string;
  try {
    const body = await req.json() as { organizationId?: string };
    organizationId = body.organizationId ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const isAdmin = isPlatformAdmin(userId);

  // Look up org by UUID
  const orgs = await db
    .select()
    .from(organizations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(organizations.id, organizationId as any))
    .limit(1);

  const org = orgs[0];

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Platform admins can switch to any org without membership check
  if (!isAdmin) {
    // Verify user has a membership in this org (by UUID)
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
        ),
      )
      .limit(1);

    // Also check by slug
    const userMembership = memberships[0] ||
      (await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, org.slug ?? organizationId),
          ),
        )
        .limit(1))[0];

    if (!userMembership) {
      return NextResponse.json({ error: 'Access denied: not a member of this organization' }, { status: 403 });
    }
  }

  return NextResponse.json({
    success: true,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.organizationType ?? 'union',
      parentId: org.parentId ?? null,
      sector: (org.sectors ?? [])[0] ?? null,
      jurisdiction: org.provinceTerritory ?? null,
      description: org.description ?? null,
      createdAt: org.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: org.updatedAt?.toISOString() ?? new Date().toISOString(),
    },
  });
}