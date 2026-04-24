import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isUuid } from '@/lib/billing-webhook'
import { persistStripeWebhookEvent, type StripeEventLike } from '@/lib/stripe-webhook-persistence'

// Stripe webhook payloads are signature-verified upstream; this Zod schema validates
// the minimal shape we depend on before persisting/processing.
const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  api_version: z.string().nullish(),
  livemode: z.boolean(),
  created: z.number().int().nonnegative(),
  data: z.object({ object: z.unknown() }),
})

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown
    const validated = stripeEventSchema.safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json({ ok: false, error: 'invalid_event_shape' }, { status: 400 })
    }
    const event = validated.data as StripeEventLike
    const objectMetadata = (event.data.object as { metadata?: Record<string, string> }).metadata
    const orgId = objectMetadata?.org_id ?? null

    if (!isUuid(orgId)) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'non_uuid_org' })
    }

    const result = await persistStripeWebhookEvent(event, orgId)
    return NextResponse.json(result)
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Webhook handling failed' }, { status: 500 })
  }
}