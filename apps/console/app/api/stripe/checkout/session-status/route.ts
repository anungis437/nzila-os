// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/stripe/checkout/session-status?session_id=cs_xxx
 *
 * Retrieves the status of a Stripe Checkout Session.
 * Called by the success page to confirm payment and provision access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@nzila/payments-stripe'
import { authenticateUser } from '@/lib/api-guards'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })

    const subscription = session.subscription as { id: string; status: string } | null

    return NextResponse.json({
      status: session.status,          // 'open' | 'complete' | 'expired'
      paymentStatus: session.payment_status,
      customerId:
        typeof session.customer === 'object' && session.customer
          ? (session.customer as { id: string }).id
          : session.customer,
      subscriptionId: subscription?.id ?? null,
      subscriptionStatus: subscription?.status ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
