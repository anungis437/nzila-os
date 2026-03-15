/**
 * GET /api/v2/stewards/stats
 * Direct DB — aggregate steward statistics for the chief steward dashboard.
 * Returns: { totalStewards, activeCases, pendingEscalations, completedThisMonth, successRate, upcomingTraining }
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { stewards, stewardAssignments } from '@/db/schema';
import { grievances } from '@/db/schema';
import { sql, eq, and, gte } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'chief_steward' },
    openapi: {
      tags: ['Stewards'],
      summary: 'Steward dashboard statistics',
      description: 'Aggregate steward count, active cases, escalations, completed this month, and success rate.',
    },
  },
  async () => {
    return withSystemContext(async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalStewards,
        activeCases,
        pendingEscalations,
        completedThisMonth,
        totalCompleted,
        totalAssignments,
      ] = await Promise.all([
        // Active steward profiles
        db.select({ count: sql<number>`count(*)::int` })
          .from(stewards)
          .where(eq(stewards.active, true))
          .then(r => r[0]?.count ?? 0),

        // Steward assignments with status 'active'
        db.select({ count: sql<number>`count(*)::int` })
          .from(stewardAssignments)
          .where(eq(stewardAssignments.status, 'active'))
          .then(r => r[0]?.count ?? 0),

        // Grievances with status 'escalated'
        db.select({ count: sql<number>`count(*)::int` })
          .from(grievances)
          .where(eq(grievances.status, 'escalated'))
          .then(r => r[0]?.count ?? 0),

        // Assignments completed this month
        db.select({ count: sql<number>`count(*)::int` })
          .from(stewardAssignments)
          .where(and(
            eq(stewardAssignments.status, 'completed'),
            gte(stewardAssignments.completedAt, monthStart),
          ))
          .then(r => r[0]?.count ?? 0),

        // Total completed (all time) for success rate
        db.select({ count: sql<number>`count(*)::int` })
          .from(stewardAssignments)
          .where(eq(stewardAssignments.status, 'completed'))
          .then(r => r[0]?.count ?? 0),

        // Total assignments ever (excluding pending/declined) for success rate
        db.select({ count: sql<number>`count(*)::int` })
          .from(stewardAssignments)
          .where(sql`${stewardAssignments.status} NOT IN ('pending', 'declined')`)
          .then(r => r[0]?.count ?? 0),
      ]);

      const successRate = totalAssignments > 0
        ? Math.round((totalCompleted / totalAssignments) * 100)
        : 0;

      return {
        totalStewards,
        activeCases,
        pendingEscalations,
        completedThisMonth,
        successRate,
        upcomingTraining: 0,
      };
    });
  },
);
