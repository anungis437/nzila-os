/**
 * GET /api/onboarding/peer-benchmarks
 * Migrated to withApi() framework
 */
import { withApi } from '@/lib/api/framework';

import { GET as v1GET } from '@/app/api/onboarding/peer-benchmarks/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Onboarding'],
      summary: 'GET peer-benchmarks',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request, { params: Promise.resolve(params) });
    return response;
  },
);
