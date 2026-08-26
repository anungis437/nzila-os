/**
 * Scheduled Reports Cron Job — NOT_IMPLEMENTED
 *
 * Reality-remediation Wave 0: converted from HTTP 200 no-op to HTTP 501.
 *
 * Capability: UE-CRON-SCHEDULED-REPORTS (state: NOT_IMPLEMENTED)
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
      summary: 'Scheduled reports — NOT_IMPLEMENTED (returns HTTP 501)',
    },
  },
  async () => {
    throw ApiError.notImplemented(
      'Scheduled-reports cron is not implemented. Capability UE-CRON-SCHEDULED-REPORTS is registered as NOT_IMPLEMENTED pending Wave 8 (analytics/reporting truth).',
    );
  },
);
