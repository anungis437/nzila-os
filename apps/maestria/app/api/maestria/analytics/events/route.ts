import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'
import { recordOperationalEvent } from '@/lib/maestria-analytics'

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = authorize(searchParams, 'quote.manage', 'analytics.event.create', 'analytics:kpi-events')
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
    typeof payload.eventName !== 'string'
    || typeof payload.value !== 'number'
    || typeof payload.unit !== 'string'
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_event_fields' }, { status: 400 })
  }

  const event = recordOperationalEvent({
    eventName: payload.eventName,
    value: payload.value,
    unit: payload.unit,
    source: typeof payload.source === 'string' ? payload.source : 'maestria.api',
    dimensions: {
      actor: auth.actor.id,
      role: auth.actor.role,
      ...(payload.dimensions && typeof payload.dimensions === 'object' ? payload.dimensions as Record<string, unknown> : {}),
    },
  })

  return NextResponse.json({ ok: true, event }, { status: 201 })
}
