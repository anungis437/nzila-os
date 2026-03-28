/**
 * LRO Rankings route
 * GET /api/satisfaction/rankings — get all LRO rankings for the organization
 */
import { withApi } from '@/lib/api/framework';
import { getOrganizationLroRankings } from '@/lib/services/satisfaction-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Get LRO rankings',
      description: 'Returns ranked LRO performance metrics for the organization.',
    },
  },
  async ({ organizationId }) => {
    const rankings = await getOrganizationLroRankings(organizationId!);
    return { rankings };
  }
);
