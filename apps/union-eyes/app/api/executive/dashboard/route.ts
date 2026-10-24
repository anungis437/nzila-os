/**
 * GET /api/executive/dashboard
 * Executive dashboard summary with aggregate metrics and strategic goals.
 *
 * Deliberately returns NO grievance rows. Executive oversight of member service
 * is aggregate (UE-OFFICER-EXECUTIVE-CANONICAL-2.1 §IX): matter-level content
 * needs a separate effective grant, which a `minRole` check cannot express.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { strategicGoals } from '@/db/schema';
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

    const [metrics, goals] = await Promise.all([
      getExecutiveMetrics({ organizationId: orgId, timeframe }),
      db.select()
        .from(strategicGoals)
        .where(eq(strategicGoals.organizationId, orgId))
        .orderBy(desc(strategicGoals.createdAt))
        .limit(5),
    ]);

    return {
      metrics,
      strategicGoals: goals,
    };
  },
);

