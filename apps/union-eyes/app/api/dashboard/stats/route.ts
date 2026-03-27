/**
 * GET /api/dashboard/stats
 * Returns real-time dashboard statistics (claims counts, member count)
 * for the current organization.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Dashboard'],
      summary: 'Dashboard statistics for the current organization',
    },
  },
  async ({ organizationId }) => {
  if (!organizationId) {
    return NextResponse.json(
      { error: 'Organization ID required' },
      { status: 400 },
    );
  }

  try {
    const [claimsResult, membersResult] = await withRLSContext(
      { organizationId },
      async (rlsDb) => Promise.all([
        rlsDb.execute(sql`
          SELECT
            count(*) FILTER (WHERE status NOT IN ('resolved','closed','rejected'))::int AS "activeClaims",
            count(*) FILTER (WHERE status IN ('submitted','under_review'))::int          AS "pendingReviews",
            count(*) FILTER (WHERE status IN ('resolved','closed'))::int                 AS "resolvedCases",
            count(*) FILTER (WHERE priority IN ('high','critical')
                             AND status NOT IN ('resolved','closed','rejected'))::int    AS "highPriorityClaims"
          FROM claims
          WHERE organization_id = ${organizationId}
        `),
        rlsDb.execute(sql`
          SELECT count(*)::int AS "activeMembers"
          FROM organization_members
          WHERE organization_id = ${organizationId}
            AND status = 'active'
        `),
      ])
    );

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
