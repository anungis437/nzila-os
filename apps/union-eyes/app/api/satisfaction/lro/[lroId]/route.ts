/**
 * LRO Performance route
 * GET /api/satisfaction/lro/[lroId] — get performance metrics for an LRO
 */
import { withApi, ApiError } from '@/lib/api/framework';
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
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const performance = await getLroPerformance(params.lroId, organizationId);
    // An unknown representative and one nobody has rated are the same here: there are no figures, which is not an average of zero.
    if (performance.completedSurveys === 0) throw ApiError.notFound('Satisfaction ratings for this representative');
    return { ...performance };
  }
);
