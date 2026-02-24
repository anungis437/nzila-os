/**
 * POST /api/reports/execute
 * Migrated to withApi() framework
 */

import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const _reportsExecuteSchema = z.object({
  config: z.unknown().optional(),
});

import { POST as v1POST } from '@/app/api/reports/execute/route';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' as const },
    rateLimit: RATE_LIMITS.REPORT_EXECUTION,
    openapi: {
      tags: ['Reports'],
      summary: 'POST execute',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);
