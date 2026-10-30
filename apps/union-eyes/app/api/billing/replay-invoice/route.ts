/**
 * POST /api/billing/replay-invoice
 * Deterministically recompute invoice totals from stored line items and lineage metadata.
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { replayInvoiceDeterministically } from '@/services/platform-economics';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

const bodySchema = z.object({
  invoiceId: z.guid(),
});

export const POST = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.FINANCIAL_READ,
    openapi: {
      tags: ['Billing'],
      summary: 'Replay invoice deterministically from billed lineage',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const replay = await replayInvoiceDeterministically(body.invoiceId, organizationId);
    if (!replay) {
      return {
        found: false,
        invoiceId: body.invoiceId,
      };
    }

    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.MEDIUM,
      userId: userId ?? undefined,
      organizationId: organizationId ?? undefined,
      resource: 'platform_invoice',
      resourceId: body.invoiceId,
      action: 'invoice_replay',
      details: {
        isMatch: replay.recomputed.isMatch,
        pricingRuleVersion: replay.pricingRuleVersion,
      },
    });

    return {
      found: true,
      replay,
    };
  },
);
