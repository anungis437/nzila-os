/**
 * POST /api/billing/send-batch — Generate invoices for active subscriptions in the caller organization
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { generateInvoice } from '@/services/platform-economics';
import { db } from '@/db';
import { orgSubscriptions, billingPeriods } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  billingPeriodId: z.guid(),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'financial_intelligence_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Billing'],
      summary: 'Batch-generate invoices for active subscriptions of the current organization',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    // Verify billing period ownership
    const [period] = await db
      .select()
      .from(billingPeriods)
      .where(and(eq(billingPeriods.id, body.billingPeriodId), eq(billingPeriods.organizationId, organizationId)))
      .limit(1);

    if (!period || period.organizationId !== organizationId) throw ApiError.notFound('Billing period not found');

    // Get all active subscriptions
    const subs = await db
      .select()
      .from(orgSubscriptions)
      .where(and(eq(orgSubscriptions.status, 'active'), eq(orgSubscriptions.organizationId, organizationId)));

    // Validate the entire batch before the first mutation; a foreign row later
    // in the result set must not leave earlier invoices partially generated.
    if (subs.some((sub) => sub.organizationId !== organizationId)) {
      throw ApiError.badRequest('Subscription organization mismatch');
    }

    const results: Array<{ organizationId: string; invoiceId?: string; error?: string }> = [];

    for (const sub of subs) {
      try {
        const invoice = await generateInvoice({
          organizationId: sub.organizationId,
          billingPeriodId: body.billingPeriodId,
          createdBy: userId ?? undefined,
        });
        results.push({ organizationId: sub.organizationId, invoiceId: invoice.id });
      } catch (err) {
        results.push({
          organizationId: sub.organizationId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      total: subs.length,
      succeeded: results.filter((r) => r.invoiceId).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  },
);
