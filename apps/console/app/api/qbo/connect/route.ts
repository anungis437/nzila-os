// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Connect
 * GET /api/qbo/connect?entityId=...
 *
 * Builds the Intuit OAuth 2.0 authorization URL, stores a CSRF state cookie,
 * and returns { authUrl } for the client to redirect to.
 *
 * Client-side: window.location.href = authUrl
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireEntityAccess } from '@/lib/api-guards'
import { buildAuthorizationUrl } from '@nzila/qbo/oauth'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const access = await requireEntityAccess(entityId, { minRole: 'entity_admin' })
  if (!access.ok) return access.response

  // CSRF state: random token + entityId so we can retrieve it on callback
  const csrfToken = randomBytes(24).toString('hex')
  const state = Buffer.from(JSON.stringify({ csrfToken, entityId })).toString('base64url')

  const authUrl = buildAuthorizationUrl(state)

  const res = NextResponse.json({ authUrl })

  // Store CSRF token in a short-lived, HttpOnly, SameSite=Lax cookie
  res.cookies.set('qbo_oauth_state', csrfToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return res
}
