/**
 * POST /api/reconciliation/resolve — Resolve a reconciliation exception
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { resolveException } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  exceptionId: z.string().uuid(),
  resolution: z.enum(['resolved', 'written_off']),
  notes: z.string().max(2000),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'commercial_reporting',
    body: resolveSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Reconciliation'],
      summary: 'Resolve a reconciliation exception',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const result = await resolveException(body.exceptionId, {
      status: body.resolution,
      resolvedBy: userId ?? 'system',
      notes: body.notes,
    });
    return result;
  },
);
