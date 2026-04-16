/**
 * POST /api/cron/billing-lifecycle
 *
 * Automates monthly billing lifecycle:
 * - ensure current billing period exists
 * - generate invoices for active subscriptions
 * - finalize draft invoices
 * - mark unpaid overdue invoices as failed lifecycle state
 */

import { withApi } from '@/lib/api/framework';
import { runBillingLifecycleAutomation } from '@/services/platform-economics';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron', 'Billing'],
      summary: 'Run automated billing lifecycle scheduler',
    },
  },
  async () => {
    const result = await runBillingLifecycleAutomation(new Date(), 'system:billing-lifecycle-cron');

    await auditLog({
      eventType: AuditEventType.BILLING_UPDATE,
      severity: AuditSeverity.MEDIUM,
      resource: 'billing_lifecycle_cron',
      action: 'billing_lifecycle_run',
      details: result,
    });

    return result;
  },
);
