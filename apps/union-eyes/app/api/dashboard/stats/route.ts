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
import { decideCaseCapabilitiesBatch } from '@/lib/authority/store/route-adapter';

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

    const { claims, membersResult } = await withRLSContext(
      { organizationId: actor.organizationId },
      async (tx) => {
        const candidates = Array.from(await tx.execute(sql`
          SELECT c.claim_id AS "claimId", c.status, c.priority
          FROM claims c WHERE ${caseReadScope(actor, 'c')}
        `)) as unknown as Array<{claimId: string; status: string; priority: string}>;
        const decisions = await decideCaseCapabilitiesBatch(tx, { ...actor, caseIds: candidates.map(row => row.claimId) });
        const visible = candidates.filter(row => decisions.get(row.claimId)?.['case:read'].effect === 'allow');
        const active = (status: string) => !['resolved','closed','rejected'].includes(status);
        const membersResult = actor.role === 'member' ? [] : await tx.execute(sql`
          SELECT count(*)::int AS "activeMembers" FROM organization_members
          WHERE organization_id = ${actor.organizationId} AND status = 'active'
        `);
        return { claims: {
          activeClaims: visible.filter(row => active(row.status)).length,
          pendingReviews: visible.filter(row => ['submitted','under_review'].includes(row.status)).length,
          resolvedCases: visible.filter(row => ['resolved','closed'].includes(row.status)).length,
          highPriorityClaims: visible.filter(row => active(row.status) && ['high','critical'].includes(row.priority)).length,
        }, membersResult };
      },
    ).catch(() => { throw ApiError.internal('Dashboard statistics are unavailable'); });

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