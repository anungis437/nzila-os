import { persistQboConnection } from '@/lib/services/qbo-connection-service'
import { requireOrgAccess } from '@/lib/api-guards'
import { z } from 'zod'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO OAuth 2.0 Callback
 * GET /api/qbo/callback?code=&realmId=&state=
 *
 * Intuit redirects here after user logs in and authorizes the app.
 * This route:
 *   1. Validates CSRF state
 *   2. Exchanges code for access + refresh tokens
 *   3. Upserts qbo_connections row
 *   4. Persists AES-256-GCM-encrypted tokens with the connection in one transaction
 *   5. Redirects to /settings/integrations?qbo=connected
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'

import { exchangeCodeForTokens } from '@nzila/qbo/oauth'

import { createLogger } from '@nzila/os-core'
import { assertQboTokenStorageAvailable } from '@/lib/qbo-token-crypto'

const logger = createLogger('qbo:callback')

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const stateParam = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // User declined access
  if (errorParam) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?qbo=denied&reason=${encodeURIComponent(errorParam)}`,
        req.url,
      ),
    )
  }

  if (!code || !realmId || !stateParam) {
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=missing_params', req.url),
    )
  }

  // ── CSRF validation ───────────────────────────────────────────────────────

  let parsedState: { csrfToken: string; orgId: string }
  try {
    parsedState = z
      .object({ csrfToken: z.string().min(1), orgId: z.guid() })
      .parse(JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')))
  } catch {
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=invalid_state', req.url),
    )
  }

  const storedCsrf = req.cookies.get('qbo_oauth_state')?.value
  if (!storedCsrf || storedCsrf !== parsedState.csrfToken) {
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=csrf_mismatch', req.url),
    )
  }

  const { orgId } = parsedState
  const access = await requireOrgAccess(orgId, { minRole: 'org_admin' })
  if (!access.ok) return access.response
  try {
    assertQboTokenStorageAvailable()
  } catch {
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=token_storage_unavailable', req.url),
    )
  }

  // ── Token exchange ────────────────────────────────────────────────────────

  let tokenSet: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokenSet = await exchangeCodeForTokens(code, realmId)
  } catch (err) {
    logger.error('[QBO] Token exchange failed:', err instanceof Error ? err : { detail: err })
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=token_exchange', req.url),
    )
  }

  // ── Upsert connection ─────────────────────────────────────────────────────

  await persistQboConnection(orgId, realmId, access.context.userId, tokenSet)

  // Clear CSRF cookie and redirect
  const res = NextResponse.redirect(new URL('/settings/integrations?qbo=connected', req.url))
  res.cookies.delete('qbo_oauth_state')
  return res
}
