/**
 * POST /api/billing/replay-invoice
 * Deterministically recompute invoice totals from stored line items and lineage metadata.
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { replayInvoiceDeterministically } from '@/services/platform-economics';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';

const bodySchema = z.object({
  invoiceId: z.guid(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'secretary_treasurer' },
    requireOrg: true,
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
    if (!userId) throw ApiError.badRequest('User context required');
    // Replay discloses an invoice's billed lineage, so the access record is mandatory and is written in the same tenant transaction as
    // the read, before anything is returned: if it cannot be written the lineage is not released.
    return withRLSContext({ organizationId, userId }, async (tx) => {
      // A finance role title does not authorize invoice lineage disclosure.
      // Principal financial authority is checked in the same transaction as
      // the read and its mandatory access audit, before any invoice lookup.
      await requireLiveFinancialMandate(tx, {
        organizationId,
        userId,
        action: 'finance:view',
        requiresLedger: true,
      });
      const replay = await replayInvoiceDeterministically(body.invoiceId, organizationId, tx);
      if (!replay) {
        return {
          found: false,
          invoiceId: body.invoiceId,
        };
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'billing.invoice.replay',
        resourceType: 'platform_invoice',
        resourceId: body.invoiceId,
        details: {
          isMatch: replay.recomputed.isMatch,
          pricingRuleVersion: replay.pricingRuleVersion,
        },
      });

      return {
        found: true,
        replay,
      };
    });
  },
);
