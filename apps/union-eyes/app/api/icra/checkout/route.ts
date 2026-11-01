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
 *   NEXT_PUBLIC_APP_URL            — Canonical HTTPS origin for payment redirects (required in production)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { icraAssessments } from '@/db/schema/icra-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import {
  capabilityDenialStatus,
  type CapabilityDenialReason,
} from '@/lib/icra/assessment-capability';
import { authorizeAssessmentAccess } from '@/lib/icra/assessment-access';
import { resolveIcraEmailOrigin } from '@/lib/icra/email-results-origin';
import { ICRA_PAID_REPORT_PRICES } from '@/lib/icra/pricing';
import { getStripeClient } from '@nzila/payments-stripe';
import { logger } from '@/lib/logger';
import { guardPublicIntake } from '@/lib/public-intake/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Validation ──────────────────────────────────────────────────────────────

const bodySchema = z.object({
  assessmentId: z.guid('Invalid assessment ID'),
  tierId: z.enum(['executive_continuity_brief', 'institutional_continuity_diagnostic']),
  locale: z.enum(['en-CA', 'fr-CA']).default('en-CA'),
});

// ── Pricing (CAD) — midpoint of published ranges, override via env ──────────

function buildLineItems(
  tierId: 'executive_continuity_brief' | 'institutional_continuity_diagnostic',
  currency: string,
  verifiedPriceId?: string,
) {

  if (tierId === 'executive_continuity_brief') {
    if (verifiedPriceId) {
      return [{ price: verifiedPriceId, quantity: 1 }];
    }
    return [
      {
        price_data: {
          currency,
          product_data: { name: 'Leadership Briefing Report' },
          unit_amount: ICRA_PAID_REPORT_PRICES.executive_continuity_brief.amountCents,
        },
        quantity: 1,
      },
    ];
  }

  // institutional_continuity_diagnostic
  if (verifiedPriceId) {
    return [{ price: verifiedPriceId, quantity: 1 }];
  }
  return [
    {
      price_data: {
        currency,
        product_data: { name: 'Institutional Continuity Diagnostic' },
        unit_amount: ICRA_PAID_REPORT_PRICES.institutional_continuity_diagnostic.amountCents,
      },
      quantity: 1,
    },
  ];
}

// ── Handler ─────────────────────────────────────────────────────────────────

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

  const { assessmentId, tierId, locale } = parse.data;

  // Verify the assessment exists AND the caller holds its capability
  // (prevent arbitrary UUID injection / unlocking someone else's report).
  let existingTierId: string | null = null;
  let assessmentStatus: string | null = null;
  try {
    const capResult = await withSystemContext(async (tx): Promise<
      { denied: CapabilityDenialReason; tierId: null; status: null } | { denied: null; tierId: string; status: string }
    > => {
      const [row] = await tx
        .select({
          reportTierId: icraAssessments.reportTierId,
          status: icraAssessments.status,
          capabilityTokenHash: icraAssessments.capabilityTokenHash,
          capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
          claimedAt: icraAssessments.claimedAt,
          claimedOrgId: icraAssessments.claimedOrgId,
          claimedByUserId: icraAssessments.claimedByUserId,
        })
        .from(icraAssessments)
        .where(eq(icraAssessments.id, assessmentId))
        .limit(1);

      const capCheck = await authorizeAssessmentAccess(request, assessmentId, row);
      if (!capCheck.ok) {
        return { denied: capCheck.reason, tierId: null, status: null };
      }
      return { denied: null, tierId: row!.reportTierId ?? 'continuity_reflection', status: String(row!.status) };
    });

    if (capResult.denied) {
      return NextResponse.json(
        { error: 'Not authorized to upgrade this assessment' },
        { status: capabilityDenialStatus(capResult.denied) },
      );
    }
    existingTierId = capResult.tierId;
    assessmentStatus = capResult.status;
  } catch (err) {
    logger.error('[icra-checkout] DB lookup failed', { assessmentId, err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  // A report is bought for an assessment that has been submitted: a draft has no results to unlock, and a purchase made against it
  // would be paid for and then refused by the report route.
  if (assessmentStatus !== 'submitted' && assessmentStatus !== 'completed') {
    return NextResponse.json({ error: 'The assessment must be submitted before a report can be purchased' }, { status: 409 });
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
  // The buyer is sent back to this origin after paying. Outside development a missing configuration is a refusal, not a redirect to a
  // host that is not the application: a customer would pay and land on localhost.
  const baseUrl = resolveIcraEmailOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    process.env.NODE_ENV === 'production',
  );
  if (!baseUrl) {
    logger.error('[icra-checkout] canonical HTTPS application origin is not configured or invalid');
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  const successUrl = `${baseUrl}/${locale}/continuity-assessment/results/${assessmentId}?tier_unlocked=${tierId}`;
  const cancelUrl = `${baseUrl}/${locale}/continuity-assessment/results/${assessmentId}`;

  // The public report gate advertises CAD 1,200 / CAD 6,500. A configured
  // Stripe Price ID is not authority to charge a different amount or currency.
  // Verify the live Price before creating a payable session (fail closed if
  // Stripe is unavailable, the Price was archived, or the amount changed).
  const currency = (process.env.STRIPE_DEFAULT_CURRENCY ?? 'CAD').toLowerCase();
  if (currency !== 'cad') {
    logger.error('[icra-checkout] configured currency conflicts with published CAD pricing');
    return NextResponse.json({ error: 'Checkout pricing unavailable' }, { status: 503 });
  }
  const configuredPriceId = (tierId === 'executive_continuity_brief'
    ? process.env.STRIPE_PRICE_ICRA_BRIEF
    : process.env.STRIPE_PRICE_ICRA_DIAGNOSTIC)?.trim();
  const expectedAmount = ICRA_PAID_REPORT_PRICES[tierId].amountCents;

  try {
    const stripe = getStripeClient();
    if (configuredPriceId) {
      try {
        const price = await stripe.prices.retrieve(configuredPriceId);
        if (price.id !== configuredPriceId || !price.active ||
            price.currency.toLowerCase() !== 'cad' ||
            price.unit_amount !== expectedAmount ||
            price.type !== 'one_time' || price.recurring != null) {
          logger.error('[icra-checkout] Stripe Price does not match published tier pricing', { tierId });
          return NextResponse.json({ error: 'Checkout pricing unavailable' }, { status: 503 });
        }
      } catch {
        logger.error('[icra-checkout] unable to verify configured Stripe Price', { tierId });
        return NextResponse.json({ error: 'Checkout pricing unavailable' }, { status: 503 });
      }
    }
    const checkoutParams = {
      mode: 'payment',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      line_items: buildLineItems(tierId, currency, configuredPriceId) as any,
      managed_payments: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        icra_assessment_id: assessmentId,
        icra_tier_id: tierId,
        product: 'icra_report',
      },
      // Collect buyer email for receipt — does not require account creation
      customer_creation: 'if_required',
    } as Parameters<typeof stripe.checkout.sessions.create>[0] & {
      managed_payments: { enabled: boolean };
    };
    const session = await stripe.checkout.sessions.create(checkoutParams);

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
