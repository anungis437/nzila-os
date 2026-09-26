import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq, sql } from 'drizzle-orm';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/current
 *
 * Reserved sentinel route. Must NOT be handled by /api/organizations/[id]
 * (which would bind the literal "current" as a UUID).
 */
export async function GET() {
  const { userId, orgId: sessionOrgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let organizationId: string;
  try {
    // Acceptance/session auth may already carry orgId (verified membership).
    organizationId = sessionOrgId || (await getOrganizationIdForUser(userId));
  } catch {
    return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
  }

  return withRLSContext({ organizationId }, async () => {
    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const claimRows = Array.from(
      await db.execute(
        sql`SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active
            FROM grievances WHERE organization_id = ${organizationId}`,
      ),
    ) as Array<{ total: number; active: number }>;
    const claims = claimRows[0] ?? { total: 0, active: 0 };

    const childRows = Array.from(
      await db.execute(
        sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${organizationId}`,
      ),
    ) as Array<{ cnt: number }>;

    return NextResponse.json({
      data: {
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
        memberCount: row.memberCount ?? 0,
        activeClaims: claims.active,
        totalClaims: claims.total,
        childCount: childRows[0]?.cnt ?? 0,
      },
    });
  });
}
