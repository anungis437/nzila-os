/**
 * POST /api/payments/webhooks/stripe — Stripe Connect webhook handler (union-eyes)
 *
 * Receives Stripe webhook events, verifies the signature, and
 * processes payment-related events (payment_intent.succeeded,
 * invoice.paid, etc.) for union org billing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { platformPayments, billingAccounts, transactionFeeEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { evaluateFee, captureTransactionFee, reverseTransactionFee, reconcileExternalInvoicePayment } from '@/services/platform-economics';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

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

/** Resolve billing account ID from org, return null if not found. */
async function resolveBillingAccountId(organizationId: string): Promise<string | null> {
  const [acct] = await db
    .select({ id: billingAccounts.id })
    .from(billingAccounts)
    .where(eq(billingAccounts.organizationId, organizationId))
    .limit(1);
  return acct?.id ?? null;
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
      logger.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const event = JSON.parse(body);
    const eventType = event?.type as string;
    const eventId = event?.id as string;

    // Idempotency: check if we already processed this event
    const [existing] = await db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.externalReference, eventId))
      .limit(1);

    if (existing) {
      return NextResponse.json({ received: true, status: 'duplicate' });
    }

    switch (eventType) {
      case 'payment_intent.succeeded': {
        const pi = event.data?.object;
        if (pi) {
          const orgId = (pi.metadata?.organization_id as string) ?? null;
          const platformInvoiceId = (pi.metadata?.platform_invoice_id as string) ?? null;
          const billingAcctId = orgId ? await resolveBillingAccountId(orgId) : null;

          if (orgId && billingAcctId) {
            if (platformInvoiceId) {
              await reconcileExternalInvoicePayment({
                organizationId: orgId,
                invoiceId: platformInvoiceId,
                amount: String((pi.amount ?? 0) / 100),
                method: 'stripe',
                externalReference: eventId,
                status: 'completed',
                metadata: { stripeEventType: eventType, paymentIntentId: pi.id },
                createdBy: 'system:stripe-webhook',
              });
            } else {
              await withSystemContext(async () =>
                db.insert(platformPayments).values({
                  organizationId: orgId,
                  billingAccountId: billingAcctId,
                  externalReference: eventId,
                  method: 'stripe',
                  amount: String((pi.amount ?? 0) / 100),
                  currency: pi.currency?.toUpperCase() ?? 'CAD',
                  status: 'completed',
                  paidAt: new Date(),
                  metadata: { stripeEventType: eventType, paymentIntentId: pi.id },
                })
              );
            }

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
            logger.warn(`[stripe-webhook] Cannot resolve org/billing for event ${eventId}`);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const inv = event.data?.object;
        if (inv) {
          const orgId = (inv.metadata?.organization_id as string) ?? null;
          const platformInvoiceId =
            (inv.metadata?.platform_invoice_id as string)
            ?? (inv.metadata?.invoice_id as string)
            ?? null;
          const billingAcctId = orgId ? await resolveBillingAccountId(orgId) : null;

          if (orgId && billingAcctId) {
            if (platformInvoiceId) {
              await reconcileExternalInvoicePayment({
                organizationId: orgId,
                invoiceId: platformInvoiceId,
                amount: String((inv.amount_paid ?? 0) / 100),
                method: 'stripe',
                externalReference: eventId,
                status: 'completed',
                metadata: { stripeEventType: eventType, invoiceId: inv.id },
                createdBy: 'system:stripe-webhook',
              });
            } else {
              await withSystemContext(async () =>
                db.insert(platformPayments).values({
                  organizationId: orgId,
                  billingAccountId: billingAcctId,
                  externalReference: eventId,
                  method: 'stripe',
                  amount: String((inv.amount_paid ?? 0) / 100),
                  currency: inv.currency?.toUpperCase() ?? 'CAD',
                  status: 'completed',
                  paidAt: new Date(),
                  metadata: { stripeEventType: eventType, invoiceId: inv.id },
                })
              );
            }

            const grossAmount = String((inv.amount_paid ?? 0) / 100);
            const feeResult = await evaluateFee({
              organizationId: orgId,
              flowType: 'invoice',
              grossAmountCad: grossAmount,
            });
            if (feeResult) {
              await captureTransactionFee({
                organizationId: orgId,
                ruleId: feeResult.ruleId,
                idempotencyKey: `fee-${eventId}`,
                sourceTransactionId: inv.id,
                sourceTransactionType: 'stripe_invoice',
                grossAmountCad: feeResult.grossAmountCad,
                feeAmountCad: feeResult.feeAmountCad,
                netAmountCad: feeResult.netAmountCad,
                feeModel: feeResult.feeModel as 'flat' | 'percentage' | 'hybrid' | 'waived' | 'subsidized',
                percentageRateApplied: feeResult.percentageRateApplied,
                flatFeeApplied: feeResult.flatFeeApplied,
              });
            }
          } else {
            logger.warn(`[stripe-webhook] Cannot resolve org/billing for event ${eventId}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data?.object;
        if (inv) {
          const orgId = (inv.metadata?.organization_id as string) ?? null;
          const platformInvoiceId =
            (inv.metadata?.platform_invoice_id as string)
            ?? (inv.metadata?.invoice_id as string)
            ?? null;

          if (orgId && platformInvoiceId) {
            await reconcileExternalInvoicePayment({
              organizationId: orgId,
              invoiceId: platformInvoiceId,
              amount: String((inv.amount_due ?? inv.amount_remaining ?? 0) / 100),
              method: 'stripe',
              externalReference: eventId,
              status: 'failed',
              failureReason: 'stripe_invoice_payment_failed',
              metadata: { stripeEventType: eventType, invoiceId: inv.id },
              createdBy: 'system:stripe-webhook',
            });
          }
        }
        break;
      }

      case 'charge.refunded': {
        const ch = event.data?.object;
        if (ch) {
          const orgId = (ch.metadata?.organization_id as string) ?? null;
          const billingAcctId = orgId ? await resolveBillingAccountId(orgId) : null;
          if (orgId && billingAcctId) {
            await withSystemContext(async () =>
              db.insert(platformPayments).values({
                organizationId: orgId,
                billingAccountId: billingAcctId,
                externalReference: eventId,
                method: 'stripe',
                amount: String(-((ch.amount_refunded ?? 0) / 100)),
                currency: ch.currency?.toUpperCase() ?? 'CAD',
                status: 'refunded',
                paidAt: new Date(),
                metadata: { stripeEventType: eventType, chargeId: ch.id },
              })
            );

            // Reverse any captured fee for the original payment
            const originalPaymentId = ch.payment_intent as string | undefined;
            if (originalPaymentId) {
              const [feeEvent] = await db
                .select()
                .from(transactionFeeEvents)
                .where(eq(transactionFeeEvents.sourceTransactionId, originalPaymentId))
                .limit(1);
              if (feeEvent) {
                await reverseTransactionFee(
                  feeEvent.id,
                  ch.id,
                  `Stripe refund ${ch.id}`,
                ).catch(() => { /* already reversed — OK */ });
              }
            }
          } else {
            logger.warn(`[stripe-webhook] Cannot resolve org/billing for refund event ${eventId}`);
          }
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    await auditLog({
      eventType: AuditEventType.API_WEBHOOK_RECEIVED,
      severity: AuditSeverity.LOW,
      resource: 'stripe_webhook',
      resourceId: eventId,
      action: `stripe.${eventType}`,
      metadata: { eventType, eventId },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[stripe-webhook] Error processing webhook:', error);
    // Always return 200 to prevent Stripe retries on internal errors
    return NextResponse.json({ received: true, error: 'Internal processing error' });
  }
}
