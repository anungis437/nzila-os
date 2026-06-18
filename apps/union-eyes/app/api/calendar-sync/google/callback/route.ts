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
import { db } from '@/db/db'
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
    if (state && state !== userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state mismatch')
    }

    const tokens = await exchangeCodeForTokens(code)

    await withRLSContext(async () => {
      const [existing] = await db
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

      if (existing) {
        await db
          .update(externalCalendarConnections)
          .set({
            ...connectionPayload,
            refreshToken: tokens.refreshToken || undefined,
          })
          .where(eq(externalCalendarConnections.id, existing.id))
      } else {
        await db.insert(externalCalendarConnections).values({
          ...connectionPayload,
          createdAt: now,
        })
      }
    })

    const redirectUrl = new URL('/calendar?sync=connected&provider=google', request.nextUrl.origin)
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    if (error instanceof Error && error.message.includes('did not return refresh token')) {
      return standardErrorResponse(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Google OAuth did not return a refresh token. Reconnect with consent to enable continuous sync.',
      )
    }

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to complete Google Calendar authorization',
      error,
    )
  }
})
