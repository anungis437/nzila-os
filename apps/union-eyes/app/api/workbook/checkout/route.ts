/**
 * POST /api/workbook/checkout — Stripe checkout for the Self-Guided Workbook tier.
 *
 * Pseudonymous flow. The workbookId is the only identifier linking the
 * checkout to the workbook record. After payment, the Stripe webhook
 * upgrades the workbook tier and stamps the claim token + claim email.
 * The buyer then receives the claim URL and binds the workbook to a
 * Nzila identity.
 *
 * Self-Guided ($2,400 CAD) is the only tier with self-serve checkout.
 * Facilitated and Enterprise tiers are sales-led (no checkout).
 *
 * Env vars:
 *   STRIPE_PRICE_WORKBOOK_SELF_GUIDED — Stripe Price ID (optional)
 *   NEXT_PUBLIC_APP_URL               — Base URL for redirects (fallback: http://localhost:3000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbooks } from '@/db/schema/workbook-schema';
import { WORKBOOK_TIERS } from '@/lib/icra/tiers';
import { getStripeClient } from '@nzila/payments-stripe';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  workbookId: z.string().uuid('Invalid workbook ID'),
});

const SELF_GUIDED_TIER_ID = 'workbook_self_guided' as const;

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parse = bodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { workbookId } = parse.data;

  // Verify the workbook exists (prevent arbitrary UUID injection)
  let existingTierId: string | null = null;
  try {
    const [row] = await db
      .select({ reportTierId: workbooks.reportTierId })
      .from(workbooks)
      .where(eq(workbooks.id, workbookId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }
    existingTierId = row.reportTierId ?? null;
  } catch (err) {
    logger.error('[workbook-checkout] DB lookup failed', { workbookId, err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  // Idempotency: workbook already at this tier (or higher — but Self-Guided is the only purchasable tier)
  if (existingTierId === SELF_GUIDED_TIER_ID) {
    return NextResponse.json(
      { error: 'Workbook tier already unlocked', tierId: existingTierId },
      { status: 409 },
    );
  }

  const tier = WORKBOOK_TIERS[SELF_GUIDED_TIER_ID];
  if (!tier || !tier.selfServe || tier.amountCents == null) {
    return NextResponse.json({ error: 'Tier not available for self-serve checkout' }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const successUrl = `${baseUrl}/workbook/${workbookId}?tier_unlocked=${SELF_GUIDED_TIER_ID}`;
  const cancelUrl = `${baseUrl}/workbook/${workbookId}`;

  const currency = (process.env.STRIPE_DEFAULT_CURRENCY ?? 'CAD').toLowerCase();
  const priceId = process.env.STRIPE_PRICE_WORKBOOK_SELF_GUIDED;

  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency,
          product_data: { name: tier.name },
          unit_amount: tier.amountCents,
        },
        quantity: 1,
      };

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      line_items: [lineItem] as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        workbook_id: workbookId,
        workbook_tier_id: SELF_GUIDED_TIER_ID,
        product: 'workbook',
      },
      customer_creation: 'if_required',
    });

    if (!session.url) {
      throw new Error('Stripe returned no checkout URL');
    }

    logger.info('[workbook-checkout] Checkout session created', {
      workbookId,
      tierId: SELF_GUIDED_TIER_ID,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('[workbook-checkout] Stripe session creation failed', { workbookId, err });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
