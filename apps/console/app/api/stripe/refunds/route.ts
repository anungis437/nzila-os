// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/refunds — Request or execute a refund
 *
 * If amount >= STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS:
 *   → Create pending refund row, require approval
 * If amount < threshold:
 *   → Execute refund immediately via Stripe API
 *
 * POST /api/stripe/refunds/approve — Approve a pending refund (finance_approver)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { stripeRefunds, stripePayments } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requiresApproval, executeRefund } from '@nzila/payments-stripe/primitives'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'

const RequestRefundSchema = z.object({
  entityId: z.string().uuid(),
  paymentId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = RequestRefundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { entityId, paymentId, amountCents, reason } = parsed.data

  // Look up the payment to get the Stripe object ID
  const [payment] = await platformDb
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.id, paymentId))
    .limit(1)

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  // Audit: refund requested
  await recordAuditEvent({
    entityId,
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
        entityId,
        paymentId,
        amountCents: BigInt(amountCents),
        status: 'pending_approval',
        requestedBy: auth.userId,
        occurredAt: new Date(),
      })
      .returning({ id: stripeRefunds.id })

    return NextResponse.json(
      {
        refundId: refundRow!.id,
        status: 'pending_approval',
        message: `Refund of ${amountCents} cents requires finance_approver approval`,
      },
      { status: 202 },
    )
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
        entityId,
        refundId: stripeRefund.id,
        paymentId,
        amountCents: BigInt(amountCents),
        status: 'executed',
        requestedBy: auth.userId,
        occurredAt: new Date(),
      })
      .returning({ id: stripeRefunds.id })

    await recordAuditEvent({
      entityId,
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

    return NextResponse.json(
      {
        refundId: refundRow!.id,
        stripeRefundId: stripeRefund.id,
        status: 'executed',
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[stripe/refunds] Error executing refund:', err)
    return NextResponse.json(
      { error: 'Failed to execute refund' },
      { status: 500 },
    )
  }
}
