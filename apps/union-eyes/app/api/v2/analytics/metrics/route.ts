/**
 * GET POST /api/analytics/metrics
 * Migrated to withApi() framework
 */
import { withApi, z } from '@/lib/api/framework';

const _analyticsMetricsSchema = z.object({
  metricType: z.unknown().optional(),
  metricName: z.string().min(1, 'metricName is required'),
  periodType: z.unknown().optional(),
  periodStart: z.unknown().optional(),
  periodEnd: z.unknown().optional(),
});

import { GET as v1GET, POST as v1POST } from '@/app/api/analytics/metrics/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Analytics'],
      summary: 'GET metrics',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1GET(request, {} as any);
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Analytics'],
      summary: 'POST metrics',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1POST(request, {} as any);
    return response;
  },
);
