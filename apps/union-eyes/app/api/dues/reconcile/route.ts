/**
 * POST /api/dues/reconcile — Run dues reconciliation
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { runReconciliation } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const reconcileSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'financial_intelligence_suite',
    body: reconcileSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: 'Run dues reconciliation for a period',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const result = await runReconciliation({
      organizationId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      runBy: userId ?? undefined,
    });
    return { ...result };
  },
);
