import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions, stripePayments, stripeRefunds } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  createPortalSession,
  createSubscription,
  requiresApproval,
  executeRefund,
} from '@nzila/payments-stripe/primitives'
import { recordAuditEvent } from '@/lib/audit-db'
import { createLogger } from '@nzila/os-core'
import type { AuthContext } from '@/lib/api-guards'
type BillingActor = Pick<AuthContext, 'userId' | 'platformRole'>
const logger = createLogger('stripe:billing-service')
export async function loadStripeRefund(id: string) {
  return (await platformDb.select().from(stripeRefunds).where(eq(stripeRefunds.id, id)).limit(1))[0]
}

export async function createOrganizationBillingPortal(input: {
  orgId: string
  customerId: string
  returnUrl: string
}) {
  const { orgId, customerId, returnUrl } = input
  const [linkedCustomer] = await platformDb
    .select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(
      and(
        eq(stripeSubscriptions.orgId, orgId),
        eq(stripeSubscriptions.stripeCustomerId, customerId),
      ),
    )
    .limit(1)
  if (!linkedCustomer) {
    return {
      status: 403 as const,
      body: { error: 'Forbidden: customer is not linked to organization' },
    }
  }
  try {
    const session = await createPortalSession({ customerId, returnUrl })
    return {
      status: 200 as const,
      body: { url: session.url },
    }
  } catch (err) {
    logger.error(
      '[stripe/customer-portal] Error creating portal session:',
      err instanceof Error ? err : { detail: err },
    )
    return {
      status: 500 as const,
      body: { error: 'Failed to create portal session' },
    }
  }
}

export async function createOrganizationSubscription(
  input: {
    orgId: string
    ventureId?: string
    customerId: string
    priceId: string
    trialDays?: number
    metadata?: Record<string, string>
  },
  auth: BillingActor,
) {
  if (
    (input.metadata?.org_id !== undefined && input.metadata.org_id !== input.orgId) ||
    (input.metadata?.venture_id !== undefined && input.metadata.venture_id !== input.ventureId)
  )
    return {
      status: 400 as const,
      body: { error: 'Reserved metadata does not match authorized organization or venture' },
    }
  try {
    const result = await createSubscription({
      customerId: input.customerId,
      priceId: input.priceId,
      orgId: input.orgId,
      ventureId: input.ventureId,
      trialDays: input.trialDays,
      metadata: input.metadata,
    })
    // Persist to DB (status will be updated via webhook)
    await platformDb.insert(stripeSubscriptions).values({
      orgId: input.orgId,
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: result.subscriptionId,
      stripePriceId: input.priceId,
      status: result.status as 'incomplete',
      currentPeriodEnd: result.currentPeriodEnd ? new Date(result.currentPeriodEnd * 1000) : null,
      createdBy: auth.userId,
    })
    await recordAuditEvent({
      orgId: input.orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.subscription_created',
      targetType: 'stripe_subscription',
      targetId: undefined,
      afterJson: {
        subscriptionId: result.subscriptionId,
        priceId: input.priceId,
        status: result.status,
        ventureId: input.ventureId,
      },
    })
    return {
      status: 201 as const,
      body: {
        subscriptionId: result.subscriptionId,
        clientSecret: result.clientSecret,
        status: result.status,
        currentPeriodEnd: result.currentPeriodEnd,
      },
    }
  } catch (err) {
    logger.error(
      '[stripe/subscriptions] Error creating subscription:',
      err instanceof Error ? err : { detail: err },
    )
    return {
      status: 500 as const,
      body: { error: 'Failed to create subscription' },
    }
  }
}

export async function listOrganizationSubscriptions(orgId: string) {
  const subs = await platformDb
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.orgId, orgId))
    .orderBy(stripeSubscriptions.createdAt)
  return subs
}

export async function requestOrganizationRefund(
  input: {
    orgId: string
    paymentId: string
    amountCents: number
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  },
  auth: BillingActor,
) {
  const { orgId, paymentId, amountCents, reason } = input
  // Look up the payment to get the Stripe object ID
  const [payment] = await platformDb
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.id, paymentId))
    .limit(1)
  if (!payment) {
    return {
      status: 404 as const,
      body: { error: 'Payment not found' },
    }
  }
  if (payment.orgId !== orgId) {
    return {
      status: 403 as const,
      body: { error: 'Forbidden: payment does not belong to organization' },
    }
  }
  // Audit: refund requested
  await recordAuditEvent({
    orgId,
    actorClerkUserId: auth.userId,
    actorRole: auth.platformRole,
    action: 'stripe.refund_requested',
    targetType: 'stripe_payment',
    targetId: paymentId,
    afterJson: { amountCents, reason },
  })
  // Check if approval is required
  if (requiresApproval(amountCents)) {
    // Create pending refund — do NOT call Stripe yet
    const [refundRow] = await platformDb
      .insert(stripeRefunds)
      .values({
        orgId,
        paymentId,
        amountCents: BigInt(amountCents),
        status: 'pending_approval',
        requestedBy: auth.userId,
        occurredAt: new Date(),
      })
      .returning({ id: stripeRefunds.id })
    return {
      status: 202 as const,
      body: {
        refundId: refundRow!.id,
        status: 'pending_approval',
        message: `Refund of ${amountCents} cents requires finance_approver approval`,
      },
    }
  }
  // Below threshold — execute immediately
  try {
    const stripeRefund = await executeRefund({
      paymentIntentId: payment.stripeObjectId,
      amountCents,
      reason,
    })
    const [refundRow] = await platformDb
      .insert(stripeRefunds)
      .values({
        orgId,
        refundId: stripeRefund.id,
        paymentId,
        amountCents: BigInt(amountCents),
        status: 'executed',
        requestedBy: auth.userId,
        occurredAt: new Date(),
      })
      .returning({ id: stripeRefunds.id })
    await recordAuditEvent({
      orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.refund_executed',
      targetType: 'stripe_refund',
      targetId: refundRow!.id,
      afterJson: {
        stripeRefundId: stripeRefund.id,
        amountCents,
        status: stripeRefund.status,
      },
    })
    return {
      status: 201 as const,
      body: {
        refundId: refundRow!.id,
        stripeRefundId: stripeRefund.id,
        status: 'executed',
      },
    }
  } catch (err) {
    logger.error(
      '[stripe/refunds] Error executing refund:',
      err instanceof Error ? err : { detail: err },
    )
    return {
      status: 500 as const,
      body: { error: 'Failed to execute refund' },
    }
  }
}

export async function reviewOrganizationRefund(
  refundId: string,
  approvalAction: 'approve' | 'deny',
  refund: typeof stripeRefunds.$inferSelect,
  auth: BillingActor,
) {
  if (refund.status !== 'pending_approval') {
    return {
      status: 409 as const,
      body: { error: `Refund is not pending approval (current status: ${refund.status})` },
    }
  }
  if (approvalAction === 'deny') {
    await platformDb
      .update(stripeRefunds)
      .set({
        status: 'denied',
        approvedBy: auth.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(stripeRefunds.id, refundId), eq(stripeRefunds.orgId, refund.orgId)))
    await recordAuditEvent({
      orgId: refund.orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.refund_denied',
      targetType: 'stripe_refund',
      targetId: refundId,
      afterJson: { status: 'denied' },
    })
    return {
      status: 200 as const,
      body: { refundId, status: 'denied' },
    }
  }
  // Approve: execute the refund via Stripe
  // Look up the payment to get the Stripe object ID
  if (!refund.paymentId) {
    return {
      status: 400 as const,
      body: { error: 'No associated payment found' },
    }
  }
  const [payment] = await platformDb
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.id, refund.paymentId))
    .limit(1)
  if (!payment) {
    return {
      status: 404 as const,
      body: { error: 'Associated payment not found' },
    }
  }
  if (payment.orgId !== refund.orgId)
    return {
      status: 403 as const,
      body: { error: 'Payment does not belong to refund organization' },
    }
  try {
    const stripeRefundResult = await executeRefund({
      paymentIntentId: payment.stripeObjectId,
      amountCents: Number(refund.amountCents),
    })
    await platformDb
      .update(stripeRefunds)
      .set({
        refundId: stripeRefundResult.id,
        status: 'executed',
        approvedBy: auth.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(stripeRefunds.id, refundId), eq(stripeRefunds.orgId, refund.orgId)))
    await recordAuditEvent({
      orgId: refund.orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.refund_approved',
      targetType: 'stripe_refund',
      targetId: refundId,
      afterJson: {
        stripeRefundId: stripeRefundResult.id,
        amountCents: Number(refund.amountCents),
        status: 'executed',
      },
    })
    await recordAuditEvent({
      orgId: refund.orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.refund_executed',
      targetType: 'stripe_refund',
      targetId: refundId,
      afterJson: {
        stripeRefundId: stripeRefundResult.id,
        amountCents: Number(refund.amountCents),
      },
    })
    return {
      status: 200 as const,
      body: {
        refundId,
        stripeRefundId: stripeRefundResult.id,
        status: 'executed',
      },
    }
  } catch (err) {
    logger.error(
      '[stripe/refunds/approve] Error executing refund:',
      err instanceof Error ? err : { detail: err },
    )
    await platformDb
      .update(stripeRefunds)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(and(eq(stripeRefunds.id, refundId), eq(stripeRefunds.orgId, refund.orgId)))
    return {
      status: 500 as const,
      body: { error: 'Failed to execute refund via Stripe' },
    }
  }
}
