import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const _ACTIVE_STATUSES = [
  'draft', 'filed', 'acknowledged', 'investigating',
  'response_due', 'response_received', 'escalated', 'mediation', 'arbitration',
];
const _RESOLVED_STATUSES = ['settled', 'closed', 'withdrawn', 'denied'];

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Fetch org
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Member counts
  const memberRows = Array.from(
    await db.execute(
      sql`SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'active')::int AS active,
            count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_this_month
          FROM organization_members
          WHERE organization_id = ${id}`
    )
  ) as Array<{ total: number; active: number; new_this_month: number }>;
  const mem = memberRows[0] ?? { total: 0, active: 0, new_this_month: 0 };

  // Grievance counts
  const claimRows = Array.from(
    await db.execute(
      sql`SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active,
            count(*) FILTER (WHERE status::text IN ('settled','closed','withdrawn','denied'))::int AS resolved,
            count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month
          FROM grievances
          WHERE organization_id = ${id}`
    )
  ) as Array<{ total: number; active: number; resolved: number; this_month: number }>;
  const claims = claimRows[0] ?? { total: 0, active: 0, resolved: 0, this_month: 0 };

  // Average resolution days (for resolved grievances)
  const resRows = Array.from(
    await db.execute(
      sql`SELECT coalesce(avg(EXTRACT(EPOCH FROM (coalesce(resolved_at, closed_at) - created_at)) / 86400)::int, 0) AS avg_days
          FROM grievances
          WHERE organization_id = ${id}
            AND (resolved_at IS NOT NULL OR closed_at IS NOT NULL)`
    )
  ) as Array<{ avg_days: number }>;
  const avgResolutionDays = resRows[0]?.avg_days ?? 0;

  // Child organization count
  const childRows = Array.from(
    await db.execute(
      sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`
    )
  ) as Array<{ cnt: number }>;
  const childOrganizations = childRows[0]?.cnt ?? 0;

  // Member growth rate (% change from last month)
  const growthRows = Array.from(
    await db.execute(
      sql`SELECT
            count(*) FILTER (WHERE created_at < date_trunc('month', now()))::int AS prev,
            count(*)::int AS total
          FROM organization_members
          WHERE organization_id = ${id}`
    )
  ) as Array<{ prev: number; total: number }>;
  const prev = growthRows[0]?.prev ?? 0;
  const memberGrowthRate = prev > 0
    ? ((mem.total - prev) / prev) * 100
    : (mem.total > 0 ? 100 : 0);

  // Claims by status
  const statusRows = Array.from(
    await db.execute(
      sql`SELECT status::text AS status, count(*)::int AS cnt
          FROM grievances WHERE organization_id = ${id}
          GROUP BY status`
    )
  ) as Array<{ status: string; cnt: number }>;
  const claimsByStatus: Record<string, number> = {};
  for (const r of statusRows) claimsByStatus[r.status] = r.cnt;

  const analytics = {
    organizationId: id,
    organizationName: org.name,
    organizationType: org.organizationType,
    totalMembers: mem.total,
    activeMembers: mem.active,
    newMembersThisMonth: mem.new_this_month,
    memberGrowthRate: Math.round(memberGrowthRate * 10) / 10,
    totalClaims: claims.total,
    activeClaims: claims.active,
    resolvedClaims: claims.resolved,
    claimsThisMonth: claims.this_month,
    avgResolutionDays,
    childOrganizations,
    claimsByStatus,
  };

  return NextResponse.json({ data: analytics });
}