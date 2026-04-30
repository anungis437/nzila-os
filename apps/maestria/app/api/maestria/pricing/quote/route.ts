import { NextRequest, NextResponse } from 'next/server'
import { authorizeRequest } from '@/lib/api-authorization'
import { buildPricingQuote } from '@/lib/maestria-pricing'
import { createOperationalRecord } from '@/lib/maestria-persistence'

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = authorizeRequest(searchParams, 'quote.manage', 'pricing.quote.generate', 'pricing:configurator')
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  if (
    typeof payload.recipientCount !== 'number'
    || (payload.tier !== 'core' && payload.tier !== 'premium' && payload.tier !== 'signature')
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_pricing_input' }, { status: 400 })
  }

  const quote = buildPricingQuote({
    recipientCount: payload.recipientCount,
    tier: payload.tier,
    rushDelivery: payload.rushDelivery === true,
    bilingualBranding: payload.bilingualBranding === true,
    customPackagingLevel: payload.customPackagingLevel === 'none' || payload.customPackagingLevel === 'standard' || payload.customPackagingLevel === 'luxury'
      ? payload.customPackagingLevel
      : undefined,
  })

  const record = createOperationalRecord({
    type: 'quote',
    title: `Pricing quote · ${quote.inputs.tier}`,
    body: `Generated quote total ${quote.total} CAD for ${quote.inputs.recipientCount} recipients.`,
    status: 'draft',
    priority: 'normal',
    createdBy: auth.actor.displayName,
    payload: quote,
  })

  return NextResponse.json({ ok: true, quote, quoteRecord: record }, { status: 201 })
}
