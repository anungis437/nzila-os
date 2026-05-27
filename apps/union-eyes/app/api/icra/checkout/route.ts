/**
 * POST /api/icra/checkout — Create a Stripe checkout session for an ICRA report tier upgrade.
 *
 * Pseudonymous flow — no authentication required.
 * The assessmentId is the only identifier linking the checkout to the assessment record.
 *
 * After payment, Stripe posts checkout.session.completed to /api/payments/webhooks/stripe,
 * which upgrades icraAssessments.reportTierId and the stored profile payload.
 *
 * Env vars:
 *   STRIPE_PRICE_ICRA_BRIEF        — Stripe Price ID for Leadership Briefing Report (optional)
 *   STRIPE_PRICE_ICRA_DIAGNOSTIC   — Stripe Price ID for Institutional Continuity Diagnostic (optional)
 *   NEXT_PUBLIC_APP_URL            — Base URL used for success/cancel redirect (fallback: http://localhost:3000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { icraAssessments } from '@/db/schema/icra-schema';
import { getStripeClient } from '@nzila/payments-stripe';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Validation ──────────────────────────────────────────────────────────────

const bodySchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  tierId: z.enum(['executive_continuity_brief', 'institutional_continuity_diagnostic']),
});

// ── Pricing (CAD) — midpoint of published ranges, override via env ──────────

const BRIEF_AMOUNT_CENTS = 120000; // $1,200 CAD (canonical)
const DIAGNOSTIC_AMOUNT_CENTS = 650000; // $6,500 CAD (canonical)

function buildLineItems(
  tierId: 'executive_continuity_brief' | 'institutional_continuity_diagnostic',
  currency: string,
) {
  const priceIdBrief = process.env.STRIPE_PRICE_ICRA_BRIEF;
  const priceIdDiagnostic = process.env.STRIPE_PRICE_ICRA_DIAGNOSTIC;

  if (tierId === 'executive_continuity_brief') {
    if (priceIdBrief) {
      return [{ price: priceIdBrief, quantity: 1 }];
    }
    return [
      {
        price_data: {
          currency,
          product_data: { name: 'Leadership Briefing Report' },
          unit_amount: BRIEF_AMOUNT_CENTS,
        },
        quantity: 1,
      },
    ];
  }

  // institutional_continuity_diagnostic
  if (priceIdDiagnostic) {
    return [{ price: priceIdDiagnostic, quantity: 1 }];
  }
  return [
    {
      price_data: {
        currency,
        product_data: { name: 'Institutional Continuity Diagnostic' },
        unit_amount: DIAGNOSTIC_AMOUNT_CENTS,
      },
      quantity: 1,
    },
  ];
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
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

  const { assessmentId, tierId } = parse.data;

  // Verify the assessment exists (prevent arbitrary UUID injection)
  let existingTierId: string | null = null;
  try {
    const [row] = await db
      .select({ reportTierId: icraAssessments.reportTierId })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }
    existingTierId = row.reportTierId ?? 'continuity_reflection';
  } catch (err) {
    logger.error('[icra-checkout] DB lookup failed', { assessmentId, err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  // Idempotency: already at or above this tier
  const tierRank: Record<string, number> = {
    continuity_reflection: 0,
    executive_continuity_brief: 1,
    institutional_continuity_diagnostic: 2,
  };
  const requestedRank = tierRank[tierId] ?? 0;
  const currentRank = tierRank[existingTierId] ?? 0;
  if (currentRank >= requestedRank) {
    return NextResponse.json(
      { error: 'Tier already unlocked', tierId: existingTierId },
      { status: 409 },
    );
  }

  // Build the checkout session
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const successUrl = `${baseUrl}/continuity-assessment/results/${assessmentId}?tier_unlocked=${tierId}`;
  const cancelUrl = `${baseUrl}/continuity-assessment/results/${assessmentId}`;

  const currency = (process.env.STRIPE_DEFAULT_CURRENCY ?? 'CAD').toLowerCase();

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      line_items: buildLineItems(tierId, currency) as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        icra_assessment_id: assessmentId,
        icra_tier_id: tierId,
        product: 'icra_report',
      },
      // Collect buyer email for receipt — does not require account creation
      customer_creation: 'if_required',
    });

    if (!session.url) {
      throw new Error('Stripe returned no checkout URL');
    }

    logger.info('[icra-checkout] Checkout session created', {
      assessmentId,
      tierId,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('[icra-checkout] Stripe session creation failed', { assessmentId, tierId, err });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
