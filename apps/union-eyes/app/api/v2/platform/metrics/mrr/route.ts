/**
 * Metrics endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ["System"],
      summary: 'System metrics',
      description: 'Returns aggregated system metrics.',
    },
  },
  async () => {
    return { activeUsers: 0, requestsToday: 0, errorRate: 0 };
  },
);
