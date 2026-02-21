// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/customers — Create a Stripe customer
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createCustomer } from '@nzila/payments-stripe/primitives'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'

const CreateCustomerSchema = z.object({
  entityId: z.string().uuid(),
  ventureId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  metadata: z.record(z.string()).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreateCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { entityId, ventureId, email, name, metadata } = parsed.data

  try {
    const customer = await createCustomer({
      entityId,
      ventureId,
      email,
      name,
      metadata,
    })

    await recordAuditEvent({
      entityId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.customer_created',
      targetType: 'stripe_customer',
      targetId: undefined,
      afterJson: {
        customerId: customer.id,
        email,
        name,
        ventureId,
      },
    })

    return NextResponse.json({ customerId: customer.id, email: customer.email }, { status: 201 })
  } catch (err) {
    console.error('[stripe/customers] Error creating customer:', err)
    return NextResponse.json(
      { error: 'Failed to create Stripe customer' },
      { status: 500 },
    )
  }
}
