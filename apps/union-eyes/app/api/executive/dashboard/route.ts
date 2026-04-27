/**
 * GET /api/executive/dashboard
 * Executive dashboard summary with metrics, recent grievances, and strategic goals.
 * Backed by Drizzle ORM — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { grievances, strategicGoals } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { DashboardTimeframe, getExecutiveMetrics } from '@/lib/services/dashboard-kpi-service';

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
    const timeframe: DashboardTimeframe = 'monthly';

    const [metrics, recentGrievances, goals] = await Promise.all([
      getExecutiveMetrics({ organizationId: orgId, timeframe }),
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
      metrics,
      recentGrievances,
      strategicGoals: goals,
    };
  },
);

