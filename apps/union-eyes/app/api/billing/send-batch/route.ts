/**
 * POST /api/billing/send-batch — Generate invoices for all active subscriptions in a billing period
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { generateInvoice } from '@/services/platform-economics';
import { db } from '@/db';
import { orgSubscriptions, billingPeriods } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  billingPeriodId: z.string().uuid(),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'financial_intelligence_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Billing'],
      summary: 'Batch-generate invoices for all active subscriptions in a billing period',
    },
  },
  async ({ body, userId }) => {
    // Verify billing period exists
    const [period] = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.id, body.billingPeriodId))
      .limit(1);

    if (!period) throw ApiError.notFound('Billing period not found');

    // Get all active subscriptions
    const subs = await db
      .select()
      .from(orgSubscriptions)
      .where(eq(orgSubscriptions.status, 'active'));

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
