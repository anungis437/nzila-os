/**
 * Payment Processing Service
 * 
 * Handles payment integration for:
 * - Dues payments (Stripe)
 * - Stipend disbursements (ACH/Direct Deposit)
 * - Public donations (Stripe)
 * 
 * Week 7-8 Implementation
 */

// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import Stripe from 'stripe';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

// Initialize Stripe (use test key in development)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2025-02-24.acacia' as const,
});

// Payment processor types
export type PaymentProcessor = 'stripe' | 'ach' | 'check' | 'cash' | 'paypal';

// Payment intent statuses
export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'succeeded' 
  | 'failed' 
  | 'cancelled' 
  | 'refunded';

// Stripe payment method types
export type StripePaymentMethod = 'card' | 'bank_account' | 'us_bank_account';

/**
 * DUES PAYMENT PROCESSING
 */

export interface CreateDuesPaymentRequest {
  organizationId: string;
  memberId: string;
  amount: number;
  currency?: string;
  paymentMethod: StripePaymentMethod;
  description?: string;
  metadata?: Record<string, string>;
}

export interface DuesPaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Create a Stripe payment intent for dues payment
 */
export async function createDuesPaymentIntent(
  request: CreateDuesPaymentRequest
): Promise<DuesPaymentIntent> {
  try {
    const { organizationId, memberId, amount, currency = 'usd', paymentMethod, description, metadata } = request;

    // Validate amount (minimum $0.50 for Stripe)
    if (amount < 0.50) {
      throw new Error('Amount must be at least $0.50');
    }

    // Convert to cents
    const amountInCents = Math.round(amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      payment_method_types: [paymentMethod],
      description: description || `Union dues payment for member ${memberId}`,
      metadata: {
        organizationId,
        memberId,
        type: 'dues_payment',
        ...metadata,
      },
    });

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount: amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  } catch (error) {
    logger.error('Error creating dues payment intent', { error, organizationId: request.organizationId, memberId: request.memberId });
    throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface ConfirmDuesPaymentRequest {
  organizationId: string;
  paymentIntentId: string;
  transactionId: string;
}

/**
 * Confirm a dues payment after Stripe webhook
 */
export async function confirmDuesPayment(
  request: ConfirmDuesPaymentRequest
): Promise<void> {
  const { organizationId, paymentIntentId, transactionId } = request;

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not successful: ${paymentIntent.status}`);
    }

    // Update transaction record in database
    await db.update(schema.duesTransactions)
      .set({
        status: 'paid',
        paymentMethod: 'stripe',
        paymentDate: new Date(),
        stripePaymentIntentId: paymentIntentId,
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(and(
        eq(schema.duesTransactions.id, transactionId),
        eq(schema.duesTransactions.organizationId, organizationId)
      ));

  } catch (error) {
    logger.error('Error confirming dues payment', { error, organizationId, transactionId });
    throw error;
  }
}

/**
 * STIPEND DISBURSEMENT PROCESSING
 */

export interface CreateStipendPayoutRequest {
  organizationId: string;
  disbursementId: string;
  amount: number;
  recipientBankAccount: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
    accountType: 'checking' | 'savings';
  };
  description?: string;
}

export interface StipendPayoutResult {
  payoutId: string;
  status: string;
  estimatedArrival: Date;
  transactionId: string;
}

/**
 * Create ACH payout for stipend disbursement
 * 
 * Note: In production, this would use Stripe Connect or a dedicated ACH processor
 * For MVP, we'll simulate the payout creation
 */
export async function createStipendPayout(
  request: CreateStipendPayoutRequest
): Promise<StipendPayoutResult> {
  const { organizationId, disbursementId, amount, _recipientBankAccount, _description } = request;

  try {
    // Validate amount
    if (amount < 1) {
      throw new Error('Payout amount must be at least $1.00');
    }

    // In production, integrate with Stripe Connect or ACH processor
    // For now, create a simulated payout record
    
    // Generate transaction ID
    const transactionId = `ACH-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Estimate arrival (ACH typically takes 1-3 business days)
    const estimatedArrival = new Date();
    estimatedArrival.setDate(estimatedArrival.getDate() + 2);

    // Update disbursement record
    await db.update(schema.stipendDisbursements)
      .set({
        status: 'paid',
        transactionId,
        paidAt: new Date(),
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(and(
        eq(schema.stipendDisbursements.id, disbursementId),
        eq(schema.stipendDisbursements.tenantId, organizationId)
      ));

    return {
      payoutId: transactionId,
      status: 'pending',
      estimatedArrival,
      transactionId,
    };

  } catch (error) {
    logger.error('Error creating stipend payout', { error, organizationId, disbursementId });
    throw new Error(`Failed to create payout: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface BatchStipendPayoutRequest {
  organizationId: string;
  strikeFundId: string;
  disbursementIds: string[];
}

export interface BatchPayoutResult {
  successful: number;
  failed: number;
  results: Array<{
    disbursementId: string;
    success: boolean;
    transactionId?: string;
    error?: string;
  }>;
}

/**
 * Process multiple stipend payouts in batch
 */
export async function batchProcessStipendPayouts(
  request: BatchStipendPayoutRequest
): Promise<BatchPayoutResult> {
  const { organizationId, _strikeFundId, disbursementIds } = request;

  const results: BatchPayoutResult['results'] = [];
  let successful = 0;
  let failed = 0;

  for (const disbursementId of disbursementIds) {
    try {
      // Get disbursement details
      const [disbursement] = await db.select()
        .from(schema.stipendDisbursements)
        .where(and(
          eq(schema.stipendDisbursements.id, disbursementId),
          eq(schema.stipendDisbursements.tenantId, organizationId),
          eq(schema.stipendDisbursements.status, 'approved')
        ))
        .limit(1);

      if (!disbursement) {
        results.push({
          disbursementId,
          success: false,
          error: 'Disbursement not found or not approved',
        });
        failed++;
        continue;
      }

      // In production, would retrieve member bank account details
      // For now, simulate successful payout
      const transactionId = `ACH-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await db.update(schema.stipendDisbursements)
        .set({
          status: 'paid',
          transactionId,
          paidAt: new Date(),
          updatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .where(eq(schema.stipendDisbursements.id, disbursementId));

      results.push({
        disbursementId,
        success: true,
        transactionId,
      });
      successful++;

    } catch (error) {
      results.push({
        disbursementId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failed++;
    }
  }

  return {
    successful,
    failed,
    results,
  };
}

/**
 * PUBLIC DONATION PROCESSING
 */

export interface CreateDonationPaymentRequest {
  organizationId: string;
  strikeFundId: string;
  amount: number;
  currency?: string;
  donorEmail?: string;
  donorName?: string;
  isAnonymous?: boolean;
  message?: string;
  paymentMethod?: StripePaymentMethod;
}

export interface DonationPaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  publicUrl?: string;
}

/**
 * Create Stripe payment intent for public donation
 */
export async function createDonationPaymentIntent(
  request: CreateDonationPaymentRequest
): Promise<DonationPaymentIntent> {
  const { organizationId, strikeFundId } = request; // Extract for catch block scope
  try {
    const {
      organizationId: _organizationId,
      strikeFundId: _strikeFundId,
      amount,
      currency = 'usd',
      donorEmail,
      donorName,
      isAnonymous = false,
      message,
      paymentMethod = 'card',
    } = request;

    // Validate amount (minimum $1.00 for donations)
    if (amount < 1.00) {
      throw new Error('Donation amount must be at least $1.00');
    }

    // Convert to cents
    const amountInCents = Math.round(amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      payment_method_types: [paymentMethod],
      description: `Donation to strike fund`,
      metadata: {
        organizationId: request.organizationId,
        strikeFundId: request.strikeFundId,
        type: 'donation',
        donorEmail: donorEmail || '',
        donorName: isAnonymous ? 'Anonymous' : (donorName || ''),
        isAnonymous: isAnonymous.toString(),
        message: message || '',
      },
      receipt_email: donorEmail,
    });

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount: amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  } catch (error) {
    logger.error('Error creating donation payment intent', { error, organizationId, strikeFundId });
    throw new Error(`Failed to create donation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface ConfirmDonationRequest {
  organizationId: string;
  paymentIntentId: string;
}

/**
 * Confirm donation payment and create donation record
 */
export async function confirmDonationPayment(
  request: ConfirmDonationRequest
): Promise<string> {
  const { organizationId, paymentIntentId } = request;

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not successful: ${paymentIntent.status}`);
    }

    const metadata = paymentIntent.metadata;
    const amount = paymentIntent.amount / 100; // Convert from cents

    // Create donation record
    const [donation] = await db.insert(schema.donations)
      .values({
        organizationId: organizationId,
        strikeFundId: metadata.strikeFundId,
        amount: amount.toString(),
        donorName: metadata.donorName || 'Anonymous',
        donorEmail: metadata.donorEmail || null,
        isAnonymous: metadata.isAnonymous === 'true',
        message: metadata.message || null,
        stripePaymentIntentId: paymentIntentId,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning({ id: schema.donations.id });

    return donation.id;

  } catch (error) {
    logger.error('Error confirming donation payment', { error, organizationId, paymentIntentId });
    throw error;
  }
}

/**
 * PAYMENT WEBHOOK PROCESSING
 */

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any;
  };
}

/**
 * Process Stripe webhook events
 */
export async function processStripeWebhook(
  event: StripeWebhookEvent,
  _signature: string,
  _webhookSecret: string
): Promise<void> {
  try {
    // Verify webhook signature (in production)
    // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      default:
        logger.info('Unhandled webhook event type', { eventType: event.type });
    }

  } catch (error) {
    logger.error('Error processing webhook', { error, eventType: event.type });
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
  const metadata = paymentIntent.metadata;
  const type = metadata.type;

  if (type === 'dues_payment') {
    // Update dues transaction
    await db.update(schema.duesTransactions)
      .set({
        status: 'paid',
        paymentMethod: 'stripe',
        paymentDate: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.duesTransactions.id, metadata.transactionId));

  } else if (type === 'donation') {
    // Create or update donation record
    const amount = paymentIntent.amount / 100;
    
    const organizationId = metadata.organizationId || metadata.tenantId;
    await db.insert(schema.donations)
      .values({
        tenantId: organizationId,
        strikeFundId: metadata.strikeFundId,
        amount: amount.toString(),
        donorName: metadata.donorName || 'Anonymous',
        donorEmail: metadata.donorEmail || null,
        isAnonymous: metadata.isAnonymous === 'true',
        message: metadata.message || null,
        stripePaymentIntentId: paymentIntent.id,
        status: 'completed',
        createdAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
  const metadata = paymentIntent.metadata;
  const type = metadata.type;

  if (type === 'dues_payment') {
    await db.update(schema.duesTransactions)
      .set({
        status: 'failed',
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.duesTransactions.id, metadata.transactionId));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleChargeRefunded(charge: any): Promise<void> {
  const paymentIntentId = charge.payment_intent;

  // Update relevant records to refunded status
  await db.update(schema.duesTransactions)
    .set({
      status: 'refunded',
      updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(schema.duesTransactions.paymentReference, paymentIntentId));

  await db.update(schema.donations)
    .set({
      status: 'refunded',
      updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(schema.donations.stripePaymentIntentId, paymentIntentId));
}

/**
 * PAYMENT ANALYTICS
 */

export interface PaymentSummary {
  duesPayments: {
    total: number;
    count: number;
    averageAmount: number;
  };
  donations: {
    total: number;
    count: number;
    averageAmount: number;
  };
  stipendDisbursements: {
    total: number;
    count: number;
    averageAmount: number;
  };
  totalRevenue: number;
  totalDisbursed: number;
  netBalance: number;
}

/**
 * Get payment summary for a strike fund
 */
export async function getPaymentSummary(
  organizationId: string,
  strikeFundId: string,
  _startDate?: Date,
  _endDate?: Date
): Promise<PaymentSummary> {
  // Dues payments
  const duesQuery = db.select({
    total: sql<string>`CAST(SUM(CAST(${schema.duesTransactions.amount} AS DECIMAL)) AS TEXT)`,
    count: sql<number>`COUNT(*)`,
    average: sql<string>`CAST(AVG(CAST(${schema.duesTransactions.amount} AS DECIMAL)) AS TEXT)`,
  })
  .from(schema.duesTransactions)
  .where(and(
    eq(schema.duesTransactions.organizationId, organizationId),
    eq(schema.duesTransactions.status, 'paid')
  ));

  // Donations
  const donationsQuery = db.select({
    total: sql<string>`CAST(SUM(CAST(${schema.donations.amount} AS DECIMAL)) AS TEXT)`,
    count: sql<number>`COUNT(*)`,
    average: sql<string>`CAST(AVG(CAST(${schema.donations.amount} AS DECIMAL)) AS TEXT)`,
  })
  .from(schema.donations)
  .where(and(
    eq(schema.donations.tenantId, organizationId),
    eq(schema.donations.strikeFundId, strikeFundId),
    eq(schema.donations.status, 'completed')
  ));

  // Stipend disbursements
  const stipendsQuery = db.select({
    total: sql<string>`CAST(SUM(CAST(${schema.stipendDisbursements.totalAmount} AS DECIMAL)) AS TEXT)`,
    count: sql<number>`COUNT(*)`,
    average: sql<string>`CAST(AVG(CAST(${schema.stipendDisbursements.totalAmount} AS DECIMAL)) AS TEXT)`,
  })
  .from(schema.stipendDisbursements)
  .where(and(
    eq(schema.stipendDisbursements.tenantId, organizationId),
    eq(schema.stipendDisbursements.strikeFundId, strikeFundId),
    eq(schema.stipendDisbursements.status, 'paid')
  ));

  const [duesResults] = await duesQuery;
  const [donationsResults] = await donationsQuery;
  const [stipendsResults] = await stipendsQuery;

  const duesTotal = parseFloat(duesResults.total || '0');
  const donationsTotal = parseFloat(donationsResults.total || '0');
  const stipendsTotal = parseFloat(stipendsResults.total || '0');

  const totalRevenue = duesTotal + donationsTotal;
  const totalDisbursed = stipendsTotal;
  const netBalance = totalRevenue - totalDisbursed;

  return {
    duesPayments: {
      total: duesTotal,
      count: duesResults.count,
      averageAmount: parseFloat(duesResults.average || '0'),
    },
    donations: {
      total: donationsTotal,
      count: donationsResults.count,
      averageAmount: parseFloat(donationsResults.average || '0'),
    },
    stipendDisbursements: {
      total: stipendsTotal,
      count: stipendsResults.count,
      averageAmount: parseFloat(stipendsResults.average || '0'),
    },
    totalRevenue,
    totalDisbursed,
    netBalance,
  };
}
