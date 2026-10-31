/**
 * POST /api/reconciliation/resolve — Resolve a reconciliation exception
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { resolveException } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  exceptionId: z.guid(),
  resolution: z.enum(['resolved', 'written_off']),
  // A resolution or write-off without a stated reason is not a decision anyone can later review.
  notes: z.string().trim().min(10, 'State why the exception is resolved or written off (at least 10 characters)').max(2000),
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
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:reconcile', resourceId: body.exceptionId }),
    );
    const result = await resolveException(body.exceptionId, organizationId, {
      status: body.resolution,
      resolvedBy: userId,
      notes: body.notes,
    });
    return result;
  },
);
