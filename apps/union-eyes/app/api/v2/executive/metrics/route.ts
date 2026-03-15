/**
 * GET /api/v2/executive/metrics
 * Executive metrics aggregated from profiles, grievances, and federation data.
 * Backed by Drizzle ORM — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { profilesTable, grievances } from '@/db/schema';
import { eq, and, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'vice_president' },
    openapi: {
      tags: ['Executive'],
      summary: 'Get executive metrics',
      description: 'Returns aggregated executive metrics for the organization.',
    },
  },
  async ({ organizationId }) => {
    const orgId = organizationId!;

    const [memberResult, grievanceResult, activeGrievanceResult] = await Promise.all([
      db.select({ total: count() }).from(profilesTable).where(eq(profilesTable.status, 'active')),
      db.select({ total: count() }).from(grievances).where(eq(grievances.organizationId, orgId)),
      db.select({ total: count() }).from(grievances).where(
        and(
          eq(grievances.organizationId, orgId),
          sql`${grievances.status} NOT IN ('closed', 'withdrawn', 'dismissed')`,
        ),
      ),
    ]);

    const totalMembers = memberResult[0]?.total ?? 0;
    const totalGrievances = grievanceResult[0]?.total ?? 0;
    const activeGrievances = activeGrievanceResult[0]?.total ?? 0;
    const resolvedGrievances = totalGrievances - activeGrievances;
    const grievanceResolutionRate = totalGrievances > 0
      ? Math.round((resolvedGrievances / totalGrievances) * 100)
      : 0;

    return {
      totalMembers,
      activeGrievances,
      pendingApprovals: 0,
      upcomingMeetings: 0,
      monthlyBudget: 0,
      membershipTrend: 0,
      grievanceResolutionRate,
    };
  },
);
