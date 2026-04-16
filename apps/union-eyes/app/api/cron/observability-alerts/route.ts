/**
 * POST /api/cron/observability-alerts
 *
 * Executes real-time observability checks and emits alert executions + notifications.
 */

import { withApi } from '@/lib/api/framework';
import { runRealtimeObservabilitySweep } from '@/services/observability/realtime-alerting-service';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

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
      severity: result.emitted > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
      resource: 'observability_alerts_cron',
      action: 'observability_sweep',
      details: {
        emitted: result.emitted,
        byKind: result.byKind,
      },
    });

    return {
      timestamp: new Date().toISOString(),
      ...result,
    };
  },
);
