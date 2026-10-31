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
import { isPlatformAdminUser } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { recordOrganizationSelection } from '@/lib/auth/organization-selection-audit';

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
    // An archived or inactive organization cannot be switched to: the resolver that reads the selection requires it to be active.
    if ((org.status ?? 'active') !== 'active') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    // Membership organization_id is the organization UUID, matching the Django
    // foreign key. A slug comparison cannot succeed against that column.
    const userMembership = (await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          // Only an active, non-removed membership counts: a suspended, inactive or removed member is not a member here.
          eq(organizationMembers.status, 'active'),
          isNull(organizationMembers.deletedAt),
        ),
      )
      .limit(1))[0];

    if (!userMembership) {
      return NextResponse.json({ error: 'Access denied: not a member of this organization' }, { status: 403 });
    }
  }

  // A selection that leaves no trail is refused: a platform administrator choosing an organization they hold no membership of is the case
  // that matters most.
  try {
    await recordOrganizationSelection({ organizationId: org.id, userId, authority: isAdmin ? 'platform_administrator' : 'membership', mode: 'legacy' });
  } catch {
    return NextResponse.json({ error: 'The organization selection could not be recorded' }, { status: 503 });
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