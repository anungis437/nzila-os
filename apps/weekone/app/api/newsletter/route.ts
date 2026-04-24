import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@nzila/os-core/telemetry'

const log = createLogger('weekone.newsletter')

const schema = z.object({
  email: z.string().email(),
  source: z.string().min(1).default('weekone-newsletter'),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid newsletter payload' }, { status: 400 })
  }

  log.info('signup_received', {
    email: parsed.data.email,
    source: parsed.data.source,
    occurredAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, eventName: 'weekone.newsletter.submit' })
}
