/**
 * POST /api/billing/send-batch
 *
 * Generate an invoice only for the authenticated organization's authorized
 * billing period. A role title or feature entitlement is not a financial mandate.
 *
 * The current invoice service supports one active subscription per organization;
 * do not silently invoice only the first of multiple active subscriptions.
 * The service owns its invoice/ledger/audit transaction. Preflight is deliberately
 * separate: do not create an invoice before the tenant read and mandate commit.
 */
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { generateInvoice } from '@/services/platform-economics';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { orgSubscriptions, billingPeriods } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  billingPeriodId: z.guid(),
}).strict();

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'admin' },
    requireOrg: true,
    entitlement: 'financial_intelligence_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Billing'],
      summary: 'Generate an authorized invoice for the current organization',
      description: 'Requires a live principal financial execution mandate covering the organization ledger. Multiple active subscriptions are refused pending reconciliation.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Authenticated organization and principal required');

    const subscriptionCount = await withRLSContext({ organizationId, userId }, async (tx) => {
      // No billing data is read and no invoice is created until authority is proven.
      await requireLiveFinancialMandate(tx, {
        organizationId,
        userId,
        action: 'finance:execute',
        requiresLedger: true,
      });

      const [period] = await tx
        .select()
        .from(billingPeriods)
        .where(and(eq(billingPeriods.id, body.billingPeriodId), eq(billingPeriods.organizationId, organizationId)))
        .limit(1);

      if (!period || period.organizationId !== organizationId) throw ApiError.notFound('Billing period not found');
      if (period.isClosed) throw ApiError.badRequest('Cannot invoice a closed billing period');

      const subscriptions = await tx
        .select()
        .from(orgSubscriptions)
        .where(and(eq(orgSubscriptions.status, 'active'), eq(orgSubscriptions.organizationId, organizationId)));

      if (subscriptions.some((sub) => sub.organizationId !== organizationId)) {
        throw ApiError.badRequest('Subscription organization mismatch');
      }
      // generateInvoice selects the first active subscription. Refuse ambiguity,
      // rather than silently issuing an invoice for a subset of active plans.
      if (subscriptions.length > 1) {
        throw ApiError.badRequest('Multiple active subscriptions require reconciliation before invoicing');
      }
      return subscriptions.length;
    });

    if (subscriptionCount === 0) {
      return { total: 0, succeeded: 0, failed: 0, results: [] };
    }

    // The service's own transaction must commit invoice, line items, ledger and
    // audit together; propagate errors rather than reporting a false success.
    const invoice = await generateInvoice({
      organizationId,
      billingPeriodId: body.billingPeriodId,
      createdBy: userId,
    });
    return {
      total: 1,
      succeeded: 1,
      failed: 0,
      results: [{ organizationId, invoiceId: invoice.id }],
    };
  },
);
