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
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'platform_lead' },
    openapi: {
      tags: ['Platform', 'Admin'],
      summary: 'Platform-wide statistics from real database',
    },
  },
  async () => {
    const stats = await getPlatformStatsFromDb();
    return stats as any as Record<string, unknown>;
  },
);
