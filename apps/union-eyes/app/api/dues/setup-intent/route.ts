/**
 * POST /api/dues/setup-intent — Create a Stripe setup intent for saving payment method
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { stripe } from '@/lib/stripe';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

export const dynamic = 'force-dynamic';

// A Stripe customer id is never taken from the caller: attaching a payment method to a customer the caller merely
// names would let one party save a method against another's account. The intent is created unattached.
const setupIntentSchema = z.object({}).passthrough();

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    body: setupIntentSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: 'Create a Stripe setup intent for saving a payment method',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    let setupIntent;
    try {
      setupIntent = await performAuditedOperation(
        { organizationId, userId, action: 'dues.setup_intent.create', resourceType: 'payment_method_setup' },
        () =>
          stripe.setupIntents.create({
            metadata: { organization_id: organizationId, source: 'union-eyes-dues' },
          }),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }

    return {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    };
  },
);
