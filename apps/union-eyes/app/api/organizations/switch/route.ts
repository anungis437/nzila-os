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
import { and, eq, isNull } from 'drizzle-orm';
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

  // Look up org by UUID
  const orgs = await db
    .select()
    .from(organizations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(organizations.id, organizationId as any))
    .limit(1);

  const org = orgs[0];

  if (!org || org.status !== 'active') {
    return NextResponse.json({ error: 'Organization not found or inactive' }, { status: 404 });
  }

  // Active, non-removed membership is required even for platform staff.
  {
    // Membership organization_id is the organization UUID, matching the Django
    // foreign key. A slug comparison cannot succeed against that column.
    const userMembership = (await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active'),
          isNull(organizationMembers.deletedAt),
        ),
      )
      .limit(1))[0];

    if (!userMembership || userMembership.status !== 'active' || userMembership.deletedAt) {
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