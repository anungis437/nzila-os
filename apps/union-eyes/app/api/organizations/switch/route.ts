/**
 * POST /api/organizations/switch
 *
 * V2 rotates a password session or validates a provider selection hint using private memberships.
 * Legacy mode validates public membership/admin authority and returns organization metadata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations, organizationMembers } from '@/db/schema-organizations';
import { and, eq } from 'drizzle-orm';
import { isPlatformAdminUser } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (currentStateContextEnabled()) {
    const { handleCanonicalOrganizationSwitch } =
      await import('@/lib/auth/canonical-organization-selection')
    return handleCanonicalOrganizationSwitch(req)
  }
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

  const isAdmin = await isPlatformAdminUser(userId);

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