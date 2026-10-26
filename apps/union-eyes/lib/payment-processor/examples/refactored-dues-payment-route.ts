/**
 * Dues Payment Processing API - REFACTORED WITH PAYMENT PROCESSOR ABSTRACTION
 * 
 * This is an example of how the dues payment route should be refactored
 * to use the payment processor abstraction layer
 * 
 * Benefits:
 * - Easy to add new payment processors
 * - Consistent interface across all processors
 * - Better error handling and logging
 * - Processor-agnostic business logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { duesTransactions } from '@/db/schema/domains/finance';
import { profilesTable } from '@/db/schema/domains/member';
import { organizations } from '@/db/schema-organizations';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { generateReceipt } from '@/lib/receipt-generator';
import { z } from 'zod';
import { getUserContext, withRoleAuth } from '@/lib/api-auth-guard';
import { Decimal } from 'decimal.js';

import { 
  standardErrorResponse, 
  ErrorCode 
} from '@/lib/api/standardized-responses';

// Import payment processor abstraction
import { 
  PaymentProcessorFactory,
  PaymentProcessorType,
  PaymentIntentError,
} from '@/lib/payment-processor';

const portalDuesPaySchema = z.object({
  transactionIds: z.array(z.guid()),
  paymentMethodId: z.string(),
  processorType: z.enum(['stripe', 'whop', 'paypal', 'square', 'manual']).optional(),
});

export const POST = withRoleAuth('member', async (request: NextRequest, _context) => {
  void _context;

  const userContext = await getUserContext();
  if (!userContext) {
    return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Authentication required'
    );
  }

  const { userId, organizationId } = userContext;

    try {
      // Rate limiting
      const rateLimitResult = await checkRateLimit(userId, RATE_LIMITS.DUES_PAYMENT);
      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded for dues payment', {
          limit: rateLimitResult.limit,
          resetIn: rateLimitResult.resetIn,
        });
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Too many payment requests. Please try again later.',
            resetIn: rateLimitResult.resetIn 
          },
          { 
            status: 429,
            headers: createRateLimitHeaders(rateLimitResult),
          }
        );
      }

      const body = await request.json();
      
      // Validate request body
      const validation = portalDuesPaySchema.safeParse(body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid request data',
          validation.error.issues
        );
      }
      
      const { transactionIds, paymentMethodId, processorType } = validation.data;

      if (transactionIds.length === 0) {
        return standardErrorResponse(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Transaction IDs required'
        );
      }

      // Fetch transactions
      const transactions = await db
        .select()
        .from(duesTransactions)
        .where(
          and(
            eq(duesTransactions.memberId, userId),
            eq(duesTransactions.status, 'pending')
          )
        );

      const selectedTransactions = transactions.filter(t => 
        transactionIds.includes(t.id)
      );

      if (selectedTransactions.length === 0) {
        return standardErrorResponse(
          ErrorCode.RESOURCE_NOT_FOUND,
          'No valid transactions found'
        );
      }

      // Calculate total amount
      const totalAmount = selectedTransactions.reduce(
        (sum, t) => sum.add(new Decimal(t.totalAmount)), 
        new Decimal(0)
      );

      // Get payment processor
      const factory = PaymentProcessorFactory.getInstance();
      const processor = factory.getProcessor(
        processorType ? processorType as PaymentProcessorType : undefined
      );

      logger.info('Processing payment with processor', {
        processor: processor.type,
        userId,
        transactionCount: selectedTransactions.length,
        totalAmount: totalAmount.toString(),
      });

      // Create payment intent using abstraction
      let paymentIntent;
      try {
        paymentIntent = await processor.createPaymentIntent({
          amount: totalAmount,
          currency: 'cad',
          paymentMethodId,
          confirm: true,
          metadata: {
            userId,
            transactionIds: transactionIds.join(','),
            type: 'dues_payment',
            organizationId,
          },
          description: `Dues payment for ${selectedTransactions.length} period(s)`,
        });
      } catch (error) {
        if (error instanceof PaymentIntentError) {
          logger.error('Payment intent creation failed', error);
          return standardErrorResponse(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            `Payment failed: ${error.message}`,
            { processor: error.processor }
          );
        }
        throw error;
      }

      // Check payment succeeded
      if (paymentIntent.status === 'succeeded') {
        // Fetch member profile
        const [profile] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.userId, userId));
        
        // Get organization
        const organizationId = selectedTransactions[0].organizationId;
        const [organization] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId));

        // Update transactions as paid and generate receipts
        const receipts: string[] = [];
        
        for (const transaction of selectedTransactions) {
          // Generate receipt
          const receiptUrl = await generateReceipt({
            transactionId: transaction.id,
            memberId: userId,
            memberName: profile?.email || userId,
            organizationName: organization?.name || 'Union',
            duesAmount: Number(transaction.duesAmount),
            copeAmount: Number(transaction.copeAmount),
            pacAmount: Number(transaction.pacAmount),
            strikeFundAmount: Number(transaction.strikeFundAmount),
            lateFeeAmount: Number(transaction.lateFeeAmount),
            totalAmount: Number(transaction.totalAmount),
            paidDate: new Date(),
            paymentReference: paymentIntent.processorPaymentId,
            periodStart: new Date(transaction.periodStart),
            periodEnd: new Date(transaction.periodEnd),
          });

          receipts.push(receiptUrl);

          // Update transaction with processor info
          await db
            .update(duesTransactions)
            .set({
              status: 'paid',
              paidDate: new Date(),
              paymentMethod: processor.type, // Use processor type
              paymentReference: paymentIntent.processorPaymentId,
              processorType: processor.type, // NEW: Store processor type
              processorPaymentId: paymentIntent.processorPaymentId, // NEW: Store processor payment ID
              processorCustomerId: paymentIntent.customerId, // NEW: Store customer ID
              receiptUrl,
              updatedAt: new Date(),
            })
            .where(and(eq(duesTransactions.id, transaction.id), eq(duesTransactions.organizationId, transaction.organizationId)));
        }

        logger.info('Dues payment processed successfully', {
          userId,
          processor: processor.type,
          transactionCount: selectedTransactions.length,
          totalAmount: totalAmount.toString(),
          paymentIntentId: paymentIntent.id,
          receiptsGenerated: receipts.length,
        });

        return NextResponse.json({
          success: true,
          processor: processor.type,
          paymentIntentId: paymentIntent.id,
          amount: totalAmount.toString(),
          transactionsPaid: selectedTransactions.length,
          receipts,
        }, {
          headers: createRateLimitHeaders(rateLimitResult),
        });
      } else {
        logger.warn('Payment intent not succeeded', {
          userId,
          processor: processor.type,
          status: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
        });
        
        return NextResponse.json({
          error: 'Payment failed',
          status: paymentIntent.status,
          processor: processor.type,
        }, { 
          status: 400,
          headers: createRateLimitHeaders(rateLimitResult),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process dues payment', error instanceof Error ? error : new Error(errorMessage), {
        userId: userId,
      });
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Internal server error',
        { error: errorMessage }
      );
    }
});
