/**
 * POST /api/cron/observability-alerts
 *
 * Executes real-time observability checks and delivers each alert to the organization's administrators' inbox.
 *
 * A signal that could not be delivered (no administrator to notify, or the write failed) answers 500 with the organization and
 * signal named, so a missed alert is a visibly failed run; the alerts that were delivered are kept.
 */

import { withApi } from '@/lib/api/framework';
import { runRealtimeObservabilitySweep } from '@/services/observability/realtime-alerting-service';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { jobResponse } from '@/lib/operations/job-result';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron', 'Observability'],
      summary: 'Run real-time observability alert sweep',
    },
  },
  async () => {
    const result = await runRealtimeObservabilitySweep();

    await auditLog({
      eventType: AuditEventType.SYSTEM_SECURITY_ALERT,
      severity: result.emitted > 0 || result.failures.length > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
      resource: 'observability_alerts_cron',
      action: 'observability_sweep',
      details: {
        emitted: result.emitted,
        alreadyAlerted: result.alreadyAlerted,
        failed: result.failures.length,
        byKind: result.byKind,
      },
    });

    const attempted = result.emitted + result.alreadyAlerted + result.failures.length;
    return jobResponse({
      job: 'observability-alerts',
      attempted,
      succeeded: result.emitted + result.alreadyAlerted,
      failures: result.failures.map((failure) => ({ scope: `${failure.organizationId}:${failure.kind}`, reason: failure.reason })),
      details: { emitted: result.emitted, already_alerted: result.alreadyAlerted, byKind: result.byKind },
    });
  },
);
