import { verifyCalendarOAuthState, clearCalendarOAuthStateCookie } from '@/lib/external-calendar-sync/oauth-state'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
/**
 * Google Calendar OAuth Callback
 *
 * Exchanges OAuth code for tokens and stores/updates the user's
 * Google calendar connection in an org-scoped record.
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard'
import { exchangeCodeForTokens } from '@/lib/external-calendar-sync/google-calendar-service'
import { encryptCalendarToken } from '@/lib/external-calendar-sync/token-crypto'
import { externalCalendarConnections } from '@/db/schema/calendar-schema'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'

export const dynamic = 'force-dynamic'

export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
    const userId = typeof context.userId === 'string' ? context.userId : null
    const organizationId = typeof context.organizationId === 'string' ? context.organizationId : null

    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required')
    }
    if (!organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required')
    }

    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')

    if (!code) {
      const response = standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing OAuth authorization code')
      clearCalendarOAuthStateCookie(response, 'google')
      return response
    }
    if (!verifyCalendarOAuthState(request, 'google', state, userId, organizationId)) {
      const response = standardErrorResponse(ErrorCode.FORBIDDEN, 'Missing, expired or invalid OAuth state')
      clearCalendarOAuthStateCookie(response, 'google')
      return response
    }

    const tokens = await exchangeCodeForTokens(code)

    await withRLSContext({ organizationId, userId }, async (tx) => {
      const [existing] = await tx
        .select({ id: externalCalendarConnections.id })
        .from(externalCalendarConnections)
        .where(
          and(
            eq(externalCalendarConnections.userId, userId),
            eq(externalCalendarConnections.organizationId, organizationId),
            eq(externalCalendarConnections.provider, 'google'),
          ),
        )
        .limit(1)

      if (!tokens.refreshToken && !existing) {
        throw new Error('Google OAuth did not return refresh token for new connection')
      }

      const now = new Date()
      const connectionPayload = {
        userId,
        organizationId,
        provider: 'google',
        providerAccountId: `google:${userId}`,
        accessToken: encryptCalendarToken(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptCalendarToken(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
        syncEnabled: true,
        syncDirection: 'both',
        nextSyncAt: new Date(now.getTime() + 5 * 60 * 1000),
        syncStatus: 'synced' as const,
        syncError: null,
        isActive: true,
        updatedAt: now,
      }

      let connectionId = existing?.id
      if (existing) {
        await tx
          .update(externalCalendarConnections)
          .set({
            ...connectionPayload,
            refreshToken: tokens.refreshToken ? encryptCalendarToken(tokens.refreshToken) : undefined,
          })
          .where(
            and(
              eq(externalCalendarConnections.id, existing.id),
              eq(externalCalendarConnections.organizationId, organizationId),
              eq(externalCalendarConnections.userId, userId),
            ),
          )
      } else {
        const [created] = await tx.insert(externalCalendarConnections).values({
          ...connectionPayload,
          createdAt: now,
        }).returning({ id: externalCalendarConnections.id })
        if (!created) throw new Error('Calendar connection creation failed')
        connectionId = created.id
      }
      if (!connectionId) throw new Error('Calendar connection id unavailable')
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'calendar.connection.oauth.connect',
        resourceType: 'external_calendar_connections',
        resourceId: connectionId,
        details: { provider: 'google', updatedExisting: Boolean(existing) },
      })
    })

    const redirectUrl = new URL('/calendar?sync=connected&provider=google', request.nextUrl.origin)
    const response = NextResponse.redirect(redirectUrl)
    clearCalendarOAuthStateCookie(response, 'google')
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes('did not return refresh token')) {
      const response = standardErrorResponse(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Google OAuth did not return a refresh token. Reconnect with consent to enable continuous sync.',
      )
      clearCalendarOAuthStateCookie(response, 'google')
      return response
    }

    const response = standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to complete Google Calendar authorization',
      error,
    )
    clearCalendarOAuthStateCookie(response, 'google')
    return response
  }
})
