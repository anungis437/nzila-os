/**
 * Public Donations Routes
 * Public-facing endpoints for strike fund donations with Stripe integration
 */

import express, { Router, Request, Response } from 'express';
import { z } from 'zod';
// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import Stripe from 'stripe';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia' as const,
});

// Validation schemas
const createDonationSchema = z.object({
  fundId: z.string().uuid(),
  amount: z.number().positive().min(1), // Minimum $1
  donorName: z.string().min(1).max(100).optional(),
  donorEmail: z.string().email().optional(),
  isAnonymous: z.boolean().default(false),
  message: z.string().max(500).optional(),
  returnUrl: z.string().url().optional(),
});

/**
 * POST /api/donations
 * Create a donation payment intent (no authentication required for public donations)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = createDonationSchema.parse(req.body);

    // Verify strike fund exists and is active
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fundResult: any = await db.execute(sql`
      SELECT id, fund_name, tenant_id, status, current_balance, target_amount
      FROM strike_funds
      WHERE id = ${validatedData.fundId}
        AND status = 'active'
      LIMIT 1
    `);

    const funds = Array.isArray(fundResult) ? fundResult : (fundResult.rows || fundResult);

    if (funds.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strike fund not found or inactive',
      });
    }

    const fund = funds[0];
    const organizationId = fund.tenant_id;

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(validatedData.amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        fundId: validatedData.fundId,
        fundName: fund.fund_name,
        donorName: validatedData.donorName || 'Anonymous',
        donorEmail: validatedData.donorEmail || '',
        isAnonymous: validatedData.isAnonymous.toString(),
        message: validatedData.message || '',
        organizationId,
      },
      description: `Donation to ${fund.fund_name}`,
      receipt_email: validatedData.donorEmail || undefined,
    });

    // Create pending donation record in database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const donationResult: any = await db.execute(sql`
      INSERT INTO public_donations (
        tenant_id, strike_fund_id, amount, donor_name, donor_email,
        is_anonymous, payment_provider, payment_intent_id,
        status, message
      ) VALUES (
        ${organizationId}, ${validatedData.fundId}, ${validatedData.amount.toString()},
        ${validatedData.donorName || null}, ${validatedData.donorEmail || null},
        ${validatedData.isAnonymous}, 'stripe', ${paymentIntent.id},
        'pending', ${validatedData.message || null}
      )
      RETURNING *
    `);

    const donations = Array.isArray(donationResult) ? donationResult : (donationResult.rows || donationResult);

    res.status(201).json({
      success: true,
      data: {
        donationId: donations[0].id,
        clientSecret: paymentIntent.client_secret,
        amount: validatedData.amount,
        fundName: fund.fund_name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/donations/webhooks/stripe
 * Handle Stripe webhook events (payment confirmations, failures)
 */
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({
        success: false,
        error: 'Missing stripe-signature header',
      });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err) {
      logger.error('Webhook signature verification failed', { error: err });
      return res.status(400).json({
        success: false,
        error: `Webhook Error: ${err.message}`,
      });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentSuccess(paymentIntent);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentFailure(paymentIntent);
          break;
        }

        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentCancellation(paymentIntent);
          break;
        }

        default:
          logger.info('Unhandled event type', { eventType: event.type });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Error processing webhook', { error });
      res.status(500).json({
        success: false,
        error: 'Error processing webhook',
      });
    }
  }
);

/**
 * GET /api/donations/campaigns/:fundId
 * Get public campaign information for a strike fund
 */
router.get('/campaigns/:fundId', async (req: Request, res: Response) => {
  try {
    const { fundId } = req.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fundResult: any = await db.execute(sql`
      SELECT 
        sf.id,
        sf.fund_name,
        sf.description,
        sf.target_amount,
        sf.current_balance,
        sf.strike_start_date,
        sf.strike_end_date,
        sf.status,
        COUNT(DISTINCT pd.id) as donor_count,
        COALESCE(SUM(CASE WHEN pd.status = 'completed' THEN pd.amount ELSE 0 END), 0) as total_donations
      FROM strike_funds sf
      LEFT JOIN public_donations pd ON pd.strike_fund_id = sf.id
      WHERE sf.id = ${fundId}
        AND sf.status IN ('active', 'completed')
      GROUP BY sf.id, sf.fund_name, sf.description, sf.target_amount, sf.current_balance, 
               sf.strike_start_date, sf.strike_end_date, sf.status
      LIMIT 1
    `);

    // postgres-js with drizzle returns array directly, not wrapped in .rows
    const rows = Array.isArray(fundResult) ? fundResult : (fundResult.rows || fundResult);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const fund = rows[0];

    // Get recent donations (non-anonymous only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentDonationsResult: any = await db.execute(sql`
      SELECT 
        donor_name,
        amount,
        message,
        created_at
      FROM public_donations
      WHERE strike_fund_id = ${fundId}
        AND is_anonymous = false
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const recentDonations = Array.isArray(recentDonationsResult) ? recentDonationsResult : (recentDonationsResult.rows || recentDonationsResult);

    res.json({
      success: true,
      data: {
        id: fund.id,
        name: fund.fund_name,
        description: fund.description,
        goal: parseFloat(fund.target_amount),
        currentBalance: parseFloat(fund.current_balance),
        totalDonations: parseFloat(fund.total_donations),
        donorCount: parseInt(fund.donor_count),
        startDate: fund.strike_start_date,
        endDate: fund.strike_end_date,
        status: fund.status,
        percentComplete: (parseFloat(fund.total_donations) / parseFloat(fund.target_amount)) * 100,
        recentDonations: recentDonations,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/donations/:donationId
 * Get donation status (for confirmation page)
 */
router.get('/:donationId', async (req: Request, res: Response) => {
  try {
    const { donationId } = req.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await db.execute(sql`
      SELECT 
        pd.id,
        pd.amount,
        pd.donor_name,
        pd.is_anonymous,
        pd.status,
        pd.transaction_id,
        pd.created_at,
        sf.fund_name
      FROM public_donations pd
      JOIN strike_funds sf ON sf.id = pd.strike_fund_id
      WHERE pd.id = ${donationId}
      LIMIT 1
    `);

    const donations = Array.isArray(result) ? result : (result.rows || result);

    if (donations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
    }

    res.json({
      success: true,
      data: donations[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper functions for webhook event handling

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;

  // Update donation record
  await db.execute(sql`
    UPDATE public_donations
    SET 
      status = 'completed',
      transaction_id = ${paymentIntent.id},
      processed_at = NOW(),
      updated_at = NOW()
    WHERE payment_intent_id = ${paymentIntent.id}
  `);

  // Update strike fund balance
  const amount = paymentIntent.amount / 100; // Convert from cents
  await db.execute(sql`
    UPDATE strike_funds
    SET 
      current_balance = current_balance + ${amount.toString()},
      updated_at = NOW()
    WHERE id = ${metadata.fundId}
  `);

  logger.info('Payment succeeded for donation', { fundId: metadata.fundId, amount });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  await db.execute(sql`
    UPDATE public_donations
    SET 
      status = 'failed',
      updated_at = NOW()
    WHERE payment_intent_id = ${paymentIntent.id}
  `);

  logger.warn('Payment failed for intent', { paymentIntentId: paymentIntent.id });
}

async function handlePaymentCancellation(paymentIntent: Stripe.PaymentIntent) {
  await db.execute(sql`
    UPDATE public_donations
    SET 
      status = 'cancelled',
      updated_at = NOW()
    WHERE payment_intent_id = ${paymentIntent.id}
  `);

  logger.info('Payment cancelled for intent', { paymentIntentId: paymentIntent.id });
}

export default router;
