import { NextResponse } from 'next/server'
import { z } from 'zod'

const COMMERCIAL_ANALYTICS_EVENTS = {
  WEEKONE_REFERRAL_SUBMITTED: 'weekone.referral.submitted',
} as const

const referralSchema = z.object({
  email: z.string().email(),
  source: z.string().min(1).default('weekone-dashboard'),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = referralSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid referral payload' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    lead: {
      id: crypto.randomUUID(),
      email: parsed.data.email,
      source: parsed.data.source,
    },
    eventName: COMMERCIAL_ANALYTICS_EVENTS.WEEKONE_REFERRAL_SUBMITTED,
  })
}
