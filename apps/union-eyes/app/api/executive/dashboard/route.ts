/**
 * GET /api/executive/dashboard
 * Executive dashboard summary with metrics, recent grievances, and strategic goals.
 * Backed by Drizzle ORM — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { profilesTable, grievances, strategicGoals } from '@/db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'vice_president' },
    openapi: {
      tags: ['Executive'],
      summary: 'Get executive dashboard',
      description: 'Returns executive dashboard summary for the organization.',
    },
  },
  async ({ organizationId }) => {
    const orgId = organizationId!;

    const [memberResult, activeGrievanceResult, recentGrievances, goals] = await Promise.all([
      db.select({ total: count() }).from(profilesTable).where(eq(profilesTable.status, 'active')),
      db.select({ total: count() }).from(grievances).where(
        and(
          eq(grievances.organizationId, orgId),
          sql`${grievances.status} NOT IN ('closed', 'withdrawn', 'dismissed')`,
        ),
      ),
      db.select()
        .from(grievances)
        .where(eq(grievances.organizationId, orgId))
        .orderBy(desc(grievances.createdAt))
        .limit(5),
      db.select()
        .from(strategicGoals)
        .where(eq(strategicGoals.organizationId, orgId))
        .orderBy(desc(strategicGoals.createdAt))
        .limit(5),
    ]);

    return {
      metrics: {
        totalMembers: memberResult[0]?.total ?? 0,
        activeGrievances: activeGrievanceResult[0]?.total ?? 0,
        pendingApprovals: 0,
        upcomingMeetings: 0,
      },
      recentGrievances,
      strategicGoals: goals,
    };
  },
);

