/**
 * POST /api/dues/setup-intent — Create a Stripe setup intent for saving payment method
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const setupIntentSchema = z.object({
  customerId: z.string().optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    body: setupIntentSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: 'Create a Stripe setup intent for saving a payment method',
    },
  },
  async ({ body, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const setupIntent = await stripe.setupIntents.create({
      metadata: {
        organization_id: organizationId,
        source: 'union-eyes-dues',
      },
      ...(body.customerId ? { customer: body.customerId } : {}),
    });

    return {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    };
  },
);
