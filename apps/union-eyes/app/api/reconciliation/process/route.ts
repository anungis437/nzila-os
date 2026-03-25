/**
 * POST /api/reconciliation/process — Run reconciliation for a billing period
 * GET  /api/reconciliation/process — Get a specific reconciliation run
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { runReconciliation, getReconciliationRun } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const processSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  billingPeriodId: z.string().uuid().optional(),
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
    if (!organizationId) throw ApiError.badRequest('Organization context required');
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
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const runId = url.searchParams.get('runId');
    if (!runId) throw ApiError.badRequest('runId query parameter is required');
    const run = await getReconciliationRun(runId);
    if (!run) throw ApiError.notFound('Reconciliation run not found');
    return run;
  },
);
