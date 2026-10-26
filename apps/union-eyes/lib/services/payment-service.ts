/**
 * Payment Service for Dues Transactions
 * Handles payment lifecycle for member dues
 * 
 * Features:
 * - Create checkout sessions (Stripe/PayPal)
 * - Process payments
 * - Handle payment success/failure
 * - Generate receipts
 * - Update transaction status
 * 
 * @module lib/services/payment-service
 */

import { db } from '@/db';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation } from '@/lib/audit/operation-audit';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { Document, Page, StyleSheet, Text, pdf } from '@react-pdf/renderer';
import { Readable } from 'node:stream';
import React from 'react';
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
  /** The authenticated caller. A checkout is created only for the member the dues belong to. */
  actor: { userId: string };
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

export interface ReceiptData {
  transactionId: string;
  receiptUrl: string;
  receiptNumber: string;
  paidDate: Date;
  amount: string;
  memberName: string;
  memberEmail: string;
  organizationName: string;
}

function isReadable(value: any): value is Readable {
  return value instanceof Readable;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
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

      // Get transaction details
      const transaction = await db
        .select()
        .from(duesTransactions)
        .where(eq(duesTransactions.id, transactionId))
        .limit(1);

      if (!transaction || transaction.length === 0) {
        throw new PaymentAuthorityError('NOT_FOUND', 'Transaction not found');
      }

      const txn = transaction[0];

      // A checkout session lets the holder pay (and receive the receipt for) this transaction, and it names the
      // member and the amount. Only the member the dues belong to may start one; anyone else cannot tell that the
      // transaction exists.
      const [payer] = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.id, txn.memberId),
            eq(organizationMembers.userId, actor.userId),
            eq(organizationMembers.organizationId, txn.organizationId),
          ),
        )
        .limit(1);
      if (!payer) throw new PaymentAuthorityError('NOT_FOUND', 'Transaction not found');

      // Validate transaction status
      if (txn.status !== 'pending' && txn.status !== 'overdue') {
        throw new PaymentAuthorityError('CONFLICT', `Transaction status is ${txn.status}, cannot create checkout session`);
      }

      // Get member details
      const member = await db
        .select({
          name: organizationMembers.name,
          email: organizationMembers.email,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, txn.memberId))
        .limit(1);

      if (!member || member.length === 0) {
        throw new Error(`Member not found: ${txn.memberId}`);
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
              memberEmail: member[0].email,
              memberName: member[0].name,
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

  private static async generateReceiptPdfUrl(params: {
    receiptNumber: string;
    memberName: string;
    memberEmail: string;
    organizationName: string;
    amount: string;
    currency: string;
    paidDate: Date;
  }): Promise<string> {
    const styles = StyleSheet.create({
      page: { padding: 32, fontSize: 12 },
      title: { fontSize: 18, marginBottom: 12 },
      section: { marginBottom: 8 },
      label: { fontSize: 10, color: '#555' },
      value: { fontSize: 12 },
    });

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.title }, 'Payment Receipt'),
        React.createElement(Text, { style: styles.section }, `Organization: ${params.organizationName}`),
        React.createElement(Text, { style: styles.section }, `Receipt Number: ${params.receiptNumber}`),
        React.createElement(Text, { style: styles.section }, `Paid Date: ${params.paidDate.toLocaleDateString()}`),
        React.createElement(Text, { style: styles.label }, 'Member'),
        React.createElement(Text, { style: styles.value }, params.memberName),
        React.createElement(Text, { style: styles.value }, params.memberEmail),
        React.createElement(Text, { style: styles.label }, 'Amount'),
        React.createElement(Text, { style: styles.value }, `${params.currency} ${params.amount}`)
      )
    );

    const rendered = await pdf(doc).toBuffer();
    const pdfBuffer = Buffer.isBuffer(rendered)
      ? rendered
      : rendered instanceof Uint8Array
      ? Buffer.from(rendered)
      : isReadable(rendered)
      ? await streamToBuffer(rendered)
      : Buffer.from(String(rendered));

    const base64 = pdfBuffer.toString('base64');
    return `data:application/pdf;base64,${base64}`;
  }

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

  /**
   * Generate receipt for paid transaction
   */
  static async generateReceipt(transactionId: string): Promise<ReceiptData> {
    try {
      logger.info('Generating receipt', { transactionId });

      // Get transaction with member details
      const result = await db
        .select({
          transaction: duesTransactions,
          memberName: organizationMembers.name,
          memberEmail: organizationMembers.email,
          organizationName: organizations.name,
        })
        .from(duesTransactions)
        .innerJoin(
          organizationMembers,
          eq(duesTransactions.memberId, organizationMembers.id)
        )
        .innerJoin(
          organizations,
          eq(duesTransactions.organizationId, organizations.id)
        )
        .where(eq(duesTransactions.id, transactionId))
        .limit(1);

      if (!result || result.length === 0) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      const { transaction, memberName, memberEmail, organizationName } = result[0];

      if (transaction.status !== 'paid') {
        throw new Error(`Transaction not paid: ${transactionId}`);
      }

      // Generate receipt number (format: DUES-YYYYMMDD-XXXXX)
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const random = crypto.randomUUID().slice(0, 5).toUpperCase();
      const receiptNumber = `DUES-${dateStr}-${random}`;

      const receiptUrl = transaction.receiptUrl || await PaymentService.generateReceiptPdfUrl({
        receiptNumber,
        memberName,
        memberEmail,
        organizationName,
        amount: transaction.totalAmount,
        currency: 'USD',
        paidDate: transaction.paidDate || new Date(),
      });

      // Update receipt URL if not set
      if (!transaction.receiptUrl) {
        await db
          .update(duesTransactions)
          .set({
            receiptUrl,
            updatedAt: new Date(),
          })
          .where(and(eq(duesTransactions.id, transactionId), eq(duesTransactions.organizationId, transaction.organizationId)));
      }

      return {
        transactionId,
        receiptUrl,
        receiptNumber,
        paidDate: transaction.paidDate || new Date(),
        amount: transaction.totalAmount,
        memberName,
        memberEmail,
        organizationName: organizationName || 'UnionEyes',
      };
    } catch (error) {
      logger.error('Error generating receipt', { error, transactionId });
      throw error;
    }
  }

  /**
   * Get transaction by processor payment ID
   */
  static async getTransactionByProcessorPaymentId(
    processorPaymentId: string,
    processorType: 'stripe' | 'paypal'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      const transaction = await db
        .select()
        .from(duesTransactions)
        .where(
          and(
            eq(duesTransactions.processorPaymentId, processorPaymentId),
            eq(duesTransactions.processorType, processorType)
          )
        )
        .limit(1);

      return transaction && transaction.length > 0 ? transaction[0] : null;
    } catch (error) {
      logger.error('Error getting transaction by processor payment ID', {
        error,
        processorPaymentId,
        processorType,
      });
      throw error;
    }
  }

  /**
   * Get transaction by checkout session ID (Stripe)
   */
  static async getTransactionBySessionId(
    sessionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      // Query by metadata (session ID stored in metadata)
      const transactions = await db
        .select()
        .from(duesTransactions)
        .where(eq(duesTransactions.processorType, 'stripe'));

      // Filter by session ID in metadata (client reference ID)
      const transaction = transactions.find((txn) => {
        const metadata = txn.metadata as Record<string, unknown>;
        return metadata?.stripeSessionId === sessionId;
      });

      return transaction || null;
    } catch (error) {
      logger.error('Error getting transaction by session ID', {
        error,
        sessionId,
      });
      throw error;
    }
  }
}
