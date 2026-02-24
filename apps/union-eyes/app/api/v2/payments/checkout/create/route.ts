/**
 * POST /api/payments/checkout/create
 * Migrated to withApi() framework
 */
import { PaymentService } from '@/lib/services/payment-service';
import { logger } from '@/lib/logger';

 
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const checkoutSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
  returnUrl: z.string().url('Invalid return URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  processorType: z.enum(['stripe', 'paypal']).optional().default('stripe'),
});

export const POST = withApi(
  {
    auth: { required: false },
    body: checkoutSchema,
    openapi: {
      tags: ['Payments'],
      summary: 'POST create',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query, params: _params }) => {
        const { transactionId, returnUrl, cancelUrl, processorType } = body;

        logger.info('Creating checkout session', {
          transactionId,
          processorType,
        });
        // Create checkout session
        const result = await PaymentService.createCheckoutSession({
          transactionId,
          returnUrl,
          cancelUrl,
          processorType,
        });
        logger.info('Checkout session created', {
          sessionId: result.sessionId,
          transactionId,
        });
        return {
          sessionId: result.sessionId,
          checkoutUrl: result.checkoutUrl,
          transactionId: result.transactionId,
          amount: result.amount,
          currency: result.currency,
        };
  },
);
