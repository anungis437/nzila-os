import { NextResponse } from 'next/server'
import { z } from 'zod'

const COMMERCIAL_ANALYTICS_EVENTS = {
  WEEKONE_INVITE_SENT: 'weekone.invite.sent',
} as const

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).default('editor'),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = inviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid invite payload' }, { status: 400 })
  }

  // Placeholder response keeps API contract stable until invite persistence is enabled.
  return NextResponse.json({
    ok: true,
    invited: {
      email: parsed.data.email,
      role: parsed.data.role,
      status: 'queued',
    },
    eventName: COMMERCIAL_ANALYTICS_EVENTS.WEEKONE_INVITE_SENT,
  })
}
