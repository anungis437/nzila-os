/**
 * POST /api/payments/webhooks/stripe — Stripe payment webhook handler
 *
 * Secondary payment webhook endpoint for payment-specific events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { platformPayments, billingAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { evaluateFee, captureTransactionFee } from '@/services/platform-economics';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_PAYMENT_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? '';

function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret) return false;
  const parts = signature.split(',').reduce(
    (acc, part) => {
      const [key, value] = part.split('=');
      if (key === 't') acc.timestamp = value;
      if (key === 'v1') acc.signatures.push(value);
      return acc;
    },
    { timestamp: '', signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return parts.signatures.some(
    (sig) => crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    if (STRIPE_WEBHOOK_SECRET && !verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    if (!STRIPE_WEBHOOK_SECRET) {
      logger.error('[stripe-payment-webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const event = JSON.parse(body);
    const eventType = event?.type as string;
    const eventId = event?.id as string;

    // Idempotency check
    const [existing] = await db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.externalReference, eventId))
      .limit(1);

    if (existing) {
      return NextResponse.json({ received: true, status: 'duplicate' });
    }

    // Process payment events
    if (eventType === 'payment_intent.succeeded') {
      const pi = event.data?.object;
      if (pi) {
        const orgId = (pi.metadata?.organization_id as string) ?? null;
        if (orgId) {
          const [acct] = await db
            .select({ id: billingAccounts.id })
            .from(billingAccounts)
            .where(eq(billingAccounts.organizationId, orgId))
            .limit(1);

          if (acct) {
            await db.insert(platformPayments).values({
              organizationId: orgId,
              billingAccountId: acct.id,
              externalReference: eventId,
              method: 'stripe',
              amount: String((pi.amount ?? 0) / 100),
              currency: pi.currency?.toUpperCase() ?? 'CAD',
              status: 'completed',
              paidAt: new Date(),
              metadata: { stripeEventType: eventType, paymentIntentId: pi.id },
            });

            // Capture transaction fee if a rule applies
            const grossAmount = String((pi.amount ?? 0) / 100);
            const feeResult = await evaluateFee({
              organizationId: orgId,
              flowType: 'payment',
              grossAmountCad: grossAmount,
            });
            if (feeResult) {
              await captureTransactionFee({
                organizationId: orgId,
                ruleId: feeResult.ruleId,
                idempotencyKey: `fee-${eventId}`,
                sourceTransactionId: pi.id,
                sourceTransactionType: 'stripe_payment_intent',
                grossAmountCad: feeResult.grossAmountCad,
                feeAmountCad: feeResult.feeAmountCad,
                netAmountCad: feeResult.netAmountCad,
                feeModel: feeResult.feeModel as 'flat' | 'percentage' | 'hybrid' | 'waived' | 'subsidized',
                percentageRateApplied: feeResult.percentageRateApplied,
                flatFeeApplied: feeResult.flatFeeApplied,
              });
            }
          } else {
            logger.warn(`[stripe-payment-webhook] No billing account for org ${orgId}`);
          }
        }
      }
    }

    await auditLog({
      eventType: AuditEventType.API_WEBHOOK_RECEIVED,
      severity: AuditSeverity.LOW,
      resource: 'stripe_payment_webhook',
      resourceId: eventId,
      action: `stripe.payment.${eventType}`,
      metadata: { eventType, eventId },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[stripe-payment-webhook] Error processing webhook:', error);
    // Always return 200 to prevent Stripe retries on internal errors
    return NextResponse.json({ received: true, error: 'Internal processing error' });
  }
}
