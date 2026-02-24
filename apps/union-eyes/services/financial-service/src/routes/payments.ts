/**
 * Payment Processing Routes
 * 
 * API endpoints for:
 * - Dues payment processing (Stripe)
 * - Stipend disbursement payouts (ACH)
 * - Public donations (Stripe)
 * - Payment webhooks
 * - Payment analytics
 * 
 * Week 7-8 Implementation
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as PaymentService from '../services/payment-processing';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

const router = Router();

// Validation schemas
const CreateDuesPaymentSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().min(0.50).max(100000),
  currency: z.string().length(3).default('usd'),
  paymentMethod: z.enum(['card', 'bank_account', 'us_bank_account']),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const ConfirmDuesPaymentSchema = z.object({
  paymentIntentId: z.string(),
  transactionId: z.string().uuid(),
});

const CreateStipendPayoutSchema = z.object({
  disbursementId: z.string().uuid(),
  amount: z.number().min(1).max(100000),
  recipientBankAccount: z.object({
    accountNumber: z.string(),
    routingNumber: z.string(),
    accountHolderName: z.string(),
    accountType: z.enum(['checking', 'savings']),
  }),
  description: z.string().optional(),
});

const BatchStipendPayoutSchema = z.object({
  strikeFundId: z.string().uuid(),
  disbursementIds: z.array(z.string().uuid()).min(1),
});

const CreateDonationSchema = z.object({
  strikeFundId: z.string().uuid(),
  amount: z.number().min(1).max(100000),
  currency: z.string().length(3).default('usd'),
  donorEmail: z.string().email().optional(),
  donorName: z.string().optional(),
  isAnonymous: z.boolean().default(false),
  message: z.string().max(500).optional(),
  paymentMethod: z.enum(['card', 'bank_account', 'us_bank_account']).default('card'),
});

const ConfirmDonationSchema = z.object({
  paymentIntentId: z.string(),
});

const PaymentSummaryQuerySchema = z.object({
  strikeFundId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * DUES PAYMENT ENDPOINTS
 */

/**
 * POST /api/payments/dues/intent
 * Create Stripe payment intent for dues payment
 */
router.post('/dues/intent', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user.organizationId;
    const validatedData = CreateDuesPaymentSchema.parse(req.body);

    const paymentIntent = await PaymentService.createDuesPaymentIntent({
      organizationId,
      memberId: validatedData.memberId,
      amount: validatedData.amount,
      currency: validatedData.currency,
      paymentMethod: validatedData.paymentMethod,
      description: validatedData.description,
      metadata: validatedData.metadata,
    });

    res.json({
      success: true,
      paymentIntent,
    });
  } catch (error) {
    logger.error('Error creating dues payment intent', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent',
    });
  }
});

/**
 * POST /api/payments/dues/confirm
 * Confirm dues payment after Stripe processing
 */
router.post('/dues/confirm', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user.organizationId;
    const validatedData = ConfirmDuesPaymentSchema.parse(req.body);

    await PaymentService.confirmDuesPayment({
      organizationId,
      paymentIntentId: validatedData.paymentIntentId,
      transactionId: validatedData.transactionId,
    });

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
    });
  } catch (error) {
    logger.error('Error confirming dues payment', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm payment',
    });
  }
});

/**
 * STIPEND PAYOUT ENDPOINTS
 */

/**
 * POST /api/payments/stipends/payout
 * Create ACH payout for stipend disbursement
 */
router.post('/stipends/payout', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user.organizationId;
    const validatedData = CreateStipendPayoutSchema.parse(req.body);

    const payout = await PaymentService.createStipendPayout({
      organizationId,
      disbursementId: validatedData.disbursementId,
      amount: validatedData.amount,
      recipientBankAccount: validatedData.recipientBankAccount as {
        accountNumber: string;
        routingNumber: string;
        accountHolderName: string;
        accountType: 'checking' | 'savings';
      },
      description: validatedData.description,
    });

    res.json({
      success: true,
      payout,
    });
  } catch (error) {
    logger.error('Error creating stipend payout', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payout',
    });
  }
});

/**
 * POST /api/payments/stipends/payout/batch
 * Process multiple stipend payouts in batch
 */
router.post('/stipends/payout/batch', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user.organizationId;
    const validatedData = BatchStipendPayoutSchema.parse(req.body);

    const results = await PaymentService.batchProcessStipendPayouts({
      organizationId,
      strikeFundId: validatedData.strikeFundId,
      disbursementIds: validatedData.disbursementIds,
    });

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    logger.error('Error processing batch payouts', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process batch payouts',
    });
  }
});

/**
 * DONATION ENDPOINTS
 */

/**
 * POST /api/payments/donations/intent
 * Create Stripe payment intent for public donation
 */
router.post('/donations/intent', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user?.organizationId || req.body.organizationId; // Allow public access
    const validatedData = CreateDonationSchema.parse(req.body);

    const paymentIntent = await PaymentService.createDonationPaymentIntent({
      organizationId,
      strikeFundId: validatedData.strikeFundId,
      amount: validatedData.amount,
      currency: validatedData.currency,
      donorEmail: validatedData.donorEmail,
      donorName: validatedData.donorName,
      isAnonymous: validatedData.isAnonymous,
      message: validatedData.message,
      paymentMethod: validatedData.paymentMethod,
    });

    res.json({
      success: true,
      paymentIntent,
    });
  } catch (error) {
    logger.error('Error creating donation payment intent', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create donation',
    });
  }
});

/**
 * POST /api/payments/donations/confirm
 * Confirm donation payment and create donation record
 */
router.post('/donations/confirm', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user?.organizationId || req.body.organizationId; // Allow public access
    const validatedData = ConfirmDonationSchema.parse(req.body);

    const donationId = await PaymentService.confirmDonationPayment({
      organizationId,
      paymentIntentId: validatedData.paymentIntentId,
    });

    res.json({
      success: true,
      donationId,
      message: 'Thank you for your donation!',
    });
  } catch (error) {
    logger.error('Error confirming donation', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm donation',
    });
  }
});

/**
 * WEBHOOK ENDPOINTS
 */

/**
 * POST /api/payments/webhook/stripe
 * Handle Stripe webhook events
 */
router.post('/webhook/stripe', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    await PaymentService.processStripeWebhook(
      req.body,
      signature,
      webhookSecret
    );

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Stripe webhook', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
});

/**
 * ANALYTICS ENDPOINTS
 */

/**
 * GET /api/payments/summary
 * Get payment summary and analytics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).user.organizationId;
    const { strikeFundId, startDate, endDate } = PaymentSummaryQuerySchema.parse(req.query);

    const summary = await PaymentService.getPaymentSummary(
      organizationId,
      strikeFundId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Error getting payment summary', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get payment summary',
    });
  }
});

export default router;
