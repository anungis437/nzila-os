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
 *   4. Upserts qbo_tokens row (encrypted tokens stored as-is for local dev;
 *      encrypt at rest in prod via Azure Key Vault / KMS before storing)
 *   5. Redirects to /settings/integrations?qbo=connected
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@nzila/db'
import { qboConnections, qboTokens } from '@nzila/db/schema'
import { exchangeCodeForTokens } from '@nzila/qbo/oauth'
import { eq, and } from 'drizzle-orm'

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
      new URL(`/settings/integrations?qbo=denied&reason=${encodeURIComponent(errorParam)}`, req.url),
    )
  }

  if (!code || !realmId || !stateParam) {
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=missing_params', req.url),
    )
  }

  // ── CSRF validation ───────────────────────────────────────────────────────

  let parsedState: { csrfToken: string; entityId: string }
  try {
    parsedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'))
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

  const { entityId } = parsedState

  // ── Token exchange ────────────────────────────────────────────────────────

  let tokenSet: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokenSet = await exchangeCodeForTokens(code, realmId)
  } catch (err) {
    console.error('[QBO] Token exchange failed:', err)
    return NextResponse.redirect(
      new URL('/settings/integrations?qbo=error&reason=token_exchange', req.url),
    )
  }

  // ── Upsert connection ─────────────────────────────────────────────────────

  const now = new Date()
  const accessTokenExpiresAt = new Date(tokenSet.obtainedAt + tokenSet.expires_in * 1000)
  const refreshTokenExpiresAt = new Date(
    tokenSet.obtainedAt + tokenSet.x_refresh_token_expires_in * 1000,
  )

  await db.transaction(async (tx) => {
    // Mark any existing active connection for this entity+realmId inactive
    await tx
      .update(qboConnections)
      .set({ isActive: false, disconnectedAt: now, updatedAt: now })
      .where(and(eq(qboConnections.entityId, entityId), eq(qboConnections.realmId, realmId)))

    // Create fresh connection
    const [connection] = await tx
      .insert(qboConnections)
      .values({
        entityId,
        realmId,
        isActive: true,
        connectedBy: userId,
        connectedAt: now,
      })
      .returning()

    // Store tokens against the connection
    // TODO(prod): encrypt access_token + refresh_token before insert using Azure KMS
    await tx.insert(qboTokens).values({
      connectionId: connection.id,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })
  })

  // Clear CSRF cookie and redirect
  const res = NextResponse.redirect(
    new URL('/settings/integrations?qbo=connected', req.url),
  )
  res.cookies.delete('qbo_oauth_state')
  return res
}
