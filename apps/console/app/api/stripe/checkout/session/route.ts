// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/checkout/session — Create a Stripe Checkout Session
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createCheckoutSession } from '@nzila/payments-stripe/primitives'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'

const LineItemSchema = z.object({
  priceId: z.string().optional(),
  name: z.string().optional(),
  amountCents: z.number().int().min(1),
  quantity: z.number().int().min(1),
})

const CreateCheckoutSchema = z.object({
  entityId: z.string().uuid(),
  ventureId: z.string().optional(),
  customerId: z.string().optional(),
  lineItems: z.array(LineItemSchema).min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  metadata: z.record(z.string()).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreateCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  try {
    const session = await createCheckoutSession({
      entityId: input.entityId,
      ventureId: input.ventureId,
      customerId: input.customerId,
      lineItems: input.lineItems,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: input.metadata,
    })

    await recordAuditEvent({
      entityId: input.entityId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.checkout_session_created',
      targetType: 'stripe_checkout_session',
      targetId: undefined,
      afterJson: {
        sessionId: session.id,
        url: session.url,
        ventureId: input.ventureId,
      },
    })

    return NextResponse.json(
      { sessionId: session.id, url: session.url },
      { status: 201 },
    )
  } catch (err) {
    console.error('[stripe/checkout] Error creating session:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    )
  }
}
