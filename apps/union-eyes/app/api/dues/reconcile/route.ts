/**
 * POST /api/dues/reconcile — Run dues reconciliation
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { runReconciliation } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const reconcileSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    body: reconcileSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: 'Run dues reconciliation for a period',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:reconcile', requiresLedger: true }),
    );
    const result = await runReconciliation({
      organizationId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      runBy: userId ?? undefined,
    });
    return { ...result };
  },
);
