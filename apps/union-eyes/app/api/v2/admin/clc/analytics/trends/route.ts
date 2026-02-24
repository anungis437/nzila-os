/**
 * GET /api/admin/clc/analytics/trends
 * Migrated to withApi() framework
 */
import { withApi } from '@/lib/api/framework';

import { GET as v1GET } from '@/app/api/admin/clc/analytics/trends/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'president' as const },
    openapi: {
      tags: ['Admin'],
      summary: 'GET trends',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1GET(request, {} as any);
    return response;
  },
);
