/**
 * Daily Analytics Metrics Cron Job
 *
 * Capability: `UE-CRON-DAILY-METRICS` — see
 * `apps/union-eyes/lib/reality/capability-registry.ts`.
 *
 * Current state: `NOT_IMPLEMENTED`. The prior implementation returned a
 * literal `{ status: 'healthy' }` with no work performed, which the
 * anti-theatre scanner correctly flagged as fabricated readiness.
 * Until the analytics collector is designed and persisted, this endpoint
 * responds with HTTP 501 (`not_implemented`) via `ApiError.notImplemented()`.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron'],
      summary: 'Daily analytics metrics collection (not implemented)',
    },
  },
  async () => {
    throw ApiError.notImplemented(
      'Daily analytics metrics collection is not implemented. See docs/union-eyes/reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md finding F-cron-daily-metrics.',
    );
  },
);
