/**
 * GET /api/executive/metrics
 * Executive metrics aggregated from profiles, grievances, and federation data.
 * Backed by Drizzle ORM — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { DashboardTimeframe, getExecutiveMetrics } from '@/lib/services/dashboard-kpi-service';

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
    const timeframe: DashboardTimeframe = 'monthly';

    const metrics = await getExecutiveMetrics({
      organizationId: orgId,
      timeframe,
    });

    return metrics as unknown as Record<string, unknown>;
  },
);

