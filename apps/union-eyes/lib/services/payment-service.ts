/**
 * Payment Service for Dues Transactions
 * Handles payment lifecycle for member dues
 * 
 * Features:
 * - Create checkout sessions (Stripe/PayPal), reading the dues in the caller's organization
 * - Handle payment success/failure (system role: the processor's webhook has no organization session)
 * - Update transaction status
 * 
 * @module lib/services/payment-service
 */

import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { withRLSContext, withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation } from '@/lib/audit/operation-audit';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
// Platform Stripe integration via @nzila/payments-stripe
import { getStripeClient } from '@nzila/payments-stripe';
import { sendPaymentConfirmation, sendPaymentFailure } from '@/lib/services/dues-notifications';
import { toCents } from '@/lib/decimal-safe';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateCheckoutSessionParams {
  transactionId: string;
  returnUrl: string;
  cancelUrl: string;
  processorType?: 'stripe' | 'paypal';
  /**
   * The authenticated caller and the organization they act in. A checkout is created only for the member the dues
   * belong to, and only for a transaction of that organization.
   */
  actor: { userId: string; organizationId: string };
}

/** A refusal the route reports as 403 (not the payer) or 409 (not payable). */
export class PaymentAuthorityError extends Error {
  constructor(readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT', message: string) {
    super(message);
    this.name = 'PaymentAuthorityError';
  }
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  transactionId: string;
  amount: string;
  currency: string;
}

export interface ProcessPaymentParams {
  transactionId: string;
  processorPaymentId: string;
  processorType: 'stripe' | 'paypal';
  amount: string;
  paymentMethod?: string;
}

export interface PaymentSuccessParams {
  transactionId: string;
  processorPaymentId: string;
  processorType: 'stripe' | 'paypal';
  amount: string;
  paymentMethod?: string;
  receiptUrl?: string;
}

export interface PaymentFailureParams {
  transactionId: string;
  processorPaymentId?: string;
  processorType: 'stripe' | 'paypal';
  errorMessage: string;
  errorCode?: string;
}

// =============================================================================
// PAYMENT SERVICE
// =============================================================================

export class PaymentService {
  /**
   * Create a Stripe checkout session for a dues transaction
   */
  static async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<CheckoutSessionResult> {
    const { transactionId, returnUrl, cancelUrl, processorType = 'stripe', actor } = params;

    try {
      logger.info('Creating checkout session', { transactionId, processorType });

      // The reads run in the caller's organization (row-level security shows nothing of another organization's
      // dues) and end before the processor is called: no transaction is held across the network call.
      const found = await withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
        const [txn] = await tx
          .select()
          .from(duesTransactions)
          .where(and(eq(duesTransactions.id, transactionId), eq(duesTransactions.organizationId, actor.organizationId)))
          .limit(1);
        if (!txn) return null;

        // A checkout session lets the holder pay (and receive the receipt for) this transaction, and it names the
        // member and the amount. Only the member the dues belong to may start one; anyone else cannot tell that the
        // transaction exists. `member_id` is text, so the comparison is made on the text of the member's id.
        const [payer] = await tx
          .select({ id: organizationMembers.id, name: organizationMembers.name, email: organizationMembers.email })
          .from(organizationMembers)
          .where(
            and(
              eq(sql`${organizationMembers.id}::text`, txn.memberId),
              eq(organizationMembers.userId, actor.userId),
              eq(organizationMembers.organizationId, txn.organizationId),
            ),
          )
          .limit(1);
        return payer ? { txn, payer } : null;
      });

      if (!found) throw new PaymentAuthorityError('NOT_FOUND', 'Transaction not found');
      const { txn, payer: member } = found;

      // Validate transaction status
      if (txn.status !== 'pending' && txn.status !== 'overdue') {
        throw new PaymentAuthorityError('CONFLICT', `Transaction status is ${txn.status}, cannot create checkout session`);
      }

      if (processorType === 'stripe') {
        // A checkout session is created at the processor, outside the database: the intent is recorded first.
        return await performAuditedOperation(
          {
            organizationId: txn.organizationId,
            userId: actor.userId,
            action: 'dues.checkout.create',
            resourceType: 'dues_transactions',
            resourceId: transactionId,
            details: { amount: txn.totalAmount, processorType },
          },
          () =>
            this.createStripeCheckoutSession({
              transactionId,
              amount: txn.totalAmount,
              currency: 'cad',
              memberEmail: member.email,
              memberName: member.name,
              returnUrl,
              cancelUrl,
              duesBreakdown: {
                dues: txn.duesAmount,
                cope: txn.copeAmount || '0.00',
                pac: txn.pacAmount || '0.00',
                strikeFund: txn.strikeFundAmount || '0.00',
              },
            }),
        );
      } else {
        // PayPal implementation (future)
        throw new Error('PayPal checkout not yet implemented');
      }
    } catch (error) {
      logger.error('Error creating checkout session', { error, transactionId });
      throw error;
    }
  }

  /**
   * Create Stripe checkout session
   */
  private static async createStripeCheckoutSession(params: {
    transactionId: string;
    amount: string;
    currency: string;
    memberEmail: string;
    memberName: string;
    returnUrl: string;
    cancelUrl: string;
    duesBreakdown: {
      dues: string;
      cope: string;
      pac: string;
      strikeFund: string;
    };
  }): Promise<CheckoutSessionResult> {
    const stripe = getStripeClient();

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = toCents(params.amount);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'acss_debit'],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: amountInCents,
            product_data: {
              name: 'Union Dues Payment',
              description: `Dues: $${params.duesBreakdown.dues} | COPE: $${params.duesBreakdown.cope} | PAC: $${params.duesBreakdown.pac} | Strike Fund: $${params.duesBreakdown.strikeFund}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${params.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl,
      customer_email: params.memberEmail,
      client_reference_id: params.transactionId,
      metadata: {
        transactionId: params.transactionId,
        memberName: params.memberName,
        duesAmount: params.duesBreakdown.dues,
        copeAmount: params.duesBreakdown.cope,
        pacAmount: params.duesBreakdown.pac,
        strikeFundAmount: params.duesBreakdown.strikeFund,
      },
    });

    logger.info('Stripe checkout session created', {
      sessionId: session.id,
      transactionId: params.transactionId,
      amount: params.amount,
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url || '',
      transactionId: params.transactionId,
      amount: params.amount,
      currency: params.currency,
    };
  }

  /**
   * Handle successful payment
   */
  static async handlePaymentSuccess(
    params: PaymentSuccessParams
  ): Promise<void> {
    const {
      transactionId,
      processorPaymentId,
      processorType,
      amount,
      paymentMethod,
      receiptUrl,
    } = params;

    try {
      logger.info('Handling payment success', {
        transactionId,
        processorPaymentId,
        processorType,
        amount,
      });

      // The status change and its audit commit together. The processor's amount must be the amount on record, and
      // only a payable transaction becomes paid: a replay of the same payment is a no-op, and a different payment
      // for an already-paid transaction is refused rather than overwriting the first.
      const outcome = await withSystemContext(async (tx) => {
        const [current] = await tx.select().from(duesTransactions).where(eq(duesTransactions.id, transactionId)).limit(1);
        if (!current) throw new PaymentAuthorityError('NOT_FOUND', 'Transaction not found');
        if (current.status === 'paid') {
          if (current.processorPaymentId === processorPaymentId) return 'replay' as const;
          throw new PaymentAuthorityError('CONFLICT', 'Transaction is already paid by a different payment');
        }
        if (Number(amount) !== Number(current.totalAmount)) {
          throw new PaymentAuthorityError('CONFLICT', 'The paid amount differs from the amount on record');
        }
        const [paid] = await tx
          .update(duesTransactions)
          .set({
            status: 'paid',
            paidDate: new Date(),
            processorType,
            processorPaymentId,
            paymentMethod: paymentMethod || 'card',
            receiptUrl,
            updatedAt: new Date(),
          })
          .where(and(eq(duesTransactions.id, transactionId), inArray(duesTransactions.status, ['pending', 'overdue', 'partial']), eq(duesTransactions.organizationId, current.organizationId)))
          .returning({ id: duesTransactions.id });
        if (!paid) throw new PaymentAuthorityError('CONFLICT', 'Transaction is no longer payable');
        await persistAtomicAudit(tx as unknown as RLSTx, {
          organizationId: current.organizationId,
          userId: `system:payment-${processorType}`,
          action: 'dues.payment.received',
          resourceType: 'dues_transactions',
          resourceId: transactionId,
          details: { amount, processorType, processorPaymentId, from: current.status },
        });
        return 'paid' as const;
      });
      if (outcome === 'replay') return;

      logger.info('Payment success processed', {
        transactionId,
        processorPaymentId,
      });

      // Send payment confirmation notification
      await sendPaymentConfirmation(transactionId);
    } catch (error) {
      logger.error('Error handling payment success', {
        error,
        transactionId,
        processorPaymentId,
      });
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  static async handlePaymentFailure(
    params: PaymentFailureParams
  ): Promise<void> {
    const {
      transactionId,
      processorPaymentId,
      processorType,
      errorMessage,
      errorCode,
    } = params;

    try {
      logger.error('Handling payment failure', {
        transactionId,
        processorPaymentId,
        processorType,
        errorMessage,
        errorCode,
      });

      // A failure is recorded against a payable transaction only: a late failure notice must not undo a payment that
      // succeeded. The record and its audit commit together.
      const failureCount = await withSystemContext(async (tx) => {
        const [txn] = await tx.select().from(duesTransactions).where(eq(duesTransactions.id, transactionId)).limit(1);
        if (!txn) throw new PaymentAuthorityError('NOT_FOUND', 'Transaction not found');
        if (txn.status === 'paid') throw new PaymentAuthorityError('CONFLICT', 'Transaction is already paid; the failure was not applied');

        const metadata = (txn.metadata as Record<string, unknown>) || {};
        metadata.lastFailure = {
          date: new Date().toISOString(),
          errorMessage,
          errorCode,
          processorPaymentId,
        };
        metadata.failureCount = ((metadata.failureCount as number) || 0) + 1;

        const [updated] = await tx
          .update(duesTransactions)
          .set({
            status: 'pending', // Keep pending for retry
            processorPaymentId: processorPaymentId || null,
            metadata,
            updatedAt: new Date(),
          })
          .where(and(eq(duesTransactions.id, transactionId), inArray(duesTransactions.status, ['pending', 'overdue', 'partial']), eq(duesTransactions.organizationId, txn.organizationId)))
          .returning({ id: duesTransactions.id });
        if (!updated) throw new PaymentAuthorityError('CONFLICT', 'Transaction is no longer payable; the failure was not applied');
        await persistAtomicAudit(tx as unknown as RLSTx, {
          organizationId: txn.organizationId,
          userId: `system:payment-${processorType}`,
          action: 'dues.payment.failed',
          resourceType: 'dues_transactions',
          resourceId: transactionId,
          details: { errorCode: errorCode ?? null, processorPaymentId: processorPaymentId ?? null, failureCount: metadata.failureCount },
        });
        return metadata.failureCount as number;
      });

      logger.info('Payment failure processed', {
        transactionId,
        failureCount,
      });

      // Send payment failure notification
      await sendPaymentFailure(transactionId, errorMessage, false);
    } catch (error) {
      logger.error('Error handling payment failure', {
        error,
        transactionId,
      });
      throw error;
    }
  }
}
