/**
 * Payment Checkout API
 * Create checkout session for dues payment
 * 
 * POST /api/payments/checkout/create - Create checkout session
 * 
 * @module app/api/payments/checkout/create
 */

import { PaymentService, PaymentAuthorityError } from '@/lib/services/payment-service';
import { OperationAuditError } from '@/lib/audit/operation-audit';
import { isMemberDuesPaymentEnabled } from '@/lib/dues/member-dues-flag';
import { withApi, RATE_LIMITS } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { getUnionEyesSiteTopology } from '@/lib/site-topology';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const checkoutSchema = z.object({
  transactionId: z.guid('Invalid transaction ID'),
  returnUrl: z.string().url('Invalid return URL').max(2048),
  cancelUrl: z.string().url('Invalid cancel URL').max(2048),
  processorType: z.enum(['stripe', 'paypal']).optional().default('stripe'),
});

// The processor sends the payer to these addresses after the checkout: only an address of this application is accepted, not any URL (`javascript:`
// and other hosts parse as URLs too).
function isApplicationAddress(value: string, requestOrigin: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return url.origin === requestOrigin || url.origin === new URL(getUnionEyesSiteTopology().appUrl).origin;
  } catch {
    return false;
  }
}

// Any authenticated member of the organization may start a checkout for their own dues: the service reads the transaction in the caller's organization
// (its own tenant transaction, ended before the processor is called, so the route does not set `rlsOrgContext`) and refuses everyone but the payer.
export const POST = withApi(
  {
    auth: { required: true },
    body: checkoutSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['Payments'], summary: 'Create a checkout session for the signed-in member\'s dues transaction' },
  },
  async ({ request, userId, organizationId, body }) => {
    if (!isMemberDuesPaymentEnabled()) {
      return NextResponse.json(
        { code: 'NOT_IMPLEMENTED', message: 'Member dues payment is not enabled in this deployment' },
        { status: 501 },
      );
    }

    const { transactionId, returnUrl, cancelUrl, processorType } = body;

    const requestOrigin = request.nextUrl.origin;
    if (!isApplicationAddress(returnUrl, requestOrigin) || !isApplicationAddress(cancelUrl, requestOrigin)) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'returnUrl and cancelUrl must be addresses of this application');
    }
    try {
      logger.info('Creating checkout session', {
        transactionId,
        processorType,
      });

      const result = await PaymentService.createCheckoutSession({
        transactionId,
        returnUrl,
        cancelUrl,
        processorType,
        actor: { userId: userId!, organizationId: organizationId! },
      });

      logger.info('Checkout session created', {
        sessionId: result.sessionId,
        transactionId,
      });

      return standardSuccessResponse({
        sessionId: result.sessionId,
        checkoutUrl: result.checkoutUrl,
        transactionId: result.transactionId,
        amount: result.amount,
        currency: result.currency,
      });
    } catch (error) {
      if (error instanceof PaymentAuthorityError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.code === 'CONFLICT' ? 409 : 404 },
        );
      }
      if (error instanceof OperationAuditError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      logger.error('Error creating checkout session', { error });

      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to create checkout session'
      );
    }
  },
);
