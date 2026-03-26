/**
 * POST /api/dues/create-payment-intent — Create a Stripe payment intent for dues
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const paymentIntentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().length(3).default('cad'),
  invoiceId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    body: paymentIntentSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: 'Create a Stripe payment intent for dues payment',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: body.amount,
      currency: body.currency,
      metadata: {
        organization_id: organizationId,
        invoice_id: body.invoiceId ?? '',
        user_id: userId ?? '',
        source: 'union-eyes-dues',
      },
      description: body.description ?? `Dues payment for org ${organizationId}`,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  },
);
