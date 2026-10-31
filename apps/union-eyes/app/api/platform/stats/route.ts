/**
 * Platform Stats API
 * 
 * Returns real-time platform metrics from the database for the Nzila Ops Dashboard,
 * Customer Success, and other platform admin pages.
 * 
 * @route GET /api/platform/stats
 * @auth Required — minimum role: platform_lead
 */

import { getPlatformStatsFromDb } from '@/lib/queries/platform-stats';
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'platform_lead' },
    openapi: {
      tags: ['Platform', 'Admin'],
      summary: 'Platform-wide statistics from real database',
    },
  },
  async ({ userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.forbidden('An active organization is required to read platform statistics');
    const stats = await getPlatformStatsFromDb({ userId, organizationId });
    return stats as any as Record<string, unknown>;
  },
);
