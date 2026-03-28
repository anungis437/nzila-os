/**
 * LRO Performance route
 * GET /api/satisfaction/lro/[lroId] — get performance metrics for an LRO
 */
import { withApi } from '@/lib/api/framework';
import { getLroPerformance } from '@/lib/services/satisfaction-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Get LRO performance metrics',
      description: 'Returns aggregated satisfaction ratings for a specific LRO.',
    },
  },
  async ({ params, organizationId }) => {
    const performance = await getLroPerformance(params.lroId, organizationId ?? undefined);
    return performance;
  }
);
