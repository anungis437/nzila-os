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
import { icraAssessments } from '@/db/schema/icra-schema';
import { icraMaturityProfiles } from '@/db/schema/icra-schema';
import { workbooks, workbookPurchases } from '@/db/schema/workbook-schema';
import { generateClaimToken, computeClaimExpiry } from '@/lib/icra/claim-tokens';
import { eq } from 'drizzle-orm';
import type { InstitutionalContinuityProfile } from '@/lib/icra/types';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { evaluateFee, captureTransactionFee, reverseTransactionFee, reconcileExternalInvoicePayment } from '@/services/platform-economics';
import { logger } from '@/lib/logger';
import { syncIcraPurchase } from '@/lib/hubspot/syncIcraPurchase';
import type { ExecutivePersonaId, ReportTierId } from '@/lib/icra/types';
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

      case 'checkout.session.completed': {
        const session = event.data?.object;
        const icraAssessmentId = session?.metadata?.icra_assessment_id as string | undefined;
        const icraTierId = session?.metadata?.icra_tier_id as string | undefined;
        const isIcraReport = session?.metadata?.product === 'icra_report';

        if (isIcraReport && icraAssessmentId && icraTierId) {
          // ── ICRA report tier fulfillment ──
          try {
            const [existing] = await db
              .select({ reportTierId: icraAssessments.reportTierId })
              .from(icraAssessments)
              .where(eq(icraAssessments.id, icraAssessmentId))
              .limit(1);

            if (!existing) {
              logger.warn('[stripe-webhook] ICRA assessment not found', { icraAssessmentId });
              break;
            }

            const tierRank: Record<string, number> = {
              continuity_reflection: 0,
              executive_continuity_brief: 1,
              institutional_continuity_diagnostic: 2,
            };
            const currentRank = tierRank[existing.reportTierId ?? 'continuity_reflection'] ?? 0;
            const requestedRank = tierRank[icraTierId] ?? 0;

            if (currentRank >= requestedRank) {
              // Already fulfilled — idempotent
              logger.info('[stripe-webhook] ICRA tier already fulfilled', {
                icraAssessmentId,
                existingTier: existing.reportTierId,
                requestedTier: icraTierId,
              });
              break;
            }

            // Upgrade the assessment tier
            await db
              .update(icraAssessments)
              .set({ reportTierId: icraTierId })
              .where(eq(icraAssessments.id, icraAssessmentId));

            // Patch the stored profile payload so the results page reflects the new tier
            const [profileRow] = await db
              .select({ profilePayload: icraMaturityProfiles.profilePayload })
              .from(icraMaturityProfiles)
              .where(eq(icraMaturityProfiles.assessmentId, icraAssessmentId))
              .limit(1);

            if (profileRow?.profilePayload) {
              const updated: InstitutionalContinuityProfile = {
                ...(profileRow.profilePayload as InstitutionalContinuityProfile),
                reportTierId: icraTierId as InstitutionalContinuityProfile['reportTierId'],
              };
              await db
                .update(icraMaturityProfiles)
                .set({ profilePayload: updated })
                .where(eq(icraMaturityProfiles.assessmentId, icraAssessmentId));
            }

            logger.info('[stripe-webhook] ICRA tier upgraded', {
              icraAssessmentId,
              tierId: icraTierId,
              sessionId: session.id,
            });

            // ── Institutional continuity stewardship: HubSpot CRM sync ──
            // Fire-and-forget. CRM unavailability MUST NOT block Stripe
            // fulfilment, the PDF flow, or the assessment lifecycle.
            // Only runs when the institution voluntarily provided an email
            // (no enrichment, no scraping, no behavioural scoring).
            const customerEmail =
              (session?.customer_details?.email as string | undefined) ??
              (session?.customer_email as string | undefined) ??
              (session?.metadata?.email as string | undefined);
            if (customerEmail) {
              void syncIcraPurchase({
                assessmentId: icraAssessmentId,
                tierId: icraTierId as ReportTierId,
                paymentReference:
                  (session?.payment_intent as string | undefined) ?? session?.id,
                amount:
                  typeof session?.amount_total === 'number'
                    ? session.amount_total / 100
                    : undefined,
                email: customerEmail,
                firstName: session?.customer_details?.name as string | undefined,
                organizationName: session?.metadata?.organization_name as string | undefined,
                persona: session?.metadata?.icra_persona as ExecutivePersonaId | undefined,
                attribution: {
                  utmSource: session?.metadata?.utm_source as string | undefined,
                  utmMedium: session?.metadata?.utm_medium as string | undefined,
                  utmCampaign: session?.metadata?.utm_campaign as string | undefined,
                },
              }).catch((hsErr) => {
                logger.error('[stripe-webhook] HubSpot ICRA sync failed (non-blocking)', {
                  icraAssessmentId,
                  tierId: icraTierId,
                  message: hsErr instanceof Error ? hsErr.message : String(hsErr),
                });
              });
            }
          } catch (icraErr) {
            logger.error('[stripe-webhook] ICRA fulfillment error', {
              icraAssessmentId,
              icraTierId,
              err: icraErr,
            });
            // Fall through — return 200 to prevent Stripe retries, issue is logged
          }
        } else if (session?.metadata?.product === 'workbook') {
          // ── Workbook (Self-Guided) tier fulfillment ──
          const workbookId = session?.metadata?.workbook_id as string | undefined;
          const workbookTierId = session?.metadata?.workbook_tier_id as string | undefined;

          if (!workbookId || !workbookTierId) {
            logger.warn('[stripe-webhook] Workbook session missing required metadata', {
              sessionId: session?.id,
            });
            break;
          }

          try {
            const [existing] = await db
              .select({ reportTierId: workbooks.reportTierId, claimToken: workbooks.claimToken })
              .from(workbooks)
              .where(eq(workbooks.id, workbookId))
              .limit(1);

            if (!existing) {
              logger.warn('[stripe-webhook] Workbook not found', { workbookId });
              break;
            }

            // Idempotency: tier already upgraded with a token issued
            if (existing.reportTierId === workbookTierId && existing.claimToken) {
              logger.info('[stripe-webhook] Workbook tier already fulfilled', {
                workbookId,
                tierId: existing.reportTierId,
              });
              break;
            }

            const claimToken = generateClaimToken();
            const claimExpiry = computeClaimExpiry();
            const customerEmail =
              (session?.customer_details?.email as string | undefined) ??
              (session?.customer_email as string | undefined) ??
              null;
            const paymentRef =
              (session?.payment_intent as string | undefined) ?? (session?.id as string);

            await db
              .update(workbooks)
              .set({
                reportTierId: workbookTierId,
                stripePaymentRef: paymentRef,
                claimEmail: customerEmail,
                claimToken,
                claimTokenExpiresAt: claimExpiry,
                status: 'awaiting_claim',
                updatedAt: new Date(),
              })
              .where(eq(workbooks.id, workbookId));

            // Audit-grade purchase record (uniq on stripePaymentRef \u2014 idempotent)
            await db
              .insert(workbookPurchases)
              .values({
                workbookId,
                stripePaymentRef: paymentRef,
                tierId: workbookTierId,
                amountCents:
                  typeof session?.amount_total === 'number' ? session.amount_total : 0,
                currency: (session?.currency as string | undefined)?.toUpperCase() ?? 'CAD',
                customerEmail,
              })
              .onConflictDoNothing();

            logger.info('[stripe-webhook] Workbook tier upgraded & claim token issued', {
              workbookId,
              tierId: workbookTierId,
              sessionId: session.id,
              claimEmailPresent: Boolean(customerEmail),
            });

            // CRM sync (anti-surveillance) is wired in Phase I (syncWorkbookPurchase).
          } catch (wbErr) {
            logger.error('[stripe-webhook] Workbook fulfillment error', {
              workbookId,
              workbookTierId,
              err: wbErr,
            });
            // Fall through \u2014 return 200 to prevent Stripe retries
          }
        } else if (!isIcraReport) {
          // Non-ICRA checkout.session.completed — log for visibility
          logger.info('[stripe-webhook] checkout.session.completed (non-ICRA)', {
            sessionId: session?.id,
          });
        }
        break;
      }
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
