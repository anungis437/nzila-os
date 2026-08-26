/**
 * Process Notifications Cron Job — NOT_IMPLEMENTED
 *
 * Reality-remediation Wave 0: converted from HTTP 200 no-op to HTTP 501.
 *
 * Capability: UE-CRON-PROCESS-NOTIFICATIONS (state: NOT_IMPLEMENTED)
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
      summary: 'Process notifications — NOT_IMPLEMENTED (returns HTTP 501)',
    },
  },
  async () => {
    throw ApiError.notImplemented(
      'Process-notifications cron is not implemented. Capability UE-CRON-PROCESS-NOTIFICATIONS is registered as NOT_IMPLEMENTED pending Wave 4 (queue/worker convergence) and Wave 5 (communications truth).',
    );
  },
);
