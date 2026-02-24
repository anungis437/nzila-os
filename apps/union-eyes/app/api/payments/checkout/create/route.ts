/**
 * Payment Checkout API
 * Create checkout session for dues payment
 * 
 * POST /api/payments/checkout/create - Create checkout session
 * 
 * @module app/api/payments/checkout/create
 */

import { NextRequest } from 'next/server';
import { PaymentService } from '@/lib/services/payment-service';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const checkoutSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
  returnUrl: z.string().url('Invalid return URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  processorType: z.enum(['stripe', 'paypal']).optional().default('stripe'),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }

    const { transactionId, returnUrl, cancelUrl, processorType } = validation.data;

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

    return standardSuccessResponse({
      sessionId: result.sessionId,
      checkoutUrl: result.checkoutUrl,
      transactionId: result.transactionId,
      amount: result.amount,
      currency: result.currency,
    });
  } catch (error) {
    logger.error('Error creating checkout session', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to create checkout session'
    );
  }
}
