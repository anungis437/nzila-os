/**
 * GET /api/alerts/realtime
 *
 * Returns latest real-time observability alerts for the current organization.
 */

import { withApi, RATE_LIMITS, ApiError, z } from '@/lib/api/framework';
import { getRecentRealtimeAlerts } from '@/services/observability/realtime-alerting-service';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'grievance_case_suite',
    query: querySchema,
    rateLimit: RATE_LIMITS.ADVANCED_ANALYTICS,
    openapi: {
      tags: ['Observability'],
      summary: 'List latest real-time observability alerts',
    },
  },
  async ({ organizationId, query }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const rows = await getRecentRealtimeAlerts(organizationId, query?.limit ?? 25);
    return {
      alerts: rows,
      count: rows.length,
    };
  },
);
