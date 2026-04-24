import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSubscriptionCheckoutSession } from '@nzila/payments-stripe'
import { resolveWeekonePriceId, weekoneCheckoutFallbackUrl } from '@/lib/billing-plans'

const requestSchema = z.object({
  plan: z.enum(['solo', 'team', 'growth']),
  interval: z.enum(['monthly', 'annual']).default('monthly'),
  couponCode: z.string().trim().min(2).max(32).optional(),
  locale: z.string().min(2).default('en'),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid checkout request' }, { status: 400 })
  }

  const { plan, interval, locale, couponCode } = parsed.data
  const fallbackUrl = weekoneCheckoutFallbackUrl(plan, interval, locale)
  const priceId = resolveWeekonePriceId(plan, interval)

  if (!priceId) {
    return NextResponse.json({
      ok: true,
      eventName: 'weekone.billing.checkout_initiated',
      checkoutUrl: fallbackUrl,
      mode: 'fallback',
      plan,
      interval,
      couponApplied: Boolean(couponCode),
    })
  }

  try {
    const appBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3004'
    const checkout = await createSubscriptionCheckoutSession({
      priceId,
      orgId: process.env.PLATFORM_ORG_ID ?? 'weekone:platform',
      successUrl: `${appBase}/${locale}/settings/billing?success=1`,
      cancelUrl: `${appBase}/${locale}/settings/billing?canceled=1`,
      metadata: {
        app_id: 'weekone',
        plan,
        interval,
        coupon_code: couponCode ?? '',
      },
    })

    return NextResponse.json({
      ok: true,
      eventName: 'weekone.billing.checkout_initiated',
      checkoutUrl: checkout.url,
      mode: 'stripe',
      plan,
      interval,
      couponApplied: Boolean(couponCode),
    })
  } catch {
    return NextResponse.json({
      ok: true,
      eventName: 'weekone.billing.checkout_fallback',
      checkoutUrl: fallbackUrl,
      mode: 'fallback',
      plan,
      interval,
      couponApplied: Boolean(couponCode),
    })
  }
}
