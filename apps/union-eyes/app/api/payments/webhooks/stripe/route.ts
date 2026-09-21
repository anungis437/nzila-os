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
import { eq, and, isNull } from 'drizzle-orm';
import type { InstitutionalContinuityProfile } from '@/lib/icra/types';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { evaluateFee, captureTransactionFee, reverseTransactionFee, reconcileExternalInvoicePayment } from '@/services/platform-economics';
import { logger } from '@/lib/logger';
import { syncIcraPurchase } from '@/lib/hubspot/syncIcraPurchase';
import { syncWorkbookPurchase } from '@/lib/hubspot/syncWorkbookPurchase';
import type { ExecutivePersonaId, ReportTierId } from '@/lib/icra/types';
import { verifyStripeSignature } from '@/lib/payments/stripe-signature';

export const dynamic = 'force-dynamic';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

type PlatformPaymentReservation =
  | { reserved: true; id: string }
  | {
      reserved: false;
      existing: { id: string; method: string; amount: string; currency: string } | null;
    };

/**
 * Reserve a canonical platform payment identity. The
 * (organization_id, external_reference) partial unique index is the
 * authoritative concurrency control — at most one durable payment identity per
 * event. MUST be called inside an active withSystemContext transaction so the
 * reservation, fee evaluation and fee capture commit or roll back together.
 */
async function reservePlatformPayment(values: {
  organizationId: string;
  billingAccountId: string;
  externalReference: string;
  amount: string;
  currency: string;
  status: 'completed' | 'refunded';
  metadata: Record<string, unknown>;
}): Promise<PlatformPaymentReservation> {
  const [row] = await db
    .insert(platformPayments)
    .values({
      organizationId: values.organizationId,
      billingAccountId: values.billingAccountId,
      externalReference: values.externalReference,
      method: 'stripe',
      amount: values.amount,
      currency: values.currency,
      status: values.status,
      paidAt: new Date(),
      metadata: values.metadata,
    })
    .onConflictDoNothing()
    .returning({ id: platformPayments.id });

  if (row) return { reserved: true, id: row.id };

  const [existing] = await db
    .select({
      id: platformPayments.id,
      method: platformPayments.method,
      amount: platformPayments.amount,
      currency: platformPayments.currency,
    })
    .from(platformPayments)
    .where(
      and(
        eq(platformPayments.organizationId, values.organizationId),
        eq(platformPayments.externalReference, values.externalReference),
      ),
    )
    .limit(1);

  return { reserved: false, existing: existing ?? null };
}

/**
 * A reference conflict must correspond to the SAME payment (provider + amount +
 * currency). An identifier collision that would authorize a DIFFERENT payment
 * is a hard failure, not a legitimate replay.
 */
function assertReplayOwnership(
  existing: { method: string; amount: string; currency: string } | null,
  expected: { amount: string; currency: string },
): void {
  if (!existing) return;
  const sameProvider = existing.method === 'stripe';
  const sameAmount = Number(existing.amount) === Number(expected.amount);
  const sameCurrency = existing.currency === expected.currency;
  if (!sameProvider || !sameAmount || !sameCurrency) {
    throw new Error('platform_payment_external_reference_conflict');
  }
}

/** Resolve billing account ID from org, return null if not found. */
async function resolveBillingAccountId(organizationId: string): Promise<string | null> {
  // Uses the module-level db so it participates in the caller's active
  // withSystemContext transaction rather than opening a separate one.
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

    switch (eventType) {
      case 'payment_intent.succeeded': {
        const pi = event.data?.object;
        if (pi) {
          const orgId = (pi.metadata?.organization_id as string) ?? null;
          const platformInvoiceId = (pi.metadata?.platform_invoice_id as string) ?? null;
          const grossAmount = String((pi.amount ?? 0) / 100);
          const currency = pi.currency?.toUpperCase() ?? 'CAD';

          // Core financial commit: reserve the payment identity, then evaluate
          // and capture the fee in the SAME system transaction. A failure in
          // any core step rolls back all of them; a Stripe retry re-runs cleanly.
          const outcome = await withSystemContext(async () => {
            const billingAcctId = orgId ? await resolveBillingAccountId(orgId) : null;
            if (!orgId || !billingAcctId) {
              logger.warn(`[stripe-webhook] Cannot resolve org/billing for event ${eventId}`);
              return 'no_billing' as const;
            }

            if (platformInvoiceId) {
              await reconcileExternalInvoicePayment({
                organizationId: orgId,
                invoiceId: platformInvoiceId,
                amount: grossAmount,
                method: 'stripe',
                externalReference: eventId,
                status: 'completed',
                metadata: { stripeEventType: eventType, paymentIntentId: pi.id },
                createdBy: 'system:stripe-webhook',
              });
            } else {
              const reservation = await reservePlatformPayment({
                organizationId: orgId,
                billingAccountId: billingAcctId,
                externalReference: eventId,
                amount: grossAmount,
                currency,
                status: 'completed',
                metadata: { stripeEventType: eventType, paymentIntentId: pi.id },
              });
              if (!reservation.reserved) {
                assertReplayOwnership(reservation.existing, { amount: grossAmount, currency });
                return 'replay' as const;
              }
            }

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
            return 'fresh' as const;
          });

          if (outcome === 'replay') {
            return NextResponse.json({ received: true, status: 'duplicate' });
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
          const grossAmount = String((inv.amount_paid ?? 0) / 100);
          const currency = inv.currency?.toUpperCase() ?? 'CAD';

          const outcome = await withSystemContext(async () => {
            const billingAcctId = orgId ? await resolveBillingAccountId(orgId) : null;
            if (!orgId || !billingAcctId) {
              logger.warn(`[stripe-webhook] Cannot resolve org/billing for event ${eventId}`);
              return 'no_billing' as const;
            }

            if (platformInvoiceId) {
              await reconcileExternalInvoicePayment({
                organizationId: orgId,
                invoiceId: platformInvoiceId,
                amount: grossAmount,
                method: 'stripe',
                externalReference: eventId,
                status: 'completed',
                metadata: { stripeEventType: eventType, invoiceId: inv.id },
                createdBy: 'system:stripe-webhook',
              });
            } else {
              const reservation = await reservePlatformPayment({
                organizationId: orgId,
                billingAccountId: billingAcctId,
                externalReference: eventId,
                amount: grossAmount,
                currency,
                status: 'completed',
                metadata: { stripeEventType: eventType, invoiceId: inv.id },
              });
              if (!reservation.reserved) {
                assertReplayOwnership(reservation.existing, { amount: grossAmount, currency });
                return 'replay' as const;
              }
            }

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
            return 'fresh' as const;
          });

          if (outcome === 'replay') {
            return NextResponse.json({ received: true, status: 'duplicate' });
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
            await withSystemContext(() =>
              reconcileExternalInvoicePayment({
                organizationId: orgId,
                invoiceId: platformInvoiceId,
                amount: String((inv.amount_due ?? inv.amount_remaining ?? 0) / 100),
                method: 'stripe',
                externalReference: eventId,
                status: 'failed',
                failureReason: 'stripe_invoice_payment_failed',
                metadata: { stripeEventType: eventType, invoiceId: inv.id },
                createdBy: 'system:stripe-webhook',
              }),
            );
          }
        }
        break;
      }

      case 'charge.refunded': {
        const ch = event.data?.object;
        if (ch) {
          const orgId = (ch.metadata?.organization_id as string) ?? null;
          const refundAmount = String(-((ch.amount_refunded ?? 0) / 100));
          const currency = ch.currency?.toUpperCase() ?? 'CAD';

          const outcome = await withSystemContext(async () => {
            const billingAcctId = orgId ? await resolveBillingAccountId(orgId) : null;
            if (!orgId || !billingAcctId) {
              logger.warn(`[stripe-webhook] Cannot resolve org/billing for refund event ${eventId}`);
              return 'no_billing' as const;
            }

            const reservation = await reservePlatformPayment({
              organizationId: orgId,
              billingAccountId: billingAcctId,
              externalReference: eventId,
              amount: refundAmount,
              currency,
              status: 'refunded',
              metadata: { stripeEventType: eventType, chargeId: ch.id },
            });
            if (!reservation.reserved) {
              assertReplayOwnership(reservation.existing, { amount: refundAmount, currency });
              return 'replay' as const;
            }

            // Reverse any captured fee for the original payment (same tx).
            const originalPaymentId = ch.payment_intent as string | undefined;
            if (originalPaymentId) {
              const [feeEvent] = await db
                .select()
                .from(transactionFeeEvents)
                .where(eq(transactionFeeEvents.sourceTransactionId, originalPaymentId))
                .limit(1);
              if (feeEvent) {
                await reverseTransactionFee(feeEvent.id, ch.id, `Stripe refund ${ch.id}`).catch(
                  () => {
                    /* already reversed — OK */
                  },
                );
              }
            }
            return 'fresh' as const;
          });

          if (outcome === 'replay') {
            return NextResponse.json({ received: true, status: 'duplicate' });
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
            const existing = await withSystemContext(async (tx) => {
              const [row] = await tx
                .select({ reportTierId: icraAssessments.reportTierId })
                .from(icraAssessments)
                .where(eq(icraAssessments.id, icraAssessmentId))
                .limit(1);
              return row;
            });

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

            // Upgrade the assessment tier and patch the stored profile payload
            // (SYSTEM_ONLY table — bounded system execution, not ordinary db) so
            // the results page reflects the new tier.
            await withSystemContext(async (tx) => {
              await tx
                .update(icraAssessments)
                .set({ reportTierId: icraTierId })
                .where(eq(icraAssessments.id, icraAssessmentId));

              const [profileRow] = await tx
                .select({ profilePayload: icraMaturityProfiles.profilePayload })
                .from(icraMaturityProfiles)
                .where(eq(icraMaturityProfiles.assessmentId, icraAssessmentId))
                .limit(1);

              if (profileRow?.profilePayload) {
                const updated: InstitutionalContinuityProfile = {
                  ...(profileRow.profilePayload as InstitutionalContinuityProfile),
                  reportTierId: icraTierId as InstitutionalContinuityProfile['reportTierId'],
                };
                await tx
                  .update(icraMaturityProfiles)
                  .set({ profilePayload: updated })
                  .where(eq(icraMaturityProfiles.assessmentId, icraAssessmentId));
              }
            });

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
            // A paid report must not remain locked after a transient failure.
            // Returning non-2xx asks Stripe to retry this idempotent fulfillment.
            return NextResponse.json(
              { received: false, error: 'ICRA fulfillment failed' },
              { status: 500 },
            );
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

          const claimToken = generateClaimToken();
          const claimExpiry = computeClaimExpiry();
          const customerEmail =
            (session?.customer_details?.email as string | undefined) ??
            (session?.customer_email as string | undefined) ??
            null;
          const paymentRef =
            (session?.payment_intent as string | undefined) ?? (session?.id as string);

          let freshFulfillment = false;
          try {
            // Single authority boundary. withSystemContext owns the system-role
            // transaction; every workbook-fulfilment write uses only `tx`. The
            // canonical serialization key is workbook_purchases.stripe_payment_ref
            // (globally unique) — not a workbook pre-read.
            freshFulfillment = await withSystemContext(async (tx) => {
              // Existence guard only — does not decide fulfilment.
              const [existing] = await tx
                .select({ id: workbooks.id })
                .from(workbooks)
                .where(eq(workbooks.id, workbookId))
                .limit(1);
              if (!existing) {
                logger.warn('[stripe-webhook] Workbook not found', { workbookId });
                return false;
              }

              // Reserve the payment first. ON CONFLICT DO NOTHING on the unique
              // stripe_payment_ref serializes concurrent deliveries: a returned
              // row means this transaction owns fulfilment.
              const reserved = await tx
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
                .onConflictDoNothing()
                .returning({
                  id: workbookPurchases.id,
                  workbookId: workbookPurchases.workbookId,
                });

              if (reserved.length > 0) {
                // Fresh reservation. The guarded UPDATE encodes that the
                // workbook is still fulfillable (no payment assigned, no claim
                // credential issued).
                const updated = await tx
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
                  .where(
                    and(
                      eq(workbooks.id, workbookId),
                      isNull(workbooks.stripePaymentRef),
                      isNull(workbooks.claimToken),
                    ),
                  )
                  .returning({ id: workbooks.id });

                if (updated.length === 0) {
                  // Reservation won but the workbook already transitioned —
                  // contention. Throw so the reservation rolls back with it.
                  throw new Error('workbook_already_transitioned');
                }

                logger.info('[stripe-webhook] Workbook tier upgraded & claim token issued', {
                  workbookId,
                  tierId: workbookTierId,
                  sessionId: session.id,
                  claimEmailPresent: Boolean(customerEmail),
                });
                return true;
              }

              // No reservation row: the payment ref already exists. Resolve the
              // owning purchase to distinguish legitimate replay from a
              // cross-workbook reuse of the same Stripe payment.
              const [existingPurchase] = await tx
                .select({ workbookId: workbookPurchases.workbookId })
                .from(workbookPurchases)
                .where(eq(workbookPurchases.stripePaymentRef, paymentRef))
                .limit(1);

              if (!existingPurchase) {
                throw new Error('workbook_purchase_conflict_unresolved');
              }
              if (existingPurchase.workbookId !== workbookId) {
                throw new Error('workbook_payment_ref_cross_workbook');
              }

              // Legitimate replay — same payment, same workbook. No mutation.
              logger.info('[stripe-webhook] Workbook payment replay — no mutation', {
                workbookId,
                tierId: workbookTierId,
              });
              return false;
            });
          } catch (wbErr) {
            logger.error('[stripe-webhook] Workbook fulfillment error', {
              workbookId,
              workbookTierId,
              err: wbErr,
            });
            return NextResponse.json(
              { received: false, error: 'Workbook fulfillment failed' },
              { status: 500 },
            );
          }

          // CRM runs only after the transaction commits and only for fresh
          // fulfilment. Never inside the DB transaction. Non-blocking; a CRM
          // failure after a committed payment must not fail the webhook.
          if (freshFulfillment) {
            try {
              await syncWorkbookPurchase({
                workbookId,
                tier: 'workbook_self_guided',
                paymentReference: paymentRef,
                amount:
                  typeof session?.amount_total === 'number'
                    ? session.amount_total / 100
                    : undefined,
                email: customerEmail ?? undefined,
                organizationName:
                  (session?.metadata?.organization_name as string | undefined) ?? undefined,
                attribution: {
                  source: (session?.metadata?.utm_source as string | undefined) ?? null,
                  medium: (session?.metadata?.utm_medium as string | undefined) ?? null,
                  campaign: (session?.metadata?.utm_campaign as string | undefined) ?? null,
                },
              });
            } catch (crmErr) {
              logger.warn('[stripe-webhook] workbook CRM sync failed (non-blocking)', {
                workbookId,
                err: crmErr instanceof Error ? crmErr.message : String(crmErr),
              });
            }
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
    // Preserve Stripe's retry contract for transient database or downstream
    // failures. All mutation branches are idempotent.
    return NextResponse.json(
      { received: false, error: 'Internal processing error' },
      { status: 500 },
    );
  }
}
