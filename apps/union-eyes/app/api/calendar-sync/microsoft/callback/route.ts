import { verifyCalendarOAuthState, clearCalendarOAuthStateCookie } from '@/lib/external-calendar-sync/oauth-state'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
/**
 * Microsoft Calendar OAuth Callback
 *
 * Exchanges OAuth code for tokens and stores/updates the user's
 * Microsoft calendar connection in an org-scoped record.
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard'
import { exchangeCodeForTokens } from '@/lib/external-calendar-sync/microsoft-calendar-service'
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
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing OAuth authorization code')
    }
    if (!verifyCalendarOAuthState(request, 'microsoft', state, userId, organizationId)) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Missing, expired or invalid OAuth state')
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
            eq(externalCalendarConnections.provider, 'microsoft'),
          ),
        )
        .limit(1)

      if (!tokens.refreshToken && !existing) {
        throw new Error('Microsoft OAuth did not return refresh token for new connection')
      }

      const now = new Date()
      const connectionPayload = {
        userId,
        organizationId,
        provider: 'microsoft',
        providerAccountId: tokens.providerAccountId || `microsoft:${userId}`,
        providerEmail: tokens.providerEmail || null,
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
        details: { provider: 'microsoft', updatedExisting: Boolean(existing) },
      })
    })

    const redirectUrl = new URL('/calendar?sync=connected&provider=microsoft', request.nextUrl.origin)
    const response = NextResponse.redirect(redirectUrl)
    clearCalendarOAuthStateCookie(response, 'microsoft')
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes('did not return refresh token')) {
      return standardErrorResponse(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Microsoft OAuth did not return a refresh token. Reconnect and grant offline access to enable continuous sync.',
      )
    }

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to complete Microsoft Calendar authorization',
      error,
    )
  }
})
