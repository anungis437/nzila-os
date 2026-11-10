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
import { withSystemContext } from '@/lib/db/with-rls-context';
import { workbookCheckoutIntents, workbooks } from '@/db/schema/workbook-schema';
import { WORKBOOK_TIERS } from '@/lib/icra/tiers';
import { getStripeClient } from '@nzila/payments-stripe';
import { logger } from '@/lib/logger';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import { opaqueRef } from '@/lib/icra/opaque-ref';
import { recordExternalDisclosure } from '@/lib/audit/external-disclosure';
import { UE_SYSTEM_ORG_ID } from '@/lib/ai-client';
import { activeWorkbookConsent } from '@/lib/workbook/consent';
import { extractWorkbookCapability, workbookCapabilityHolds } from '@/lib/workbook/workbook-capability';
import {
  issueWorkbookCheckoutReference,
  WORKBOOK_CHECKOUT_INTENT_TTL_MS,
} from '@/lib/workbook/checkout-intent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  workbookId: z.guid('Invalid workbook ID'),
});

const SELF_GUIDED_TIER_ID = 'workbook_self_guided' as const;
const CHECKOUT_REUSE_WINDOW_MS = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  const intake = await guardPublicIntake(request, { bucket: 'checkout', challenge: true });
  if (!intake.ok) return intake.response;

  const parse = bodySchema.safeParse(intake.json);
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
    // An unclaimed workbook (all a buyer has before paying) is invisible to the user isolation policy, so the read names the
    // system role explicitly rather than running on the pooled connection with no user context.
    const [row] = await withSystemContext(async (tx) =>
      tx
        .select({
          reportTierId: workbooks.reportTierId,
          claimedByUserId: workbooks.claimedByUserId,
          capabilityTokenHash: workbooks.capabilityTokenHash,
          capabilityTokenExpiresAt: workbooks.capabilityTokenExpiresAt,
          consent: workbooks.consent,
        })
        .from(workbooks)
        .where(eq(workbooks.id, workbookId))
        .limit(1),
    );

    if (!row) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }
    if (row.claimedByUserId || !workbookCapabilityHolds(extractWorkbookCapability(request, workbookId), row)) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }
    if (!activeWorkbookConsent(row.consent)) {
      return NextResponse.json({ error: 'Workbook consent is not active' }, { status: 403 });
    }
    existingTierId = row.reportTierId ?? null;
  } catch (err) {
    logger.error('[workbook-checkout] DB lookup failed', { workbookRef: opaqueRef(workbookId), err });
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

  // A payment redirect to localhost would strand the buyer after paying, so production refuses to open a session without a public base URL.
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!configuredBase && process.env.NODE_ENV === 'production') {
    logger.error('[workbook-checkout] NEXT_PUBLIC_APP_URL is not configured', { workbookRef: opaqueRef(workbookId) });
    return NextResponse.json({ error: 'Checkout is temporarily unavailable' }, { status: 503 });
  }
  const baseUrl = configuredBase ?? 'http://localhost:3000';
  const { publicRef, publicRefHash } = issueWorkbookCheckoutReference();
  const expiresAt = new Date(Date.now() + WORKBOOK_CHECKOUT_INTENT_TTL_MS);
  const successUrl = `${baseUrl}/workbook/checkout/complete?ref=${encodeURIComponent(publicRef)}`;
  const cancelUrl = `${baseUrl}/workbook/checkout/cancelled?ref=${encodeURIComponent(publicRef)}`;

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
    await withSystemContext((tx) =>
      tx.insert(workbookCheckoutIntents).values({
        workbookId,
        publicRefHash,
        tierId: SELF_GUIDED_TIER_ID,
        status: 'prepared',
        expiresAt,
      }),
    );

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      line_items: [lineItem] as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        checkout_intent_ref: publicRef,
        product: 'workbook',
      },
      customer_creation: 'if_required',
    }, {
      // A repeated request in the same window gets the session already opened instead of a new one.
      idempotencyKey: `workbook-checkout:${publicRefHash}`,
    });

    if (!session.url) {
      throw new Error('Stripe returned no checkout URL');
    }

    await withSystemContext((tx) =>
      tx
        .update(workbookCheckoutIntents)
        .set({ status: 'session_created', stripeSessionRef: session.id, updatedAt: new Date() })
        .where(eq(workbookCheckoutIntents.publicRefHash, publicRefHash)),
    );

    logger.info('[workbook-checkout] Checkout session created', {
      workbookRef: opaqueRef(workbookId),
      tierId: SELF_GUIDED_TIER_ID,
      sessionId: session.id,
    });

    // Only a random, expiring checkout reference crosses the processor boundary.
    await withSystemContext((tx) =>
      recordExternalDisclosure(tx, {
        organizationId: UE_SYSTEM_ORG_ID,
        processor: 'stripe',
        resourceType: 'workbooks',
        resourceId: workbookId,
        dataClasses: ['opaque_checkout_intent'],
        purpose: 'Self-serve workbook tier checkout',
        merchantOfRecord: 'platform',
      }),
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('[workbook-checkout] Stripe session creation failed', { workbookRef: opaqueRef(workbookId), err });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
