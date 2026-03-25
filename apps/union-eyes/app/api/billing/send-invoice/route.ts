/**
 * POST /api/billing/send-invoice — Generate an invoice for a billing period
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { generateInvoice } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  billingPeriodId: z.string().uuid(),
});

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Billing'],
      summary: 'Generate an invoice for a billing period',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const invoice = await generateInvoice({
      organizationId,
      billingPeriodId: body.billingPeriodId,
      createdBy: userId ?? undefined,
    });
    return invoice;
  },
);
