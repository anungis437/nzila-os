import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { eq, and, sql, type SQL } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

/** Active grievance statuses (not closed/settled/withdrawn/denied) */
const _ACTIVE_CLAIM_STATUSES = [
  'draft', 'filed', 'acknowledged', 'investigating',
  'response_due', 'response_received', 'escalated', 'mediation', 'arbitration',
];

/** GET /api/organizations — query organizations from DB */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parentId = searchParams.get('parent');
  const statusFilter = searchParams.get('status');
  const includeStats = searchParams.get('include_stats') === 'true';

  const conditions: SQL[] = [];
  if (parentId) conditions.push(eq(organizations.parentId, parentId));
  if (statusFilter) conditions.push(eq(organizations.status, statusFilter));

  const where = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const mapped = await withRLSContext(async () => {
    const rows = await db.select().from(organizations).where(where);

    // When include_stats is requested, count active claims and children per org
    const claimsByOrg: Record<string, number> = {};
    const childrenByOrg: Record<string, number> = {};
    if (includeStats && rows.length > 0) {
      const orgIds = rows.map(r => r.id);
      const claimCounts = await db.execute(
        sql`SELECT organization_id::text as org_id, count(*)::int as cnt
            FROM grievances
            WHERE organization_id::text IN (${sql.join(orgIds.map(id => sql`${id}`), sql`,`)})
              AND status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration')
            GROUP BY organization_id`
      );
      for (const row of Array.from(claimCounts) as Array<{ org_id: string; cnt: number }>) {
        claimsByOrg[row.org_id] = Number(row.cnt);
      }

      const childCounts = await db.execute(
        sql`SELECT parent_id::text as parent, count(*)::int as cnt
            FROM organizations
            WHERE parent_id::text IN (${sql.join(orgIds.map(id => sql`${id}`), sql`,`)})
            GROUP BY parent_id`
      );
      for (const row of Array.from(childCounts) as Array<{ parent: string; cnt: number }>) {
        childrenByOrg[row.parent] = Number(row.cnt);
      }
    }

    // Build parent name lookup from fetched rows
    const nameById = new Map(rows.map(r => [r.id, r.name]));

    // Map camelCase DB fields to snake_case expected by frontend
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      display_name: row.displayName,
      short_name: row.shortName,
      organization_type: row.organizationType,
      parent_id: row.parentId,
      parentName: row.parentId ? nameById.get(row.parentId) ?? null : null,
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
      memberCount: row.memberCount ?? 0,
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
      ...(includeStats ? {
        activeClaims: claimsByOrg[row.id] ?? 0,
        childCount: childrenByOrg[row.id] ?? 0,
      } : {}),
    }));
  });

  return NextResponse.json({ data: mapped });
}

/** POST /api/organizations — create organization in DB */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const [created] = await withRLSContext(async () =>
    db.insert(organizations).values({
      name: body.name,
      slug: body.slug,
      displayName: body.display_name,
      organizationType: body.organization_type ?? 'union',
      parentId: body.parent_id,
      hierarchyPath: body.hierarchy_path ?? [],
      hierarchyLevel: body.hierarchy_level ?? 0,
      sectors: body.sectors ?? [],
      email: body.email,
      phone: body.phone,
      website: body.website,
      status: body.status ?? 'active',
      clcAffiliated: body.clc_affiliated ?? false,
      memberCount: body.member_count ?? 0,
      activeMemberCount: body.active_member_count ?? 0,
      settings: body.settings ?? {},
      featuresEnabled: body.features_enabled ?? [],
    }).returning()
  );

  return NextResponse.json({ data: created }, { status: 201 });
}