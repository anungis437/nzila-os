import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { listNotifications } from '@/lib/maestria-persistence'
import { deliverNotification } from '@/lib/maestria-notifications'

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'module.internal.view', 'notifications.read', 'notifications:delivery')
  if (auth.response) return auth.response

  return NextResponse.json({
    ok: true,
    requestedBy: auth.actor.displayName,
    deliveries: listNotifications(100),
  })
}

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'quote.manage', 'notifications.send', 'notifications:delivery')
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
    (payload.channel !== 'email' && payload.channel !== 'in_app' && payload.channel !== 'webhook')
    || typeof payload.recipient !== 'string'
    || typeof payload.subject !== 'string'
    || typeof payload.body !== 'string'
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_delivery_fields' }, { status: 400 })
  }

  const delivery = deliverNotification({
    channel: payload.channel,
    recipient: payload.recipient,
    subject: payload.subject,
    body: payload.body,
    metadata: {
      actor: auth.actor.id,
      role: auth.actor.role,
      ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata as Record<string, unknown> : {}),
    },
  })

  return NextResponse.json({ ok: true, delivery }, { status: 201 })
}
