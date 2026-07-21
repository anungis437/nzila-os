/**
 * Monthly Dues Cron Job — NOT_IMPLEMENTED
 *
 * Reality-remediation Wave 0: previously returned HTTP 200 with a
 * { status: 'not_implemented' } envelope, which caused an external
 * scheduler to record a successful invocation for a no-op. This is
 * now an explicit HTTP 501 until durable dues processing is delivered.
 *
 * Capability: UE-CRON-MONTHLY-DUES (state: NOT_IMPLEMENTED)
 * Owner: platform-eng
 * Runbook: docs/union-eyes/reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron'],
      summary: 'Monthly dues processing — NOT_IMPLEMENTED (returns HTTP 501)',
    },
  },
  async () => {
    throw ApiError.notImplemented(
      'Monthly dues cron is not implemented. Capability UE-CRON-MONTHLY-DUES is registered as NOT_IMPLEMENTED pending Wave 5 (cron/queue convergence) and Wave 7 (financial integrity).',
    );
  },
);
