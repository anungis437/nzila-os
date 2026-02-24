/**
 * GET POST /api/rewards/redemptions
 * Migrated to withApi() framework
 */
import { withApi } from '@/lib/api/framework';

import { GET as v1GET, POST as v1POST } from '@/app/api/rewards/redemptions/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Rewards'],
      summary: 'GET redemptions',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request, { params: params as Record<string, unknown> });
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Rewards'],
      summary: 'POST redemptions',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);
