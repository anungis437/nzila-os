import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@nzila/os-core/telemetry'
import { WEEKONE_ANALYTICS_EVENT_SET } from '@/lib/analytics/events'

const log = createLogger('weekone.analytics')

const schema = z.object({
  eventName: z.string().min(1),
  context: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid analytics payload' }, { status: 400 })
  }

  if (!WEEKONE_ANALYTICS_EVENT_SET.has(parsed.data.eventName)) {
    return NextResponse.json({ ok: false, error: 'Unknown analytics event' }, { status: 400 })
  }

  log.info('event_received', {
    eventName: parsed.data.eventName,
    context: parsed.data.context ?? {},
    occurredAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
