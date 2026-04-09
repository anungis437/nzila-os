import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireUserForOrganization, ROLE_HIERARCHY } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

function mapOrg(row: typeof organizations.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    display_name: row.displayName,
    short_name: row.shortName,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    hierarchy_path: row.hierarchyPath,
    hierarchy_level: row.hierarchyLevel,
    province_territory: row.provinceTerritory,
    sectors: row.sectors,
    email: row.email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    clc_affiliated: row.clcAffiliated,
    affiliation_date: row.affiliationDate,
    charter_number: row.charterNumber,
    member_count: row.memberCount,
    active_member_count: row.activeMemberCount,
    last_member_count_update: row.lastMemberCountUpdate,
    subscription_tier: row.subscriptionTier,
    billing_contact_id: row.billingContactId,
    settings: row.settings ?? {},
    features_enabled: row.featuresEnabled ?? [],
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    created_by: row.createdBy,
    legacy_org_id: row.legacyOrgId,
  };
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Compute stats
  const claimRows = Array.from(
    await db.execute(
      sql`SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active
          FROM grievances WHERE organization_id = ${id}`
    )
  ) as Array<{ total: number; active: number }>;
  const claims = claimRows[0] ?? { total: 0, active: 0 };

  const childRows = Array.from(
    await db.execute(
      sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`
    )
  ) as Array<{ cnt: number }>;

  const mapped = mapOrg(row);
  return NextResponse.json({
    data: {
      ...mapped,
      memberCount: row.memberCount ?? 0,
      activeClaims: claims.active,
      totalClaims: claims.total,
      childCount: childRows[0]?.cnt ?? 0,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Require caller to be a member of THIS org with admin+ role
  let userCtx;
  try {
    userCtx = await requireUserForOrganization(id);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const userRole = userCtx.roles[0] || 'member';
  if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.admin) {
    return NextResponse.json({ error: 'Forbidden: requires admin role' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.display_name !== undefined) updates.displayName = body.display_name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.website !== undefined) updates.website = body.website;
  if (body.sectors !== undefined) updates.sectors = body.sectors;
  if (body.parent_id !== undefined) updates.parentId = body.parent_id;
  if (body.settings !== undefined) updates.settings = body.settings;
  updates.updatedAt = new Date();

  const [updated] = await withRLSContext(async () =>
    db.update(organizations).set(updates).where(eq(organizations.id, id)).returning()
  );
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: mapOrg(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Require caller to be a member of THIS org with admin+ role
  let userCtx;
  try {
    userCtx = await requireUserForOrganization(id);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const userRole = userCtx.roles[0] || 'member';
  if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.admin) {
    return NextResponse.json({ error: 'Forbidden: requires admin role' }, { status: 403 });
  }

  const [archived] = await withRLSContext(async () =>
    db.update(organizations)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning()
  );
  if (!archived) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: mapOrg(archived) });
}