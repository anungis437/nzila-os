/**
 * POST /api/reconciliation/process — Run reconciliation for a billing period
 * GET  /api/reconciliation/process — Get a specific reconciliation run
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { runReconciliation, getReconciliationRun } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const processSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  billingPeriodId: z.guid().optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'commercial_reporting',
    body: processSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Reconciliation'],
      summary: 'Run reconciliation for a billing period',
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
      billingPeriodId: body.billingPeriodId,
      runBy: userId ?? undefined,
    });
    return { ...result };
  },
);

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'commercial_reporting',
    openapi: {
      tags: ['Reconciliation'],
      summary: 'Get reconciliation run details',
    },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view', requiresLedger: true }),
    );
    const url = new URL(request.url);
    const runId = url.searchParams.get('runId');
    if (!runId) throw ApiError.badRequest('runId query parameter is required');
    if (!z.guid().safeParse(runId).success) throw ApiError.badRequest('runId must be a valid identifier');
    // The lookup is bound to the caller's organization: another organization's run reads as not found.
    const run = await getReconciliationRun(runId, organizationId);
    if (!run) throw ApiError.notFound('Reconciliation run not found');
    return run;
  },
);
