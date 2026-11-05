/**
 * GET /api/dashboard/stats
 * Case counts for the CALLER: the cases they filed or hold a live kernel relationship to (the same read scope as
 * GET /api/cases). A tenant-wide aggregate is not a member's to see, and seniority is not a read, so no count here
 * is derived from a case the caller could not open. A failed query is an error, never a zero.
 */
import { NextResponse } from 'next/server';
import { withApi, ApiError } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { caseReadScope, getCaseActor } from '@/lib/cases/case-authorization';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Dashboard'],
      summary: 'Case statistics for the cases the caller is party to',
    },
  },
  async () => {
    const actor = await getCaseActor();

    const [claimsResult, membersResult] = await withRLSContext(
      { organizationId: actor.organizationId },
      async (rlsDb) => Promise.all([
        rlsDb.execute(sql`
          SELECT
            count(*) FILTER (WHERE c.status NOT IN ('resolved','closed','rejected'))::int AS "activeClaims",
            count(*) FILTER (WHERE c.status IN ('submitted','under_review'))::int          AS "pendingReviews",
            count(*) FILTER (WHERE c.status IN ('resolved','closed'))::int                 AS "resolvedCases",
            count(*) FILTER (WHERE c.priority IN ('high','critical')
                             AND c.status NOT IN ('resolved','closed','rejected'))::int    AS "highPriorityClaims"
          FROM claims c
          WHERE ${caseReadScope(actor, 'c')}
        `),
        // The organization's member count is institutional information, not a figure for an ordinary member.
        actor.role === 'member'
          ? Promise.resolve([] as Array<Record<string, number>>)
          : rlsDb.execute(sql`
              SELECT count(*)::int AS "activeMembers"
              FROM organization_members
              WHERE organization_id = ${actor.organizationId}
                AND status = 'active'
            `),
      ]),
    ).catch(() => {
      throw ApiError.internal('Dashboard statistics are unavailable');
    });

    const claims = (claimsResult[0] as Record<string, number>) ?? {};
    const members = (membersResult[0] as Record<string, number> | undefined) ?? null;

    // The consumers read the bare object, so the shape is preserved.
    return NextResponse.json({
      activeClaims: claims.activeClaims ?? 0,
      pendingReviews: claims.pendingReviews ?? 0,
      resolvedCases: claims.resolvedCases ?? 0,
      highPriorityClaims: claims.highPriorityClaims ?? 0,
      activeMembers: members ? (members.activeMembers ?? 0) : null,
    });
  },
);