/**
 * Steward Workload Snapshot
 *
 * GET /api/grievances/workload — Aggregate stats for the steward load card
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { eq } from 'drizzle-orm';
import { hasSupervisoryCaseRead } from '@/lib/cases/supervisory-case-read';
import { grievanceCaseAuthorityScope } from '@/lib/cases/grievance-list-scope';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    openapi: { tags: ['Grievances'], summary: 'Steward workload stats' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ACTIVE_STATUSES = ['filed', 'step_1', 'step_2', 'step_3', 'arbitration', 'mediation'];

    // Caseload is scope-limited: a steward's card counts the matters they hold authority over;
    // only supervisory authority sees the organization-wide figure.
    const scope = (await hasSupervisoryCaseRead(organizationId, userId))
      ? eq(grievances.organizationId, organizationId)
      : grievanceCaseAuthorityScope(organizationId, userId);

    const rows = await db
      .select()
      .from(grievances)
      .where(scope);

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
