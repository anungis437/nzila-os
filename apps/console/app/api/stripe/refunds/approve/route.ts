// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/refunds/approve — Approve a pending refund
 *
 * Only finance_approver or entity_admin roles can approve.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@nzila/db'
import { stripeRefunds, stripePayments } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { executeRefund } from '@nzila/payments-stripe/primitives'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'

const ApproveRefundSchema = z.object({
  refundId: z.string().uuid(),
  entityId: z.string().uuid(),
  action: z.enum(['approve', 'deny']),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  // Role check: only finance_approver or platform_admin
  if (!['platform_admin', 'studio_admin'].includes(auth.platformRole)) {
    return NextResponse.json(
      { error: 'Forbidden: finance_approver role required' },
      { status: 403 },
    )
  }

  const body = await req.json()
  const parsed = ApproveRefundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { refundId, entityId, action: approvalAction } = parsed.data

  // Fetch the pending refund
  const [refund] = await db
    .select()
    .from(stripeRefunds)
    .where(eq(stripeRefunds.id, refundId))
    .limit(1)

  if (!refund) {
    return NextResponse.json({ error: 'Refund not found' }, { status: 404 })
  }

  if (refund.status !== 'pending_approval') {
    return NextResponse.json(
      { error: `Refund is not pending approval (current status: ${refund.status})` },
      { status: 409 },
    )
  }

  if (approvalAction === 'deny') {
    await db
      .update(stripeRefunds)
      .set({
        status: 'denied',
        approvedBy: auth.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stripeRefunds.id, refundId))

    await recordAuditEvent({
      entityId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.refund_denied',
      targetType: 'stripe_refund',
      targetId: refundId,
      afterJson: { status: 'denied' },
    })

    return NextResponse.json({ refundId, status: 'denied' })
  }

  // Approve: execute the refund via Stripe
  // Look up the payment to get the Stripe object ID
  if (!refund.paymentId) {
    return NextResponse.json({ error: 'No associated payment found' }, { status: 400 })
  }

  const [payment] = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.id, refund.paymentId))
    .limit(1)

  if (!payment) {
    return NextResponse.json({ error: 'Associated payment not found' }, { status: 404 })
  }

  try {
    const stripeRefundResult = await executeRefund({
      paymentIntentId: payment.stripeObjectId,
      amountCents: Number(refund.amountCents),
    })

    await db
      .update(stripeRefunds)
      .set({
        refundId: stripeRefundResult.id,
        status: 'executed',
        approvedBy: auth.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stripeRefunds.id, refundId))

    await recordAuditEvent({
      entityId,
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
      entityId,
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

    return NextResponse.json({
      refundId,
      stripeRefundId: stripeRefundResult.id,
      status: 'executed',
    })
  } catch (err) {
    console.error('[stripe/refunds/approve] Error executing refund:', err)

    await db
      .update(stripeRefunds)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(stripeRefunds.id, refundId))

    return NextResponse.json(
      { error: 'Failed to execute refund via Stripe' },
      { status: 500 },
    )
  }
}
