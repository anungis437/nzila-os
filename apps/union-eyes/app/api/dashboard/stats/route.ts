/**
 * GET /api/dashboard/stats
 * Returns real-time dashboard statistics (claims counts, member count)
 * for the current organization.
 */
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApiAuth(async (request) => {
  const url = new URL(request.url);
  const organizationId =
    url.searchParams.get('organizationId') ??
    url.searchParams.get('orgId') ??
    url.searchParams.get('organization_id');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Organization ID required' },
      { status: 400 },
    );
  }

  try {
    const [claimsResult, membersResult] = await Promise.all([
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE status NOT IN ('resolved','closed','dismissed'))::int AS "activeClaims",
          count(*) FILTER (WHERE status IN ('submitted','under_review'))::int          AS "pendingReviews",
          count(*) FILTER (WHERE status IN ('resolved','closed'))::int                 AS "resolvedCases",
          count(*) FILTER (WHERE priority IN ('high','critical')
                           AND status NOT IN ('resolved','closed','dismissed'))::int   AS "highPriorityClaims"
        FROM claims
        WHERE organization_id = ${organizationId}
      `),
      db.execute(sql`
        SELECT count(*)::int AS "activeMembers"
        FROM organization_members
        WHERE organization_id = ${organizationId}
          AND status = 'active'
      `),
    ]);

    const claims = (claimsResult[0] as Record<string, number>) ?? {};
    const members = (membersResult[0] as Record<string, number>) ?? {};

    return NextResponse.json({
      activeClaims: claims.activeClaims ?? 0,
      pendingReviews: claims.pendingReviews ?? 0,
      resolvedCases: claims.resolvedCases ?? 0,
      highPriorityClaims: claims.highPriorityClaims ?? 0,
      activeMembers: members.activeMembers ?? 0,
    });
  } catch (error) {
    const { logger: log } = await import('@/lib/logger');
    log.error('Dashboard stats query failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({
      activeClaims: 0,
      pendingReviews: 0,
      resolvedCases: 0,
      highPriorityClaims: 0,
      activeMembers: 0,
    });
  }
});
