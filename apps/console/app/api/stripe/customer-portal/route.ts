// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/customer-portal — Create a Stripe Billing Portal Session
 *
 * Returns a redirect URL to the Stripe-hosted customer portal where the
 * customer can manage payment methods, view invoices, and cancel/update
 * their subscription.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createPortalSession } from '@nzila/payments-stripe/primitives'
import { authenticateUser } from '@/lib/api-guards'

const CreatePortalSchema = z.object({
  customerId: z.string().min(1),
  returnUrl: z.string().url(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreatePortalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { customerId, returnUrl } = parsed.data

  try {
    const session = await createPortalSession({ customerId, returnUrl })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/customer-portal] Error creating portal session:', err)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    )
  }
}
