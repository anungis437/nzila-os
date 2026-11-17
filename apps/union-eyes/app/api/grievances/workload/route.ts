/**
 * Steward Workload Snapshot
 *
 * GET /api/grievances/workload — Aggregate stats for the steward load card
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceCaseAuthorityScope } from '@/lib/cases/grievance-list-scope';
import { productionGrievanceCondition } from '@/lib/pilot/demo-provenance';
import { and } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { decideCaseCapabilitiesBatch } from '@/lib/authority/store/route-adapter';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    openapi: { tags: ['Grievances'], summary: 'Steward workload stats' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const ACTIVE_STATUSES = ['filed', 'step_1', 'step_2', 'step_3', 'arbitration', 'mediation'];

    // Caseload is scope-limited for everyone: the card counts the matters the caller holds authority over.
    // Seniority does not widen it to the organization-wide figure.
    const scope = grievanceCaseAuthorityScope(organizationId, userId);

    const rows = await withRLSContext({ organizationId }, async tx => {
      const candidates = await tx
      .select({ id: grievances.id, status: grievances.status, createdAt: grievances.createdAt })
      .from(grievances)
      .where(and(scope, productionGrievanceCondition()));
      const decisions = await decideCaseCapabilitiesBatch(tx, { userId, organizationId, caseIds: candidates.map(row => row.id) });
      return candidates.filter(row => decisions.get(row.id)?.['case:read'].effect === 'allow');
    });

    const activeCases = rows.filter(g => ACTIVE_STATUSES.includes(g.status)).length;

    const overdueCases = rows.filter(g => {
      if (!ACTIVE_STATUSES.includes(g.status)) return false;
      const age = Date.now() - new Date(g.createdAt).getTime();
      const ageDays = age / (1000 * 60 * 60 * 24);
      return ageDays > 30;
    }).length;

    const casesThisWeek = rows.filter(
      g => new Date(g.createdAt) >= oneWeekAgo,
    ).length;

    // Average days in current status — approximate from createdAt
    const activeDaysArr = rows
      .filter(g => ACTIVE_STATUSES.includes(g.status))
      .map(g => Math.round((Date.now() - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24)));

    const avgDaysInState =
      activeDaysArr.length > 0
        ? Math.round(activeDaysArr.reduce((s, d) => s + d, 0) / activeDaysArr.length)
        : 0;

    return {
      data: {
        activeCases,
        overdueCases,
        avgDaysInState,
        casesThisWeek,
      },
    };
  },
);
